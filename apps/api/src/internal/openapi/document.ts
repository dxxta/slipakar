import { z, type ZodType } from 'zod';
import type { OpenApiDocument, RouteDoc } from '../../domain/openapi/interface.js';

function stripSchemaKey(schemaObj: unknown): unknown {
  if (!schemaObj || typeof schemaObj !== 'object') return schemaObj;
  if (Array.isArray(schemaObj)) {
    return schemaObj.map(stripSchemaKey);
  }
  const copy: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schemaObj as Record<string, unknown>)) {
    if (key === '$schema') continue;
    copy[key] = stripSchemaKey(value);
  }
  return copy;
}

function toJsonSchemaClean(zodSchema: ZodType): Record<string, unknown> {
  const raw = z.toJSONSchema(zodSchema, { target: 'draft-2020-12' });
  return stripSchemaKey(raw) as Record<string, unknown>;
}

function convertPath(expressPath: string): { openApiPath: string; pathParams: string[] } {
  const pathParams: string[] = [];
  const openApiPath = expressPath.replace(/:([a-zA-Z0-9_]+)/g, (_, paramName) => {
    pathParams.push(paramName);
    return `{${paramName}}`;
  });
  return { openApiPath, pathParams };
}

function toOperationId(method: string, path: string): string {
  // Convert /projects/:projectId/smtp/:id to getProjectsProjectIdSmtpId
  const cleanParts = path
    .split('/')
    .filter(Boolean)
    .map((part) => {
      const paramName = part.startsWith(':') ? part.slice(1) : part;
      // Capitalize first letter of each part
      return paramName.charAt(0).toUpperCase() + paramName.slice(1);
    });
  return method.toLowerCase() + cleanParts.join('');
}

export function buildOpenApiDocument(
  routes: RouteDoc[],
  info: { title: string; version: string },
): OpenApiDocument {
  const paths: Record<string, Record<string, unknown>> = {};
  const usedOperationIds = new Set<string>();

  for (const route of routes) {
    const { openApiPath, pathParams } = convertPath(route.path);
    if (!paths[openApiPath]) {
      paths[openApiPath] = {};
    }

    let opId = toOperationId(route.method, route.path);
    if (usedOperationIds.has(opId)) {
      let counter = 2;
      while (usedOperationIds.has(`${opId}${counter}`)) {
        counter++;
      }
      opId = `${opId}${counter}`;
    }
    usedOperationIds.add(opId);

    const parameters: Array<Record<string, unknown>> = [];

    // Path parameters
    for (const param of pathParams) {
      parameters.push({
        name: param,
        in: 'path',
        required: true,
        schema: { type: 'string' },
      });
    }

    // Query parameters
    if (route.query) {
      const querySchema = toJsonSchemaClean(route.query);
      const properties = (querySchema.properties as Record<string, unknown>) ?? {};
      const requiredList = (querySchema.required as string[]) ?? [];
      for (const [propName, propSchema] of Object.entries(properties)) {
        parameters.push({
          name: propName,
          in: 'query',
          required: requiredList.includes(propName),
          schema: propSchema,
        });
      }
    }

    // Request body
    let requestBody: Record<string, unknown> | undefined;
    if (route.multipart) {
      let bodyProps: Record<string, unknown> = {};
      let requiredProps: string[] = ['file'];

      if (route.body) {
        const bodySchema = toJsonSchemaClean(route.body);
        bodyProps = (bodySchema.properties as Record<string, unknown>) ?? {};
        const reqList = (bodySchema.required as string[]) ?? [];
        requiredProps = [...new Set([...requiredProps, ...reqList])];
      }

      bodyProps.file = { type: 'string', format: 'binary' };

      requestBody = {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              properties: bodyProps,
              required: requiredProps,
            },
          },
        },
      };
    } else if (route.body) {
      requestBody = {
        required: true,
        content: {
          'application/json': {
            schema: toJsonSchemaClean(route.body),
          },
        },
      };
    }

    // Responses
    const dataSchema = route.data ? toJsonSchemaClean(route.data) : { type: 'null' };
    const successEnvelopeSchema = {
      type: 'object',
      properties: {
        message: { type: 'string' },
        data: dataSchema,
        success: { type: 'boolean', const: true },
      },
      required: ['message', 'data', 'success'],
      additionalProperties: false,
    };

    const responses: Record<string, unknown> = {
      [String(route.status)]: {
        description: 'Success response',
        content: {
          'application/json': {
            schema: successEnvelopeSchema,
          },
        },
      },
    };

    // Error responses per rules:
    // 400 when it has a body or query
    if (route.body || route.query || route.multipart) {
      responses['400'] = {
        description: 'Validation or client error',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      };
    }

    // 401 when auth is not public
    if (route.auth !== 'public') {
      responses['401'] = {
        description: 'Authentication required',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      };
    }

    // 403 when auth is admin
    if (route.auth === 'admin') {
      responses['403'] = {
        description: 'Admin permission required',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      };
    }

    // 404 when its path has path params
    if (pathParams.length > 0) {
      responses['404'] = {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      };
    }

    const operation: Record<string, unknown> = {
      operationId: opId,
      summary: route.summary,
      tags: [route.tag],
      responses,
    };

    if (parameters.length > 0) {
      operation.parameters = parameters;
    }
    if (requestBody) {
      operation.requestBody = requestBody;
    }
    if (route.auth !== 'public') {
      operation.security = [{ sessionCookie: [] }];
    }

    paths[openApiPath][route.method.toLowerCase()] = operation;
  }

  return {
    openapi: '3.1.0',
    info,
    paths,
    components: {
      securitySchemes: {
        sessionCookie: {
          type: 'apiKey',
          in: 'cookie',
          name: 'better-auth.session_token',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
                details: {},
              },
              required: ['code', 'message'],
              additionalProperties: false,
            },
          },
          required: ['error'],
          additionalProperties: false,
        },
      },
    },
  };
}
