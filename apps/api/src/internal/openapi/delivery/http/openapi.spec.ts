import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildOpenApiDocument } from '../../document.js';
import { allRouteDocs } from '../../routes/index.js';
import { createOpenApiRouter } from './openapi.js';

describe('OpenAPI HTTP router', () => {
  const document = buildOpenApiDocument(allRouteDocs, {
    title: 'Slipakar API',
    version: '1.0.0',
  });

  const app = express();
  app.use(createOpenApiRouter({ document }));

  it('GET /openapi.json returns the OpenAPI 3.1 document with Cache-Control no-store', async () => {
    const res = await request(app).get('/openapi.json');

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.body.openapi).toBe('3.1.0');
    expect(res.body.info).toEqual({ title: 'Slipakar API', version: '1.0.0' });
    expect(res.body.paths).toBeDefined();
    expect(Object.keys(res.body.paths).length).toBeGreaterThan(0);

    const patchAdminUser = res.body.paths['/admin/users/{id}']?.patch;
    expect(patchAdminUser).toBeDefined();
    const bodySchema = patchAdminUser.requestBody?.content?.['application/json']?.schema;
    expect(bodySchema?.properties?.image).toBeDefined();
    expect(JSON.stringify(bodySchema.properties.image)).toContain('2048');
  });

  it('GET /docs returns HTML that contains /docs/assets/scalar/standalone.js and does NOT contain cdn.jsdelivr.net or external http(s) script source', async () => {
    const res = await request(app).get('/docs');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('/openapi.json');
    expect(res.text).toContain('<div id="app"></div>');
    expect(res.text).toContain('/docs/assets/scalar/standalone.js');
    expect(res.text).not.toContain('cdn.jsdelivr.net');
    expect(res.text).not.toMatch(/<script[^>]+src=["']https?:\/\//i);
  });

  it('GET /docs/assets/scalar/standalone.js returns 200 with javascript content type and Cache-Control header', async () => {
    const res = await request(app).get('/docs/assets/scalar/standalone.js');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/javascript/);
    expect(res.headers['cache-control']).toContain('public');
    expect(res.headers['cache-control']).toContain('max-age=3600');
    expect(res.text.length).toBeGreaterThan(100);
  });

  it('path traversal requests on /docs/assets/scalar do not return file contents', async () => {
    const res1 = await request(app).get('/docs/assets/scalar/..%2f..%2fpackage.json');
    expect([400, 404]).toContain(res1.status);

    const res2 = await request(app).get('/docs/assets/scalar/%2e%2e/package.json');
    expect([400, 404]).toContain(res2.status);
  });
});
