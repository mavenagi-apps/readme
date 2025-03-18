import { EventSchemas, Inngest } from "inngest";
import { z } from "zod";

export const inngest = new Inngest({
    id: "app/readme-develop",
    schemas: new EventSchemas().fromZod({
        "app/readme-develop/process": {
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