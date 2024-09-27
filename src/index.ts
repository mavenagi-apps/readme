import { MavenAGIClient, MavenAGI } from 'mavenagi';

const README_API_BASE_URL = 'https://dash.readme.com/api/v1';

async function callReadmeApi(path: string, token: string) {
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
  return response.json();
}

async function processDocsForCategory(
  mavenAgi: MavenAGIClient,
  token: string,
  categoryId: string,
  knowledgeBaseId: string
) {
  const docs = await callReadmeApi(`/categories/${categoryId}/docs`, token);

  for (const doc of docs) {
    // The docs in the category response do not contain all fields. So we must fetch the full doc.
    const fullReadmeDoc = await callReadmeApi(`/docs/${doc.slug}`, token);

    await mavenAgi.knowledge.createKnowledgeDocument(knowledgeBaseId, {
      title: fullReadmeDoc.title,
      content: fullReadmeDoc.body,
      contentType: 'MARKDOWN',
      knowledgeDocumentId: { referenceId: doc.slug },
    });
  }
}

async function refreshDocumentsFromReadme(
  mavenAgi: MavenAGIClient,
  token: string,
  knowledgeBaseId: string
) {
  // Just in case we had a past failure, finalize any old versions so we can start from scratch
  // TODO(maven): Make the platform more lenient so this isn't necessary
  try {
    await mavenAgi.knowledge.finalizeKnowledgeBaseVersion(knowledgeBaseId);
  } catch (error) {
    // Ignored
  }

  // Make a new kb version
  await mavenAgi.knowledge.createKnowledgeBaseVersion(knowledgeBaseId, {
    type: 'FULL',
  });

  // Fetch and save all readme articles to the kb
  // Readme only allows fetching docs from within a category so we loop over each one
  const categories = await callReadmeApi('/categories', token);
  for (const category of categories) {
    await processDocsForCategory(mavenAgi, token, category.slug, 'readme');
    console.log('Finished processing category ' + category.slug);
  }

  // Finalize the version
  console.log('Finished processing all articles');
  await mavenAgi.knowledge.finalizeKnowledgeBaseVersion(knowledgeBaseId);
}

export default {
  async preInstall({ settings }) {
    // Make sure the readme auth token works
    await callReadmeApi('/categories', settings.token);
  },

  async postInstall({ organizationId, agentId, settings }) {
    const mavenAgi = new MavenAGIClient({
      organizationId,
      agentId,
    });

    // Make one maven knowledge base for readme
    await mavenAgi.knowledge.createOrUpdateKnowledgeBase({
      name: 'ReadMe',
      type: MavenAGI.KnowledgeBaseType.Api,
      knowledgeBaseId: { referenceId: 'readme' },
    });
    await refreshDocumentsFromReadme(mavenAgi, settings.token, 'readme');
  },

  async knowledgeBaseRefreshed({
    organizationId,
    agentId,
    knowledgeBaseId,
    settings,
  }) {
    console.log('Refresh request for ' + knowledgeBaseId.referenceId);
    const mavenAgi = new MavenAGIClient({ organizationId, agentId });

    // If we get a refresh request, create a new version for the knowledge base and add documents
    await refreshDocumentsFromReadme(
      mavenAgi,
      settings.token,
      knowledgeBaseId.referenceId
    );
  },
};
