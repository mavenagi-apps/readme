import { serve } from "inngest/next";
import { inngest } from "../../../inngest/client";
import { processFunction } from "../../../inngest/functions/process";

export const maxDuration = 900;

export const { GET, POST, PUT } = serve({
    client: inngest,
    functions: [processFunction],
});