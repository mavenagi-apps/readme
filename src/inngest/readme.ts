import {MavenAGIClient} from "mavenagi";
import {README_API_BASE_URL} from "@inngest/constants";


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

    console.log('Successful Readme API call for ' + endpoint);
    console.log('Response:', response);
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

export async function processDocsForCategory(
    mavenAgi: MavenAGIClient,
    token: string,
    baseDocUrl: string,
    categoryId: string,
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
        await mavenAgi.knowledge.createKnowledgeDocument(knowledgeBaseId, {
            title: fullReadmeDoc.title,
            content: fullReadmeDoc.body,
            contentType: 'MARKDOWN',
            url: getDocUrlForSlug(baseDocUrl, doc.slug),
            knowledgeDocumentId: { referenceId: doc.slug },
        });
    }
}
