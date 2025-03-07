import { MavenAGIClient, MavenAGI } from 'mavenagi';
import {inngest} from "./inngest/client";
import { callReadmeApi } from "./utils";

export default {
  async preInstall({ settings }) {
    console.log('Pre-Install');
    // Make sure the readme auth token works
    await callReadmeApi('/categories', settings.token);
  },

  async postInstall({ organizationId, agentId, settings }) {
    console.log('Installing organization: ', organizationId);
    const mavenAgi = new MavenAGIClient({
      organizationId,
      agentId,
    });

    // Make one maven knowledge base for readme-develop
    await mavenAgi.knowledge.createOrUpdateKnowledgeBase({
      name: 'ReadMe',
      type: MavenAGI.KnowledgeBaseType.Api,
      knowledgeBaseId: { referenceId: 'readme' },
    });

    await inngest.send({
      name: 'app/readme-develop/process',
      data: {
        organizationId,
        agentId,
        settings,
        knowledgeBaseId: 'readme'
      }
    })
  },

  async knowledgeBaseRefreshed({
    organizationId,
    agentId,
    knowledgeBaseId,
    settings,
  }) {
    console.log('Refresh request for ' + knowledgeBaseId.referenceId);

    // If we get a refresh request, create a new version for the knowledge base and add documents
    await inngest.send({
      name: 'app/readme-develop/process',
      data: {
        organizationId,
        agentId,
        settings,
        knowledgeBaseId: 'readme'
      }
    })
  },
};
