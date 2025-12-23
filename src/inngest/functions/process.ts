import {inngest, ProcessEventData} from "@/inngest/client";
import {onFailure} from "@/inngest/functions/on-failure";
import {
    fetchMetaDataAndSetup,
    fetchData,
    convertToMavenDocuments,
    createMavenKBIds,
    validateInputs,
    getMavenKBId
} from "@/knowledge-hooks";
import { AppSettingsSchema } from "@/settings";
import {
    createKnowledgeBaseWithInngest,
    finalizeKnowledgeBaseVersionWithInngest,
} from "@/inngest/functions/kb-helpers";
import {MavenAGI, MavenAGIClient} from "mavenagi";
import {InngestProcessingError} from "@/inngest/inngest-processing-error";
import Bottleneck from "bottleneck";
import { eld } from 'eld';

const mavenApiLimiter = new Bottleneck({
    maxConcurrent: Number.parseInt(process.env.MAVEN_API_RATELIMIT ?? '20'),
    minTime: 200,
});

export const processFunction = inngest.createFunction(
    {
        id: "process",
        onFailure: onFailure,
    },
    {
        event: `app/${process.env.MAVENAGI_APP_ID}/process`,
        concurrency: [
            {
                key: "event.data.agentId",
                limit: parseInt(process.env.CONCURRENT_EXECUTIONS || '50')
            }
        ],
        retries: parseInt(process.env.MAX_RETRIES || '10'),
    },
    async ({ event, step }) => {
        const { organizationId, agentId, settings } = event.data;

        // Validate settings schema
        const validationResult = AppSettingsSchema.safeParse(settings);
        if (!validationResult.success) {
            console.error("Invalid settings:", validationResult.error.format());
            throw new InngestProcessingError(`Settings validation failed: ${validationResult.error.message}`, []);
        }

        // Validate inputs
        await step.run("validate-inputs", () => validateInputs(event.data));

        // Fetch all metadata
        const retrievedMetaData = await step.run("fetch-metadata", () => fetchMetaDataAndSetup(event.data)) ?? {};

        // Initialize state
        // state can contain any data you want to persist between steps
        // can be useful for reporting back counts, when this becomes available
        const state = {
            metadata: retrievedMetaData,
            numProcessed: 0
        };

        // Create KB values
        const KBValues = await step.run("create-kb-values", () => createMavenKBIds(event.data, state.metadata));

        // Create the knowledge bases
        await createKnowledgeBaseWithInngest(
            organizationId,
            agentId,
            KBValues,
            undefined,
            step
        );

        let chunkIndex = 0;
        while (true) {

            const { localMetadata, numDocuments } = await step.run(`process-chunk-${chunkIndex}`, async () => {
                let localMetadata = state.metadata;

                const fetchDataResult = await fetchData(localMetadata, event.data as ProcessEventData, parseInt(process.env.DEFAULT_CHUNK_SIZE || '50'));
                localMetadata = fetchDataResult.updatedMetadata ?? localMetadata;

                console.info(`Fetched ${fetchDataResult.result.length} records in chunk ${chunkIndex + 1}`);

                const convertResult = await convertToMavenDocuments(fetchDataResult.result, event.data, localMetadata);
                localMetadata = convertResult.updatedMetadata ?? localMetadata;

                console.info(`Converted ${convertResult.documents.length} documents in chunk ${chunkIndex + 1}`);

                const client = new MavenAGIClient({ organizationId, agentId });
                await Promise.all((convertResult.documents as MavenAGI.KnowledgeDocumentRequest[]).map(doc => {
                    return mavenApiLimiter.schedule(async () => {
                        const kbId = getMavenKBId(event.data, state.metadata, doc);
                        if (!kbId) {
                            console.log(`No KB ID value found for document ${doc.knowledgeDocumentId.referenceId}, skipping`);
                            return;
                        }
                        if(!doc.language && doc.content) {
                            const utf8Content = Buffer.from(doc.content, 'utf8').toString('utf8');
                            const detectedLanguage = eld.detect(utf8Content).language;
                            doc.language = detectedLanguage || 'en';
                        }
                        try {
                            await client.knowledge.createKnowledgeDocument(kbId, doc);
                        } catch (error) {
                            console.log(`Failed to save document ${doc.knowledgeDocumentId.referenceId}: ${error instanceof Error ? error.message : String(error)}`);
                        }
                    });
                }));

                console.info(`Created ${convertResult.documents.length} Maven documents in chunk ${chunkIndex + 1}`);

                return { localMetadata, numDocuments: fetchDataResult.result.length };
            });

            if(numDocuments === 0) {
                // we are done
                break;
            }

            state.metadata = localMetadata;
            state.numProcessed += numDocuments;
            chunkIndex++;
        }

        await finalizeKnowledgeBaseVersionWithInngest(
            organizationId,
            agentId,
            KBValues,
            undefined,
            step
        );
    }
);
