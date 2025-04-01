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