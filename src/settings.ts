import { z } from 'zod';

export const AppSettingsSchema = z.object({
  token: z.string(),
});