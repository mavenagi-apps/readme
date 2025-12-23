import { EventSchemas, Inngest } from "inngest";
import { z } from "zod";
import {AppSettingsSchema} from "@/settings";


export const processEventDataSchema = z.object({
    organizationId: z.string(),
    agentId: z.string(),
    knowledgeBaseId: z.string().optional(),
    settings: AppSettingsSchema,
});

export type ProcessEventData = z.infer<typeof processEventDataSchema>;

export const inngest = new Inngest({
  id: `app/${process.env.MAVENAGI_APP_ID}`,
  schemas: new EventSchemas().fromZod({
      [`app/${process.env.MAVENAGI_APP_ID}/process`]: {
          data: processEventDataSchema,
    },
  }),
});
