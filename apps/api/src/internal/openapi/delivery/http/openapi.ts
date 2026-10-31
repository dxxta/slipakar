import { createRequire } from 'node:module';
import path from 'node:path';
import express, { Router } from 'express';
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

export function createOpenApiRouter({ document }: { document: OpenApiDocument }): Router {
  const router = Router();
  const scalarBrowserDir = resolveScalarBrowserDir();

  /** @route GET /openapi.json
   * @desc Return the OpenAPI 3.1 specification for the API. */
  router.get('/openapi.json', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(document);
  });

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
