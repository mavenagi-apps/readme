/**
 *  Custom error class to carry knowledge base reference ids from inngest step failures to the error handler
 */
export class InngestProcessingError extends Error {
  public knowledgeBaseReferenceIds: string[];

  constructor(message: string, knowledgeBaseReferenceIds?: string[]) {
    super(message);
    this.name = 'InngestProcessingError';
    this.knowledgeBaseReferenceIds = knowledgeBaseReferenceIds || [];
  }
}
