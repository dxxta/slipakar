import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { RouteDoc } from '../../domain/openapi/interface.js';
import { buildOpenApiDocument } from './document.js';

describe('buildOpenApiDocument', () => {
  it('builds top-level shape with openapi 3.1.0, info, securitySchemes, and Error schema', () => {
    const doc = buildOpenApiDocument([], { title: 'LokaSlip API', version: '1.0.0' });

    expect(doc.openapi).toBe('3.1.0');
    expect(doc.info).toEqual({ title: 'LokaSlip API', version: '1.0.0' });
    expect(doc.paths).toEqual({});
    expect(doc.components?.securitySchemes).toEqual({
      sessionCookie: {
        type: 'apiKey',
        in: 'cookie',
        name: 'better-auth.session_token',
      },
    });
    expect(doc.components?.schemas?.Error).toEqual({
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
    });
  });

  it('converts path parameters from :param to {param} and declares required string path parameters', () => {
    const routes: RouteDoc[] = [
      {
        method: 'get',
        path: '/projects/:projectId/smtp/:id',
        tag: 'SMTP',
        summary: 'Get SMTP connection',
        auth: 'session',
        status: 200,
      },
    ];

    const doc = buildOpenApiDocument(routes, { title: 'Test', version: '1.0.0' });
    const pathItem = doc.paths['/projects/{projectId}/smtp/{id}'];
    expect(pathItem).toBeDefined();

    const op = pathItem.get as Record<string, unknown>;
    expect(op.summary).toBe('Get SMTP connection');
    expect(op.tags).toEqual(['SMTP']);
    expect(op.parameters).toEqual([
      { name: 'projectId', in: 'path', required: true, schema: { type: 'string' } },
      { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
    ]);
  });

  it('generates unique stable operationIds across the document', () => {
    const routes: RouteDoc[] = [
      {
        method: 'get',
        path: '/projects/:projectId/smtp',
        tag: 'SMTP',
        summary: 'List',
        auth: 'session',
        status: 200,
      },
      {
        method: 'post',
        path: '/projects/:projectId/smtp',
        tag: 'SMTP',
        summary: 'Create',
        auth: 'session',
        status: 201,
      },
    ];

    const doc = buildOpenApiDocument(routes, { title: 'Test', version: '1.0.0' });
    const getOp = doc.paths['/projects/{projectId}/smtp'].get as Record<string, unknown>;
    const postOp = doc.paths['/projects/{projectId}/smtp'].post as Record<string, unknown>;

    expect(getOp.operationId).toBe('getProjectsProjectIdSmtp');
    expect(postOp.operationId).toBe('postProjectsProjectIdSmtp');
    expect(getOp.operationId).not.toBe(postOp.operationId);
  });

  it('applies error responses per rules: 401 (auth != public), 403 (auth == admin), 400 (has body or query), 404 (has path params)', () => {
    const routes: RouteDoc[] = [
      // 1. Session route with path params and body
      {
        method: 'post',
        path: '/projects/:projectId/items',
        tag: 'Items',
        summary: 'Create item',
        auth: 'session',
        status: 201,
        body: z.object({ name: z.string() }),
      },
      // 2. Admin route without path params
      {
        method: 'get',
        path: '/admin/config',
        tag: 'Admin',
        summary: 'Get config',
        auth: 'admin',
        status: 200,
      },
      // 3. Public route without body, query or path params
      {
        method: 'get',
        path: '/health-check',
        tag: 'Health',
        summary: 'Public check',
        auth: 'public',
        status: 200,
      },
    ];

    const doc = buildOpenApiDocument(routes, { title: 'Test', version: '1.0.0' });

    const itemOp = doc.paths['/projects/{projectId}/items'].post as Record<string, unknown>;
    const itemResponses = itemOp.responses as Record<string, unknown>;
    expect(itemResponses['401']).toBeDefined(); // non-public
    expect(itemResponses['403']).toBeUndefined(); // not admin
    expect(itemResponses['400']).toBeDefined(); // has body
    expect(itemResponses['404']).toBeDefined(); // has path param

    const adminOp = doc.paths['/admin/config'].get as Record<string, unknown>;
    const adminResponses = adminOp.responses as Record<string, unknown>;
    expect(adminResponses['401']).toBeDefined(); // non-public
    expect(adminResponses['403']).toBeDefined(); // admin
    expect(adminResponses['400']).toBeUndefined(); // no body or query
    expect(adminResponses['404']).toBeUndefined(); // no path param

    const publicOp = doc.paths['/health-check'].get as Record<string, unknown>;
    const publicResponses = publicOp.responses as Record<string, unknown>;
    expect(publicResponses['401']).toBeUndefined();
    expect(publicResponses['403']).toBeUndefined();
    expect(publicResponses['400']).toBeUndefined();
    expect(publicResponses['404']).toBeUndefined();
  });

  it('wraps success response in envelope {message, data, success: true}', () => {
    const dataSchema = z.object({ id: z.string(), name: z.string() });
    const routes: RouteDoc[] = [
      {
        method: 'get',
        path: '/items',
        tag: 'Items',
        summary: 'Get items',
        auth: 'public',
        status: 200,
        data: dataSchema,
      },
      {
        method: 'delete',
        path: '/items/:id',
        tag: 'Items',
        summary: 'Delete item',
        auth: 'public',
        status: 200,
      },
    ];

    const doc = buildOpenApiDocument(routes, { title: 'Test', version: '1.0.0' });

    const getResponses = (doc.paths['/items'].get as Record<string, unknown>).responses as Record<string, Record<string, unknown>>;
    const getEnvelope = (getResponses['200'].content as Record<string, Record<string, unknown>>)['application/json'].schema as Record<string, unknown>;
    expect(getEnvelope.type).toBe('object');
    expect(getEnvelope.properties).toHaveProperty('message');
    expect(getEnvelope.properties).toHaveProperty('success');
    expect(getEnvelope.properties).toHaveProperty('data');
    expect((getEnvelope.properties as Record<string, unknown>).data).not.toHaveProperty('$schema');

    // Null data envelope
    const deleteResponses = (doc.paths['/items/{id}'].delete as Record<string, unknown>).responses as Record<string, Record<string, unknown>>;
    const deleteEnvelope = (deleteResponses['200'].content as Record<string, Record<string, unknown>>)['application/json'].schema as Record<string, unknown>;
    expect((deleteEnvelope.properties as Record<string, unknown>).data).toEqual({ type: 'null' });
  });

  it('handles multipart operations with binary file field plus text fields', () => {
    const routes: RouteDoc[] = [
      {
        method: 'post',
        path: '/uploads',
        tag: 'Uploads',
        summary: 'Upload file',
        auth: 'session',
        status: 201,
        multipart: true,
        body: z.object({ kind: z.enum(['extra', 'generated']) }),
      },
    ];

    const doc = buildOpenApiDocument(routes, { title: 'Test', version: '1.0.0' });
    const op = doc.paths['/uploads'].post as Record<string, unknown>;
    const requestBody = op.requestBody as Record<string, unknown>;
    const content = requestBody.content as Record<string, Record<string, unknown>>;

    expect(content['multipart/form-data']).toBeDefined();
    const schema = content['multipart/form-data'].schema as Record<string, unknown>;
    const props = schema.properties as Record<string, unknown>;
    expect(props.file).toEqual({ type: 'string', format: 'binary' });
    expect(props.kind).toBeDefined();
    expect((schema.required as string[])).toContain('file');
  });

  it('applies security scheme only to non-public operations', () => {
    const routes: RouteDoc[] = [
      {
        method: 'get',
        path: '/secure',
        tag: 'Secure',
        summary: 'Secure',
        auth: 'session',
        status: 200,
      },
      {
        method: 'get',
        path: '/open',
        tag: 'Open',
        summary: 'Open',
        auth: 'public',
        status: 200,
      },
    ];

    const doc = buildOpenApiDocument(routes, { title: 'Test', version: '1.0.0' });
    const secureOp = doc.paths['/secure'].get as Record<string, unknown>;
    const openOp = doc.paths['/open'].get as Record<string, unknown>;

    expect(secureOp.security).toEqual([{ sessionCookie: [] }]);
    expect(openOp.security).toBeUndefined();
  });

  it('contains no password-like example values or $schema keys in output', () => {
    const schema = z.object({
      password: z.string(),
      passwordEncrypted: z.string(),
    });

    const routes: RouteDoc[] = [
      {
        method: 'post',
        path: '/test',
        tag: 'Test',
        summary: 'Test',
        auth: 'session',
        status: 200,
        body: schema,
      },
    ];

    const doc = buildOpenApiDocument(routes, { title: 'Test', version: '1.0.0' });
    const json = JSON.stringify(doc);
    expect(json).not.toContain('$schema');
    expect(json).not.toContain('secret123');
    expect(json).not.toContain('password123');
  });
});
