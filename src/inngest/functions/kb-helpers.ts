import { MavenAGI, MavenAGIClient } from 'mavenagi';
import { InngestProcessingError } from '../inngest-processing-error';
import { createStepTools } from 'inngest/components/InngestStepTools';


export type KBValues = {
    knowledgeBaseId: { referenceId: string };
    name: string;
};

export interface ConvertChunkResult {
    documents: MavenAGI.KnowledgeDocumentRequest[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updatedMetadata?: Record<string, any>;
}


/**
 * Helper function to finalize a list of knowledge bases when running in inngest steps
 * @param client - The MavenAGIClient instance
 * @param kbValues - The KBValues to finalize
 * @param knowledgeBaseId - The knowledge base ID to finalize
 * @param step - The step instance
 */
export async function finalizeKnowledgeBaseVersionWithInngest(
  organizationId: string,
  agentId: string,
  kbs: KBValues[],
  knowledgeBaseId: string | undefined,
  step: ReturnType<typeof createStepTools>
) {
  const client = new MavenAGIClient({organizationId, agentId});
  const kbsToFinalize = kbs.filter(
    (kb) =>
      !knowledgeBaseId || kb.knowledgeBaseId.referenceId === knowledgeBaseId
  );

  // Finalize the knowledge revisions
  try {
    for (const kb of kbsToFinalize) {
      // if knowledgeBaseId is set, we are updating a specific knowledge base
      // ignore all other KBs
      await step.run(
        `finalize-knowledge-revision-${kb.knowledgeBaseId.referenceId}`,
        async () => {
          try {
            console.info(`Finalizing KB ${kb.name}`);
            await client.knowledge.finalizeKnowledgeBaseVersion(
              kb.knowledgeBaseId.referenceId,
              {
                status: MavenAGI.KnowledgeBaseVersionFinalizeStatus.Succeeded,
              }
            );
          } catch (error) {
            throw new InngestProcessingError(
              `Failed to finalize knowledge base ${kb.name}: ${error instanceof Error ? error.message : String(error)}`,
              [kb.knowledgeBaseId.referenceId]
            );
          }
        }
      );
    }
  } catch (error) {
    if (error instanceof InngestProcessingError) {
      throw error;
    }
    // Wrap other errors with all processing KB reference IDs
    throw new InngestProcessingError(
      `Knowledge base finalization failed: ${error instanceof Error ? error.message : String(error)}`,
      kbsToFinalize.map((kb) => kb.knowledgeBaseId.referenceId)
    );
  }
}

/**
 * Helper function to create a list of knowledge bases when running in inngest steps
 * @param client
 * @param kbs
 * @param knowledgeBaseId
 * @param step
 */
export async function createKnowledgeBaseWithInngest(
  organizationId: string,
  agentId: string,
  kbs: KBValues[],
  knowledgeBaseId: string | undefined,
  step: ReturnType<typeof createStepTools>
) {
  const client = new MavenAGIClient({organizationId, agentId});
  // Create knowledge base values
  const kbsToCreate = kbs.filter(
    (kb) =>
      !knowledgeBaseId || kb.knowledgeBaseId.referenceId === knowledgeBaseId
  );

  try {
    for (const kb of kbsToCreate) {
      // if knowledgeBaseId is set, we are updating a specific knowledge base
      // ignore all other KBs
      if (
        knowledgeBaseId &&
        kb.knowledgeBaseId.referenceId !== knowledgeBaseId
      ) {
        continue;
      }

      // Create the knowledge base
      await step.run(`create-knowledge-base-${kb.knowledgeBaseId.referenceId}`, async () => {
        try {
          const kbRequest = {
            ...kb,
            metadata: {},
          };
          await client.knowledge.createOrUpdateKnowledgeBase(kbRequest);
        } catch (error) {
          throw new InngestProcessingError(
            `Failed to create knowledge base ${kb.name}: ${error instanceof Error ? error.message : String(error)}`,
            [kb.knowledgeBaseId.referenceId]
          );
        }
      });

      // Create knowledge revision
      await step.run(`create-knowledge-revision-${kb.knowledgeBaseId.referenceId}`, async () => {
        try {
          await client.knowledge.createKnowledgeBaseVersion(
            kb.knowledgeBaseId.referenceId,
            {
              type: MavenAGI.KnowledgeBaseVersionType.Full,
            }
          );
        } catch (error) {
          throw new InngestProcessingError(
            `Failed to create knowledge revision for ${kb.name}: ${error instanceof Error ? error.message : String(error)}`,
            [kb.knowledgeBaseId.referenceId]
          );
        }
      });
    }
  } catch (error) {
    if (error instanceof InngestProcessingError) {
      // Re-throw InngestProcessingError as-is
      throw error;
    }
    // Wrap other errors with all processing KB reference IDs
    throw new InngestProcessingError(
      `Knowledge base setup failed: ${error instanceof Error ? error.message : String(error)}`,
      kbsToCreate.map((kb) => kb.knowledgeBaseId.referenceId)
    );
  }
}
