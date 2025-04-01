import {MavenAGIClient} from "mavenagi";
import {README_API_BASE_URL} from "@inngest/constants";
import * as APITypes from "@inngest/readmeApi"


export async function callReadmeApi(path: string, token: string) {
    const endpoint = `${README_API_BASE_URL}${path}`;

    const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
            Authorization: `Basic ${token}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(
            `Failed to fetch data from Readme API. Endpoint: ${endpoint}`
        );
    }

    return response.json();
}

export async function getProjectBaseUrl(token: string) {
    // No path returns the metadata for the specified project token
    const metadata = await callReadmeApi('', token);
    return metadata.baseUrl;
}

function getDocUrlForSlug(baseUrl: string, slug: string) {
    // The slug is the path to the document
    return `${baseUrl}/docs/${slug}`;
}

function getMarkdownForEndpoint(url: string, method: string) {
    return `**Endpoint**: ${url}\n**Method**: ${method}`;
}

function getMarkdownForPathParameters(params: APITypes.APIParameter[]) {
    return params.map((p) => {
        return `**${p.name}** ${p.type} ${p.required ? "required" : "optional"}\n${p.desc}`;
    }).join('\n\n');  

}

function getMarkdownForBodyPayloads(params: APITypes.APIParameter[]) {
    return params.map((p) => {
        return `**${p.name}** ${p.type}\n${p.desc}`;
    }).join('\n\n');

}

function getMarkdownForResponses(responses: APITypes.APIResults) {
    return responses?.codes?.sort((a, b) => a.status - b.status).map((r) => {    
        return `**${r.status}**\n${r.language}\n\`\`\`${r.code}\`\`\``;
    }).join('\n\n');
}

function convertAPIToMarkdown(api: APITypes.APIDefinition) {
    if (!api || !api.url) {
        return "";
    }    
    const endpoint = getMarkdownForEndpoint(api.url, api.method);
    const params = getMarkdownForPathParameters(api.params.filter((param) => param.in === 'path'));
    const payloads = getMarkdownForBodyPayloads(api.params.filter((param) => param.in === 'body'));
    const responses = getMarkdownForResponses(api.results);

    return `${endpoint}\n\n**PATH PARAMS**\n\n${params}\n\n**BODY PARAMS**\n\n${payloads}\n\n**RESPONSES**\n\n${responses}`;
}

export async function processDocsForCategory(
    token: string,
    baseDocUrl: string,
    categoryId: string,
    mavenAgi: MavenAGIClient,
    knowledgeBaseId: string
) {
    const docs = await callReadmeApi(`/categories/${categoryId}/docs`, token);
    console.log('Processing documents in category:', categoryId);

    for (const document of docs) {
        await processDocumentWithChildren(document, token, baseDocUrl, mavenAgi, knowledgeBaseId);
    }
}

export async function processDocumentWithChildren(
    document: any,
    token: string,
    baseDocUrl: string,
    mavenAgi: MavenAGIClient,
    knowledgeBaseId: string
) {
    // Process main document
    await processDoc(document, token, baseDocUrl, mavenAgi, knowledgeBaseId);

    // Process child documents
    for (const childDocument of document.children) {
        await processDoc(childDocument, token, baseDocUrl, mavenAgi, knowledgeBaseId);
    }
}

export async function processDoc(
    doc: any,
    token: string,
    baseDocUrl: string,
    mavenAgi: MavenAGIClient,
    knowledgeBaseId: string
) {
    // The docs in the category response do not contain all fields. So we must fetch the full doc.
    const fullReadmeDoc = await callReadmeApi(`/docs/${doc.slug}`, token);
    if (fullReadmeDoc.body) {
        console.log('Creating knowledge document for:', fullReadmeDoc.title);
        const body = fullReadmeDoc.body || "";
        const apiDoc = convertAPIToMarkdown(fullReadmeDoc.api);
        const content = `${body}${apiDoc ? `\n\n${apiDoc}`: ""}`;

        await mavenAgi.knowledge.createKnowledgeDocument(knowledgeBaseId, {
            title: fullReadmeDoc.title,
            content: content,
            contentType: 'MARKDOWN',
            url: getDocUrlForSlug(baseDocUrl, doc.slug),
            knowledgeDocumentId: { referenceId: doc.slug },
        });
    }
}
