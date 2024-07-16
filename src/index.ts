import { MavenAGIClient } from 'mavenagi';

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
  knowledgeBaseId: string
) {
  const docs = await callReadmeApi(
    `/categories/${knowledgeBaseId}/docs`,
    token
  );

  for (const doc of docs) {
    const fullReadmeDoc = await callReadmeApi(`/docs/${doc.slug}`, token);

    await mavenAgi.knowledge.createKnowledgeDocument(knowledgeBaseId, {
      title: fullReadmeDoc.title,
      content: fullReadmeDoc.body,
      contentType: 'MARKDOWN',
      knowledgeDocumentId: { referenceId: doc.slug },
    });
  }

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

    // Make a maven knowledge base for each readme category
    // We're using the readme category slug as the knowledge base id to make Readme API calls easy
    const categories = await callReadmeApi('/categories', settings.token);

    for (const category of categories) {
      const knowledgeBase =
        await mavenAgi.knowledge.createOrUpdateKnowledgeBase({
          name: 'Readme: ' + category.title,
          type: 'API',
          knowledgeBaseId: { referenceId: category.slug },
        });

      // Add documents to the knowledge base
      await processDocsForCategory(
        mavenAgi,
        settings.token,
        knowledgeBase.knowledgeBaseId.referenceId
      );
    }
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
    await mavenAgi.knowledge.createKnowledgeBaseVersion(
      knowledgeBaseId.referenceId,
      {
        type: 'FULL',
      }
    );
    await processDocsForCategory(
      mavenAgi,
      settings.token,
      knowledgeBaseId.referenceId
    );
  },
};
