import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildMetrics } from './metrics.js';
import { requestMetrics } from './http-middleware.js';
import type { MetricsInterface } from '../../domain/metrics/interface.js';

describe('requestMetrics middleware', () => {
  let app: Express;
  let metrics: MetricsInterface;

  beforeEach(() => {
    metrics = buildMetrics();
    app = express();
    app.use(requestMetrics(metrics));

    const projectsRouter = express.Router();
    projectsRouter.get('/projects/:projectId/smtp/:id', (_req, res) => {
      res.status(200).json({ ok: true });
    });
    projectsRouter.get('/error', (_req, res) => {
      res.status(500).json({ error: 'fail' });
    });
    app.use(projectsRouter);

    app.get('/metrics', async (_req, res) => {
      res.send(await metrics.render());
    });
  });

  it('a request to /projects/abc-123/smtp/def-456 appears with the pattern label and rendered text does not contain abc-123 or def-456', async () => {
    await request(app).get('/projects/abc-123/smtp/def-456').expect(200);

    const rendered = await metrics.render();
    expect(rendered).toContain('route="/projects/:projectId/smtp/:id"');
    expect(rendered).toContain('status="200"');
    expect(rendered).not.toContain('abc-123');
    expect(rendered).not.toContain('def-456');
  });

  it('unknown paths use unmatched', async () => {
    await request(app).get('/unknown/random/path').expect(404);

    const rendered = await metrics.render();
    expect(rendered).toContain('route="unmatched"');
    expect(rendered).toContain('status="404"');
  });

  it('a 500 is recorded with status 500', async () => {
    await request(app).get('/error').expect(500);

    const rendered = await metrics.render();
    expect(rendered).toContain('status="500"');
  });

  it('requests to /metrics are not recorded', async () => {
    await request(app).get('/metrics').expect(200);

    const rendered = await metrics.render();
    expect(rendered).not.toContain('route="/metrics"');
  });
});
