import { FailureEventPayload } from 'inngest';
import { MavenAGIClient, MavenAGI } from 'mavenagi';
import { InngestProcessingError } from '../inngest-processing-error';

/**
 * Function to handle errors from inngest step run failures
 * @returns
 */
export async function onFailure({
  error,
  event,
}: {
  error: Error;
  event: FailureEventPayload;
}) {
  const originalEventData = event.data.event.data;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { organizationId, agentId, settings, knowledgeBaseId } =
    originalEventData;

  console.error('Process function failed:', {
    error: error.message,
    runId: event.data.run_id,
    functionId: event.data.function_id,
    organizationId,
    agentId,
    knowledgeBaseId,
  });

  // Create a new platform client for cleanup operations
  const platform = new MavenAGIClient({ organizationId, agentId });

  // Check if the error contains knowledge base reference IDs
  let referenceIdsToCleanup: string[] = [];

  if (
    error instanceof InngestProcessingError &&
    error.knowledgeBaseReferenceIds.length > 0
  ) {
    // Use the reference IDs from the custom error
    referenceIdsToCleanup = error.knowledgeBaseReferenceIds;
    console.log('Found reference IDs in error:', referenceIdsToCleanup);
  } else {
    console.warn('No knowledge base reference IDs available for cleanup');
    return;
  }

  // Mark all relevant knowledge bases as failed
  for (const referenceId of referenceIdsToCleanup) {
    try {
      await platform.knowledge.finalizeKnowledgeBaseVersion(referenceId, {
        status: MavenAGI.KnowledgeBaseVersionFinalizeStatus.Failed,
        errorMessage: error.message,
      });
      console.log(`Marked knowledge base ${referenceId} as failed`);
    } catch (cleanupError) {
      console.error(
        `Failed to cleanup knowledge base ${referenceId}:`,
        cleanupError
      );
    }
  }
}
