import type { ZodType } from 'zod';

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

export type AuthType = 'session' | 'admin' | 'public';

export type RouteDoc = {
  method: HttpMethod;
  path: string; // Express style, e.g. /projects/:projectId/smtp/:id
  tag: string;
  summary: string;
  auth: AuthType;
  status: number; // The success status code, e.g. 200, 201, 202
  query?: ZodType;
  body?: ZodType;
  multipart?: boolean;
  data?: ZodType; // Schema of data in { message, data, success: true }, omit for null
};

export type OpenApiDocument = {
  openapi: string;
  info: {
    title: string;
    version: string;
  };
  paths: Record<string, Record<string, unknown>>;
  components?: {
    securitySchemes?: Record<string, unknown>;
    schemas?: Record<string, unknown>;
  };
  security?: Array<Record<string, unknown[]>>;
};
