/*
 * Any common utility functions should go in here
 */
import { README_API_BASE_URL } from '@/lib/constants';
import { APIDefinition, APIParameter, APIResults, ReadmeCategory, ReadmeDocument } from '@/lib/knowledge';

export async function callReadmeApi(path: string, token: string) {
  const endpoint = `${README_API_BASE_URL}${path}`;

  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`README API Error - Status: ${response.status}, Endpoint: ${endpoint}, Response: ${errorBody}`);
    throw new Error(`Failed to fetch data from Readme API. Endpoint: ${endpoint}, Status: ${response.status}`);
  }

  return response.json();
}

export async function getCategories(token: string, defaultBranch: string): Promise<ReadmeCategory[]> {
  const response = await callReadmeApi(`/branches/${defaultBranch}/categories/guides`, token);
  return response.data || response;
}

export async function getProjectDefaultBranch(token: string) {
  const metadata = await callReadmeApi('/projects/me', token);
  return metadata.default_version?.name || 'stable';
}


function getMarkdownForEndpoint(url: string, method: string) {
  return `**Endpoint**: ${url}\n**Method**: ${method}`;
}

function getMarkdownForPathParameters(params: APIParameter[]) {
  return params
    ?.map((p) => {
      return `**${p.name}** ${p.type} ${p.required ? 'required' : 'optional'}\n${p.desc}`;
    })
    .join('\n\n') || '';
}

function getMarkdownForBodyPayloads(params: APIParameter[]) {
  return params
    ?.map((p) => {
      return `**${p.name}** ${p.type}\n${p.desc}`;
    })
    .join('\n\n') || '';
}

function getMarkdownForResponses(responses: APIResults) {
  return responses?.codes
    ?.sort((a, b) => a.status - b.status)
    .map((r) => {
      return `**${r.status}**\n${r.language}\n\`\`\`${r.code}\`\`\``;
    })
    .join('\n\n') || '';
}

export async function getDocsForCategory(token: string, category: ReadmeCategory): Promise<ReadmeDocument[]> {
  let allDocs: ReadmeDocument[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await callReadmeApi(
      `${category.uri}/pages?page=${page}&per_page=100`, 
      token
    );
    
    const docs = response.data || response;
    allDocs = allDocs.concat(docs);
    
    // Check if there are more pages
    hasMore = response.paging?.next != null;
    page++;
  }

  return allDocs;
}

export async function getDocument(token: string, slug: string, isReference?: boolean, defaultBranch?: string): Promise<ReadmeDocument> {
  const branch = defaultBranch || 'stable';
  const endpoint = isReference ? `/branches/${branch}/reference/${slug}` : `/branches/${branch}/guides/${slug}`;
  const doc = await callReadmeApi(endpoint, token);
  return doc.data || doc;
}

export function getDocUrlForSlug(baseUrl: string, slug: string): string {
  return `${baseUrl}/docs/${slug}`;
}

export function convertAPIToMarkdown(api: APIDefinition): string {
  if (!api || !api.url) {
    return '';
  }
  const endpoint = getMarkdownForEndpoint(api.url, api.method);
  const params = getMarkdownForPathParameters((api.params || []).filter((param) => param.in === 'path'));
  const payloads = getMarkdownForBodyPayloads((api.params || []).filter((param) => param.in === 'body'));
  const responses = getMarkdownForResponses(api.results);

  return `${endpoint}\n\n**PATH PARAMS**\n\n${params}\n\n**BODY PARAMS**\n\n${payloads}\n\n**RESPONSES**\n\n${responses}`;
}

