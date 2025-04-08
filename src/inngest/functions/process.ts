import { inngest } from '@inngest/client';
import { MavenAGIClient } from 'mavenagi';
import { getProjectBaseUrl, callReadmeApi, processDocsForCategory } from '@inngest/readme';
import { INNGEST_EVENT } from '@inngest/constants';

export const processFunction = inngest.createFunction(
  {
    id: 'process',
  },
  {
    event: INNGEST_EVENT,
    concurrency: [
      {
        key: 'event.data.agentId',
        limit: 50,
      },
    ],
  },
  async ({ event, step }) => {
    const { organizationId, agentId, settings, knowledgeBaseId } = event.data;
    const mavenClient = new MavenAGIClient({ organizationId, agentId });
    const baseProjectUrl = await getProjectBaseUrl(settings.token);

    // Just in case we had a past failure, finalize any old versions so we can start from scratch
    // TODO(maven): Make the platform more lenient so this isn't necessary
    await step.run('finalize-knowledge-base-version', async () => {
      try {
        await mavenClient.knowledge.finalizeKnowledgeBaseVersion(knowledgeBaseId);
      } catch (error) {
        // Ignored
      }
    });

    // Make a new kb version
    await step.run('create-knowledge-base-version', async () => {
      await mavenClient.knowledge.createKnowledgeBaseVersion(knowledgeBaseId, {
        type: 'FULL',
      });
    });

    // Fetch and save all readme articles to the kb
    // Readme only allows fetching docs from within a category so we loop over each one
    const categories = await step.run('process-categories', async () => {
      let page = 1;
      let hasMorePages = true;
      let fetchedCategories = [];

      while (hasMorePages) {
        console.log('Fetching categories page', page);
        const res: [] = await callReadmeApi(`/categories?perPage=100&page=${page}`, settings.token);
        fetchedCategories.push(...res);
        console.log('Categories: ', fetchedCategories);
        hasMorePages = res.length > 0;
        page++;
      }
      console.log('Processed categories: ', fetchedCategories);
      return fetchedCategories;
    });

    // Process each category
    if (categories.length === 0) {
      throw new Error('No categories found');
    } else {
      for (const category of categories) {
        await step.run('process-documents', async () => {
          const { slug }: any = category;
          await processDocsForCategory(
            settings.token,
            baseProjectUrl,
            slug,
            mavenClient,
            knowledgeBaseId
          );
        });
      }
    }

    // Finalize the version
    await step.run('finalize-knowledge-base-version-final', async () => {
      console.log('Finished processing all articles');
      await mavenClient.knowledge.finalizeKnowledgeBaseVersion(knowledgeBaseId);
    });
  }
);
