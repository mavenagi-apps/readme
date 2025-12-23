import { MavenAGIClient } from 'mavenagi';
import { getCategories, getProjectDefaultBranch } from '@/lib/utils';
import { refreshKnowledgeBase } from '@/lib/knowledge';

export default {
  async preInstall({ settings }) {
    console.log('Pre-Install');
    // Make sure the readme auth token works
    const defaultBranch = await getProjectDefaultBranch(settings.token);
    await getCategories(settings.token, defaultBranch);
  },

  async postInstall({ organizationId, agentId }) {
    console.log('Installing organization: ', organizationId);
    const mavenAgi = new MavenAGIClient({
      organizationId,
      agentId,
    });

    await refreshKnowledgeBase(mavenAgi, organizationId, agentId);
  },

  async knowledgeBaseRefreshed({ organizationId, agentId, knowledgeBaseId }) {
    console.log('Refresh request for ' + knowledgeBaseId.referenceId);
    
    const mavenAgi = new MavenAGIClient({
      organizationId,
      agentId,
    });

    await refreshKnowledgeBase(mavenAgi, organizationId, agentId, knowledgeBaseId.referenceId);
  },
};
