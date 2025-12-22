import { MavenAGIClient } from "mavenagi";
import { inngest } from "@/inngest/client";
import Bottleneck from "bottleneck";

/*
 * Any interface definitions used in knowledge base processing
 */

export interface ReadmeCategory {
  title: string;
  section: string;
  links: {
    project: string;
  };
  uri: string;
}

export interface ReadmeDocument {
  _id: string;
  title: string;
  slug: string;
  body: string;
  excerpt?: string;
  type: 'basic' | 'endpoint' | 'link';
  api?: APIDefinition;
  category: string;
  categorySlug: string;
  order: number;
  hidden: boolean;
  createdAt: string;
  updatedAt: string;
  version: string;
  isReference: boolean;
}


export type HTTPMethod = 'get' | 'post' | 'put' | 'delete' | 'patch';

export interface APIResponseCode {
  name: string;
  code: string;
  language: string;
  status: number;
}

export interface APIParameter {
  name: string;
  type: string;
  enumValues: string;
  default: string;
  desc: string;
  required: boolean;
  in: 'path' | 'body';
  ref: string;
  _id: string;
}

export interface APIResults {
  codes: APIResponseCode[];
}

export interface APIExamples {
  codes: unknown[];
}

export interface APIDefinition {
  method: HTTPMethod;
  url: string;
  auth: 'required' | 'optional';
  results: APIResults;
  params: APIParameter[];
  examples: APIExamples;
  apiSetting: string;
}


export const DataSourceRateLimiter = new Bottleneck({
    maxConcurrent: Number.parseInt(process.env.DATASOURCE_RATE_LIMIT ?? '1'),
    minTime: Number.parseInt(process.env.DATASOURCE_REQUEST_DELAY ?? '1000'),
});

export const refreshKnowledgeBase = async (
    client: MavenAGIClient,
    organizationId: string,
    agentId: string,
    knowledgeBaseId?: string
) => {
    const settings: AppSettings = (await client.appSettings.get()) as unknown as AppSettings;
    console.info('Submitting refresh articles job with params:', {
        organizationId,
        agentId,
        settings,
    });
    await inngest.send({
        name: `app/${process.env.MAVENAGI_APP_ID}/process`,
        data: {
            organizationId,
            agentId,
            knowledgeBaseId: knowledgeBaseId ? knowledgeBaseId : undefined,
            settings,
        },
    });
}