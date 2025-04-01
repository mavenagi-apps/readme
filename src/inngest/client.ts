import { EventSchemas, Inngest } from "inngest";
import { z } from "zod";

// TODO: Should we set this in an env variable or compute it from the appId?
const INNGEST_ID = "app/readme-develop";
// const INNGEST_ID = "app/readme";

export const inngest = new Inngest({
    id: INNGEST_ID,
    schemas: new EventSchemas().fromZod({
        [`${INNGEST_ID}/process`]: {
            data: z.object({
                organizationId: z.string(),
                agentId: z.string(),
                settings: z.object({
                    token: z.string()
                }),
                knowledgeBaseId: z.string()
            }),
        },
    }),
});