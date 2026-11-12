import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import { isBlockedAiBot } from './server/ai-bots';
import { buildRobotsTxt } from './server/robots';
import { buildSitemapXml, INDEXABLE_PATHS } from './server/sitemap';
import { heartbeatUrl, LandingStatus, parseHeartbeat } from './server/status';
import { applyRuntimeConfigToHtml, createLandingRuntimeConfig, landingAllowedHosts, LandingRuntimeConfig } from './app/runtime-config';

const browserDistFolder = join(import.meta.dirname, '../browser');

export function readLandingRuntimeConfig(environment: NodeJS.ProcessEnv = process.env): LandingRuntimeConfig {
  return createLandingRuntimeConfig(environment);
}

export function createLandingApp(config: LandingRuntimeConfig = readLandingRuntimeConfig()): express.Express {
  const app = express();
  const angularApp = new AngularNodeAppEngine({ allowedHosts: landingAllowedHosts(config) });

  app.get('/healthz', (_req, res) => res.status(200).type('text/plain').send('ok'));
  app.get('/robots.txt', (_req, res) => res.type('text/plain').send(buildRobotsTxt(config.siteUrl)));
  app.get('/sitemap.xml', (_req, res) => res.type('application/xml').send(buildSitemapXml(config.siteUrl)));
  let cachedStatus: { state: LandingStatus; expiresAt: number } | undefined;
  app.get('/status.json', async (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (cachedStatus && cachedStatus.expiresAt > Date.now()) {
      res.json({ state: cachedStatus.state });
      return;
    }

    let state: LandingStatus = 'unknown';
    if (config.statusUrl) {
      try {
        const response = await fetch(heartbeatUrl(config.statusUrl), {
          headers: { Accept: 'application/json' },
          cache: 'no-store',
          redirect: 'manual',
          signal: AbortSignal.timeout(4000),
        });
        if (response.ok) state = parseHeartbeat(await response.json());
      } catch {
        state = 'unknown';
      }
    }

    cachedStatus = { state, expiresAt: Date.now() + 30_000 };
    res.json({ state });
  });

  // robots.txt is a request for policy, not a crawl of site content. User-agent blocking only stops honest bots;
  // use a CDN or WAF for enforcement against clients that ignore robots.txt or spoof another user agent.
  app.use((req, res, next) => {
    if (isBlockedAiBot(req.headers['user-agent'])) {
      res.setHeader('Vary', 'User-Agent');
      res.status(403).type('text/plain').send('Access denied.');
      return;
    }
    next();
  });

  app.use(express.static(browserDistFolder, { maxAge: '1y', index: false, redirect: false }));

  app.use((req, res, next) => {
    angularApp
      .handle(req, { landingConfig: config })
      .then(async (response) => {
        if (!response) return next();
        if (response.headers.get('content-type')?.includes('text/html')) {
          const html = applyRuntimeConfigToHtml(await response.text(), config);
          // The runtime URLs change the body length, so the original Content-Length would truncate the page.
          response.headers.delete('Content-Length');
          response.headers.set('Cache-Control', 'no-cache');
          response.headers.set('X-Robots-Tag', INDEXABLE_PATHS.includes(req.path as (typeof INDEXABLE_PATHS)[number]) ? 'noai, noimageai' : 'noindex, nofollow, noai, noimageai');
          const updatedResponse = new Response(html, { status: response.status, statusText: response.statusText, headers: response.headers });
          writeResponseToNodeResponse(updatedResponse, res);
          return;
        }
        writeResponseToNodeResponse(response, res);
      })
      .catch(next);
  });

  app.use((_req, res) => res.status(404).type('text/plain').send('Not found.'));
  return app;
}

const app = createLandingApp();

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by `PORT`, defaulting to 8082.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 8082;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
