import { createRequire } from 'node:module';
import path from 'node:path';
import express, { Router } from 'express';
import { AppError } from '../../../../lib/app-error.js';
import { apiReference } from '@scalar/express-api-reference';
import type { OpenApiDocument } from '../../../../domain/openapi/interface.js';

function resolveScalarBrowserDir(): string {
  const require = createRequire(import.meta.url);
  try {
    const pkgJson = require.resolve('@scalar/api-reference/package.json');
    return path.join(path.dirname(pkgJson), 'dist', 'browser');
  } catch {
    const entry = require.resolve('@scalar/api-reference');
    return path.join(path.dirname(entry), 'browser');
  }
}

export function createOpenApiRouter({ document, integrationDocument, integrationEnabled, getSession, fullDocsEnabled }: { document: OpenApiDocument; integrationDocument?: OpenApiDocument; integrationEnabled?: () => Promise<boolean>; getSession?: (request: express.Request) => Promise<boolean>; fullDocsEnabled?: () => Promise<boolean> }): Router {
  const router = Router();
  const scalarBrowserDir = resolveScalarBrowserDir();

  /** @route GET /openapi.json
   * @desc Return the OpenAPI 3.1 specification for the API. */
  router.get('/openapi.json', async (request, response, next) => {
    try {
      const hasSession = getSession ? await getSession(request) : true;
      const isFullDocsEnabled = fullDocsEnabled ? await fullDocsEnabled() : true;
      const isIntegrationEnabled = integrationEnabled ? await integrationEnabled() : false;
      if (hasSession && isFullDocsEnabled) {
        response.setHeader('Cache-Control', 'no-store');
        response.status(200).json(document);
      } else if (!hasSession && integrationDocument && isIntegrationEnabled) {
        response.setHeader('Cache-Control', 'no-store');
        response.status(200).json(integrationDocument);
      } else if (hasSession) {
        response.sendStatus(404);
      } else {
        next(new AppError(401, 'UNAUTHENTICATED', 'Authentication required'));
      }
    } catch (error) { next(error); }
  });

  const integrationScalar = integrationDocument ? apiReference({ spec: { url: '/integrations/openapi.json' }, cdn: '/integrations/assets/scalar/standalone.js' }) : undefined;
  const allowIntegration: import('express').RequestHandler = async (_request, response, next) => {
    try { if (!integrationDocument || !integrationEnabled || !(await integrationEnabled())) { response.sendStatus(404); return; } next(); } catch (error) { next(error); }
  };
  /** @route GET /integrations/openapi.json
   * @desc Return the scoped bearer API reference when API access is enabled. */
  router.get('/integrations/openapi.json', allowIntegration, (_request, response) => { response.setHeader('Cache-Control', 'no-store'); response.status(200).json(integrationDocument); });
  /** @route GET /integrations/docs
   * @desc Serve the public Scalar reference for opted-in API-key endpoints. */
  router.get('/integrations/docs', allowIntegration, (request, response, next) => {
    if (!integrationScalar) { response.sendStatus(404); return; }
    // apiReference's handler is typed for a route without params; this route has none either.
    (integrationScalar as import('express').RequestHandler)(request, response, next);
  });

  /** Public local bundle copy for the no-cookie integrations reference. */
  router.use('/integrations/assets/scalar', express.static(scalarBrowserDir, { index: false, dotfiles: 'ignore', setHeaders: (res) => res.setHeader('Cache-Control', 'public, max-age=3600') }));

  /** Serve local @scalar/api-reference standalone bundle assets */
  router.use(
    '/docs/assets/scalar',
    express.static(scalarBrowserDir, {
      index: false,
      dotfiles: 'ignore',
      setHeaders: (res) => {
        res.setHeader('Cache-Control', 'public, max-age=3600');
      },
    }),
  );

  /** @route GET /docs
   * @desc Serve the Scalar interactive API reference documentation page. */
  router.get(
    '/docs',
    apiReference({
      spec: {
        url: '/openapi.json',
      },
      cdn: '/docs/assets/scalar/standalone.js',
    }),
  );

  return router;
}
