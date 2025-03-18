import {MavenAGIClient, MavenAGI} from 'mavenagi';
import {inngest} from "@inngest/client";
import {callReadmeApi} from "@inngest/readme";
import {INNGEST_EVENT, KNOWLEDGE_BASE_ID} from "@inngest/constants";

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
      knowledgeBaseId: { referenceId: KNOWLEDGE_BASE_ID },
    });

    await inngest.send({
      name: INNGEST_EVENT,
      data: {
        organizationId,
        agentId,
        settings,
        knowledgeBaseId: KNOWLEDGE_BASE_ID
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
      name: INNGEST_EVENT,
      data: {
        organizationId,
        agentId,
        settings,
        knowledgeBaseId: KNOWLEDGE_BASE_ID
      }
    })
  },
};
