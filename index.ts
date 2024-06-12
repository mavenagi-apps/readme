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
      `Failed to fetch data from ReadMe API. Endpoint: ${endpoint}`
    );
  }

  return response.json();
}

export default {
  async preInstall({ settings }) {
    try {
      await callReadmeApi('/categories', settings.token);
    } catch (error) {
      throw new Error('Invalid ReadMe authentication token.');
    }
  },

  async postInstall({ organizationId, agentId, settings }) {
    const mavenAgi = new MavenAGIClient({ organizationId, agentId });

    try {
      const categories = await callReadmeApi('/categories', settings.token);

      for (const category of categories) {
        const knowledgeBase = await mavenAgi.knowledge.createKnowledgeBase({
          displayName: 'Readme: ' + category.title,
          type: MavenAGI.KnowledgeBaseType.Api,
          knowledgeBaseId: `readme-${category.slug}`,
        });
        const docs = await callReadmeApi(
          `/categories/${category.slug}/docs`,
          settings.token
        );

        for (const doc of docs) {
          await mavenAgi.knowledge.createKnowledgeDocument({
            knowledgeBaseId: knowledgeBase.knowledgeBaseId,
            title: doc.title,
            content: doc.body,
            documentId: doc.id,
            language: doc.language || 'en',
          });
        }

        await mavenAgi.knowledge.finalizeKnowledgeBaseVersion({
          knowledgeBaseId: knowledgeBase.knowledgeBaseId,
        });
      }
    } catch (error) {
      console.error('Error during postInstall process:', error);
    }
  },
};
