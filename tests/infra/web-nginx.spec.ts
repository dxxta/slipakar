import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';
import express from 'express';
import { apiReference } from '@scalar/express-api-reference';
import { describe, expect, it } from 'vitest';

const infraDir = path.join(process.cwd(), 'infra', 'web');
const nginxConfig = fs.readFileSync(path.join(infraDir, 'nginx.conf'), 'utf8');
const securityHeadersPath = path.join(infraDir, 'security-headers.conf');
const securityHeaders = fs.existsSync(securityHeadersPath)
  ? fs.readFileSync(securityHeadersPath, 'utf8')
  : '';

function getLocationBlock(location: string, config: string = nginxConfig): string {
  const start = config.indexOf(`location ${location} {`);
  if (start < 0) return '';
  const openingBrace = config.indexOf('{', start);
  let depth = 0;

  for (let index = openingBrace; index < config.length; index += 1) {
    if (config[index] === '{') depth += 1;
    if (config[index] === '}') depth -= 1;
    if (depth === 0) return config.slice(start, index + 1);
  }

  return '';
}

async function renderScalarHtml(): Promise<string> {
  const app = express();
  app.use('/docs', apiReference({
    spec: { url: '/openapi.json' },
    cdn: '/docs/assets/scalar/standalone.js',
  }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));

  try {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Scalar test server did not bind a TCP port');
    const response = await fetch(`http://127.0.0.1:${address.port}/docs`);
    return response.text();
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

describe('production web Nginx cache behavior', () => {
  it('forwards query-bearing project API requests unchanged while keeping HTML navigation on the SPA', async ({ skip }) => {
    try {
      execFileSync('docker', ['version'], { stdio: 'pipe' });
    } catch {
      skip('Docker is unavailable for the Nginx proxy behavior test');
    }

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lokaslip-nginx-query-'));
    const htmlRoot = path.join(tempDir, 'html');
    const userRoot = path.join(htmlRoot, 'user');
    const adminRoot = path.join(htmlRoot, 'admin');
    fs.mkdirSync(userRoot, { recursive: true });
    fs.mkdirSync(adminRoot, { recursive: true });
    fs.writeFileSync(path.join(userRoot, 'index.html'), '<app-root>user app</app-root>');
    fs.writeFileSync(path.join(adminRoot, 'index.html'), '<app-root>admin app</app-root>');

    const upstream = createServer((request, response) => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ url: request.url }));
    });
    upstream.listen(0, '0.0.0.0');
    await new Promise<void>((resolve) => upstream.once('listening', resolve));
    const upstreamAddress = upstream.address();
    if (!upstreamAddress || typeof upstreamAddress === 'string') throw new Error('Stub upstream did not bind a TCP port');

    const configPath = path.join(tempDir, 'default.conf');
    const testConfig = nginxConfig.replace('server api:3000;', `server host.docker.internal:${upstreamAddress.port};`);
    fs.writeFileSync(configPath, testConfig);
    const containerName = `lokaslip-nginx-query-${process.pid}-${Date.now()}`;

    try {
      execFileSync('docker', [
        'run', '--detach', '--name', containerName,
        '--add-host=host.docker.internal:host-gateway',
        '--publish=127.0.0.1::8080',
        `--volume=${configPath}:/etc/nginx/conf.d/default.conf:ro`,
        `--volume=${securityHeadersPath}:/etc/nginx/security-headers.conf:ro`,
        `--volume=${htmlRoot}:/usr/share/nginx/html:ro`,
        'nginxinc/nginx-unprivileged:stable-alpine',
      ], { stdio: 'pipe' });

      const publishedAddress = execFileSync('docker', ['port', containerName, '8080/tcp'], { encoding: 'utf8' }).trim();
      const baseUrl = `http://${publishedAddress}`;
      let ready = false;
      for (let attempt = 0; attempt < 40; attempt += 1) {
        try {
          const health = await fetch(`${baseUrl}/healthz`);
          if (health.ok) { ready = true; break; }
        } catch { /* Nginx is still starting. */ }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      expect(ready, 'Nginx should start with the checked-in configuration').toBe(true);

      const expectedRequests = [
        '/projects?page=1&limit=20&sortBy=createdAt&sortDir=desc',
        '/projects/abc/templates?x=1',
        '/notifications/unread-count',
        '/me/avatar',
        '/me/avatar/user-1?v=hash123',
        '/me/preferences',
        '/me/login-activity?page=1&limit=20&sortBy=createdAt&sortDir=desc',
        '/me/notices?page=1&limit=20&unreadOnly=true',
      ];
      for (const requestUrl of expectedRequests) {
        const response = await fetch(`${baseUrl}${requestUrl}`, {
          headers: { accept: 'application/json, text/plain, */*' },
        });
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ url: requestUrl });
      }

      const htmlResponse = await fetch(`${baseUrl}/projects/abc/templates?x=1`, {
        headers: { accept: 'text/html' },
      });
      expect(htmlResponse.status).toBe(200);
      expect(await htmlResponse.text()).toContain('<app-root>user app</app-root>');
      expect(htmlResponse.headers.get('vary')).toContain('Accept');
    } finally {
      try { execFileSync('docker', ['rm', '--force', containerName], { stdio: 'pipe' }); } catch { /* Container may not have started. */ }
      await new Promise<void>((resolve, reject) => upstream.close((error) => error ? reject(error) : resolve()));
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it.each(['= /projects', '^~ /projects/'])('%s gives the HTML fallback a distinct cache variant', (location) => {
    const block = getLocationBlock(location);

    expect(block, `Expected Nginx location ${location}`).not.toBe('');
    expect(block).toContain('gzip_vary off;');
    expect(block).toContain('add_header Vary "Accept, Accept-Encoding" always;');
    expect(block).toContain('include /etc/nginx/security-headers.conf;');
  });

  it('replaces upstream Vary and cache policy for proxied project responses', () => {
    const block = getLocationBlock('@user_api');

    expect(block).toContain('proxy_hide_header Vary;');
    expect(block).toContain('gzip_vary off;');
    expect(block).toContain('add_header Vary "Accept, Accept-Encoding" always;');
    expect(block).toContain('proxy_hide_header Cache-Control;');
    expect(block).toContain('add_header Cache-Control "no-store" always;');
    expect(block).toContain('include /etc/nginx/security-headers.conf;');
  });

  it('prevents caching the project HTML fallback and does not cache proxied project data', () => {
    expect(getLocationBlock('= /projects')).toContain('add_header Cache-Control "no-cache" always;');
    expect(getLocationBlock('^~ /projects/')).toContain('add_header Cache-Control "no-cache" always;');
    expect(getLocationBlock('@user_api')).toContain('proxy_hide_header Cache-Control;');
    expect(getLocationBlock('@user_api')).toContain('add_header Cache-Control "no-store" always;');
  });

  it('applies the same private cache and Accept variant headers to unread count', () => {
    const block = getLocationBlock('= /notifications/unread-count');

    expect(block).toContain('proxy_hide_header Vary;');
    expect(block).toContain('gzip_vary off;');
    expect(block).toContain('add_header Vary "Accept, Accept-Encoding" always;');
    expect(block).toContain('proxy_hide_header Cache-Control;');
    expect(block).toContain('add_header Cache-Control "no-store" always;');
    expect(block).toContain('include /etc/nginx/security-headers.conf;');
  });

  it('proxies same-origin avatar image URLs through both web servers', () => {
    const userServer = nginxConfig.slice(nginxConfig.indexOf('server {'));
    const adminStart = userServer.indexOf('server {', userServer.indexOf('server {') + 1);
    const adminServer = userServer.slice(adminStart);
    for (const config of [userServer, adminServer]) {
      const block = getLocationBlock('^~ /me/', config);
      expect(block).toContain('proxy_pass http://api;');
      expect(block).toContain('add_header Cache-Control "no-store" always;');
      expect(block).toContain('include /etc/nginx/security-headers.conf;');
    }
  });

  it('does not cache the index HTML returned directly from its canonical path', () => {
    expect(getLocationBlock('= /index.html')).toContain('add_header Cache-Control "no-cache" always;');
  });

  it('keeps all security headers in the shared include used by overriding locations', () => {
    for (const header of [
      'X-Content-Type-Options',
      'X-Frame-Options',
      'Referrer-Policy',
      'Permissions-Policy',
      'Content-Security-Policy',
    ]) {
      expect(securityHeaders).toContain(`add_header ${header} `);
    }
  });

  it('does not allow generated remote avatar URLs after switching to initials', () => {
    const policies = [...nginxConfig.matchAll(/Content-Security-Policy "([^"]+)"/g)].map((match) => match[1] ?? '');

    expect(policies.length).toBeGreaterThan(0);
    for (const policy of policies) {
      expect(policy).not.toContain('api.dicebear.com');
      expect(policy).toContain("img-src 'self' data: https://*.googleusercontent.com https://tile.openstreetmap.org;");
    }
  });

  it('allows OpenStreetMap raster tiles on both web origins without broadening other CSP directives', () => {
    const policies = [...nginxConfig.matchAll(/Content-Security-Policy "([^"]+)"/g)].map((match) => match[1] ?? '');

    expect(policies.length).toBeGreaterThan(1);
    for (const policy of policies) {
      expect(policy).toContain("img-src 'self' data: https://*.googleusercontent.com https://tile.openstreetmap.org;");
      expect(policy).not.toContain('api.dicebear.com');
      expect(policy).toContain("script-src 'self'");
      expect(policy).not.toContain("unsafe-eval");
    }
  });

  // Scalar's caught Function("") feature probe and blocked fonts.scalar.com font requests are expected under this strict CSP; rendering uses the system-font fallback.
  it('allows only the exact inline Scalar initializer on both docs endpoints', async () => {
    const html = await renderScalarHtml();
    const inlineScripts = [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
    expect(inlineScripts).toHaveLength(1);
    const scriptHash = createHash('sha256').update(inlineScripts[0]?.[1] ?? '').digest('base64');

    for (const block of [
      getLocationBlock('= /docs', nginxConfig),
      getLocationBlock('= /docs', nginxConfig.slice(nginxConfig.indexOf('server {', nginxConfig.indexOf('server {') + 1))),
    ]) {
      expect(block).not.toBe('');
      const contentSecurityPolicy = block.match(/add_header Content-Security-Policy "([^"]+)"/)?.[1] ?? '';
      expect(contentSecurityPolicy).toContain(`script-src 'self' 'sha256-${scriptHash}'`);
      expect(contentSecurityPolicy).not.toMatch(/script-src[^;]*'unsafe-inline'/);
      for (const header of [
        'X-Content-Type-Options',
        'X-Frame-Options',
        'Referrer-Policy',
        'Permissions-Policy',
      ]) {
        expect(block).toContain(`add_header ${header} `);
      }
    }
  });
});
