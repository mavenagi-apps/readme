/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {MavenAGI} from "mavenagi";
import {ProcessEventData} from "@/inngest/client";
import {InngestProcessingError} from "@/inngest/inngest-processing-error";
import {KNOWLEDGE_BASE_ID, KNOWLEDGE_BASE_NAME} from "@/lib/constants";
import { ConvertChunkResult } from "@/inngest/functions/kb-helpers";
import { DataSourceRateLimiter } from "@/lib/knowledge";
import { getCategories, getDocsForCategory, getDocument, getProjectDefaultBranch, convertAPIToMarkdown } from "@/lib/utils";

/*
 * Implement this to fetch metadata about your source
 * Or just return blank of no metadata is needed
 * This is the first step, before the ETL process
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchMetaDataAndSetup(eventData: ProcessEventData): Promise<Record<string, any>> {
    const { settings } = eventData;

    const defaultBranch = await DataSourceRateLimiter.schedule(() => getProjectDefaultBranch(settings.token));
    const categories = await DataSourceRateLimiter.schedule(() => getCategories(settings.token, defaultBranch));

    return {
        categories,
        defaultBranch,
        currentCategoryIndex: 0,
        currentDocumentIndex: 0,
        totalCategories: categories.length
    };
}



/*
 * Implement this to fetch a chunk of data from your source
 * This is the E in ETL
 */
export async function fetchData(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata: Record<string, any>,
    eventData: ProcessEventData,
    chunkSize: number
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ result: Record<string, any>[], updatedMetadata?: Record<string, any> }> {
    const { settings } = eventData;
    const { categories, defaultBranch, currentCategoryIndex = 0, currentDocumentIndex = 0 } = metadata;

    if (!categories || categories.length === 0 || currentCategoryIndex >= categories.length) {
        return { result: [], updatedMetadata: metadata };
    }

    const result: Record<string, any>[] = [];
    let categoryIndex = currentCategoryIndex;
    let documentIndex = currentDocumentIndex;

    while (result.length < chunkSize && categoryIndex < categories.length) {
        const category = categories[categoryIndex];
        
        const docs = await DataSourceRateLimiter.schedule(() => 
            getDocsForCategory(settings.token, category)
        );

        const remainingSlots = chunkSize - result.length;
        const docsToTake = docs.slice(documentIndex, documentIndex + remainingSlots);
        
        for (const doc of docsToTake) {
            try {
                const fullDoc = await DataSourceRateLimiter.schedule(() => 
                    getDocument(settings.token, doc.slug, doc.isReference, defaultBranch)
                );

                result.push(fullDoc);
            } catch (error) {
                console.error(`Skipping document ${doc.slug} due to API error`);
                // Continue processing other documents instead of failing entire job
            }
        }

        documentIndex += docsToTake.length;

        if (documentIndex >= docs.length) {
            categoryIndex++;
            documentIndex = 0;
        }

        if (docsToTake.length < remainingSlots) {
            break;
        }
    }

    return {
        result,
        updatedMetadata: {
            ...metadata,
            currentCategoryIndex: categoryIndex,
            currentDocumentIndex: documentIndex
        }
    };
}


/*
 * Implement this to convert your fetch results into MavenAGI.KnowledgeDocumentRequest objects
 * This is the T in ETL
 */
export async function convertToMavenDocuments(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fetchResult: Record<string, any>[],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    eventData: ProcessEventData,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata: Record<string, any>,
): Promise<ConvertChunkResult> {
    const documents: MavenAGI.KnowledgeDocumentRequest[] = [];
    const { baseUrl } = metadata;

    for (const doc of fetchResult) {
        let content: string = ((doc as any).content?.body || (doc as any).body || '') as string;
        
        if (doc.type === 'endpoint' && doc.api) {
            const apiContent = convertAPIToMarkdown(doc.api) || '';
            content = `${content}\n\n${apiContent}`;
        }

        // Skip documents with no content
        if (!content || content.trim() === '') {
            continue;
        }

        const documentUrl = doc.href?.hub;

        const mavenDoc: MavenAGI.KnowledgeDocumentRequest = {
            knowledgeDocumentId: { referenceId: doc._id || doc.id || doc.slug },
            title: doc.title || 'Untitled',
            content: content,
            contentType: MavenAGI.KnowledgeDocumentContentType.Markdown,
            url: documentUrl,
            metadata: {
                type: doc.type,
                category: typeof doc.category === 'object' ? doc.category?.title || doc.category?.name || 'unknown' : doc.category,
                categorySlug: doc.categorySlug,
                slug: doc.slug,
                version: doc.version,
                isReference: doc.isReference,
                hidden: doc.hidden,
                createdAt: doc.createdAt,
                updatedAt: doc.updatedAt
            }
        };

        documents.push(mavenDoc);
    }

    return {
        documents: documents,
        updatedMetadata: metadata
    };
}

/*
 * Implement this if you need to put a document in a specific KB based on metadata or document content
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
export function getMavenKBId(eventData: ProcessEventData, metadata: Record<string, any>, doc: MavenAGI.KnowledgeDocumentRequest): string {
    return `${KNOWLEDGE_BASE_ID}`;
}

/*
 * Implement this if you need multiple KBs, or return a single KB
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createMavenKBIds(_eventData: ProcessEventData, _metadata: Record<string, any>): any[] {
    return [
        {
            knowledgeBaseId: { referenceId: `${KNOWLEDGE_BASE_ID}` },
            name: `${KNOWLEDGE_BASE_NAME}`
        }
    ];
}


/*
 * Implement this to validate inputs early and fail the process if something is missing
 * or leave blank if not required
 */
export async function validateInputs(eventData: ProcessEventData) {
    const { organizationId, agentId, settings } = eventData;

    if(!organizationId) throw new InngestProcessingError('Organization ID is required');
    if(!agentId) throw new InngestProcessingError('Agent ID is required');

    if(!settings) throw new InngestProcessingError('Settings are required');
    if(!settings.token) throw new InngestProcessingError('README API token is required in settings');
    if (settings.token.trim() === '') {
        throw new InngestProcessingError('README API token must be a non-empty string');
    }
}