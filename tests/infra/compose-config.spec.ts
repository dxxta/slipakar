import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('docker-compose.yml configuration', () => {
  const rootDir = process.cwd();
  const composeFile = path.join(rootDir, 'docker-compose.yml');

  let dockerComposeAvailable = false;
  let tmpDir: string;
  let validEnvFile: string;

  beforeAll(() => {
    try {
      execFileSync('docker', ['compose', 'version'], { stdio: 'pipe' });
      dockerComposeAvailable = true;
    } catch {
      dockerComposeAvailable = false;
    }

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slipakar-compose-test-'));
    validEnvFile = path.join(tmpDir, 'valid.env');

    const validEnvContent = [
      'POSTGRES_PASSWORD=fake-postgres-pw',
      'POSTGRES_USER=slipakar',
      'POSTGRES_DB=slipakar',
      'RABBITMQ_PASSWORD=fake-rabbitmq-pw',
      'RABBITMQ_USER=slipakar',
      'S3_BUCKET=slipakar',
      'S3_ACCESS_KEY=GK0123456789abcdef01234567',
      'S3_SECRET_KEY=00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff',
      'GARAGE_RPC_SECRET=00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff',
      'GARAGE_ADMIN_TOKEN=00112233445566778899aabbccddeeff0011223344556677',
      'APP_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      'BETTER_AUTH_SECRET=fake-better-auth-secret-123456',
      'BETTER_AUTH_URL=http://localhost:8080',
      'TRUSTED_ORIGINS=http://localhost:8080',
      'API_ACCESS_ENABLED=false',
      'API_ALLOWED_ORIGINS=',
      'GOOGLE_CLIENT_ID=fake-google-client-id',
      'GOOGLE_CLIENT_SECRET=fake-google-client-secret',
      'METRICS_TOKEN=fake-metrics-token-16-chars-min',
      'GRAFANA_ADMIN_USER=admin',
      'GRAFANA_ADMIN_PASSWORD=fake-grafana-pw',
      'UPTIME_KUMA_ADMIN_PASSWORD=fake-kuma-pw',
      'ADMIN_EMAILS=admin@example.com',
      'BIND_ADDRESS=127.0.0.1',
    ].join('\n');

    fs.writeFileSync(validEnvFile, validEnvContent, 'utf8');
  });

  afterAll(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('validates compose config with full valid env', ({ skip }) => {
    if (!dockerComposeAvailable) {
      skip('docker compose command is unavailable in this environment');
    }

    const output = execFileSync(
      'docker',
      ['compose', '-f', composeFile, '--env-file', validEnvFile, 'config', '--format', 'json'],
      { stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf8' },
    );

    const config = JSON.parse(output);
    expect(config.name).toBe('slipakar');
    expect(config.services).toBeDefined();

    const expectedServices = [
      'api',
      'web',
      'postgres',
      'redis',
      'rabbitmq',
      'garage',
      'garage-init',
      'prometheus',
      'grafana',
      'uptime-kuma',
      'kuma-init',
    ];

    // (1) all expected services exist with the contract names
    for (const service of expectedServices) {
      expect(config.services[service], `Expected service ${service} to exist`).toBeDefined();
    }

    // (2) long-running services have restart unless-stopped, garage-init has restart "no"
    for (const service of expectedServices) {
      if (service === 'garage-init' || service === 'kuma-init') {
        expect(
          config.services[service].restart,
          `Expected service ${service} to have restart no`,
        ).toBe('no');
      } else {
        expect(
          config.services[service].restart,
          `Expected service ${service} to have restart unless-stopped`,
        ).toBe('unless-stopped');
      }
    }

    // (3) internal services publish no ports
    const internalServices = ['postgres', 'redis', 'rabbitmq', 'garage', 'garage-init', 'prometheus'];
    for (const service of internalServices) {
      const ports = config.services[service].ports || [];
      expect(
        ports.length,
        `Expected service ${service} to publish no ports, found: ${JSON.stringify(ports)}`,
      ).toBe(0);
    }

    // (4) the published ports are bound to 127.0.0.1
    const publishedServices = ['api', 'web', 'grafana', 'uptime-kuma'];
    for (const service of publishedServices) {
      const ports = config.services[service].ports;
      expect(ports, `Expected service ${service} to have published ports`).toBeDefined();
      expect(ports.length).toBeGreaterThan(0);
      for (const p of ports) {
        expect(p.host_ip || p.hostIp || p.ip).toBe('127.0.0.1');
      }
    }

    expect(config.services.web.ports.map((port: { target: number }) => port.target).sort()).toEqual([8080]);
    expect(config.services.web.ports.map((port: { published: string }) => port.published).sort()).toEqual(['8080']);
    expect(config.services.web.environment.API_UPSTREAM).toBe('api:3000');
    expect(config.services.web.depends_on.api.condition).toBe('service_healthy');
    expect(config.services.web.restart).toBe('unless-stopped');
    expect(config.services.api.environment.TRUSTED_ORIGINS).toBe('http://localhost:8080');
    expect(config.services.api.environment.API_ACCESS_ENABLED).toBe('false');
    expect(config.services.api.environment.API_ALLOWED_ORIGINS).toBe('');
    expect(config.services.postgres.environment.POSTGRES_USER).toBe('slipakar');
    expect(config.services.postgres.environment.POSTGRES_DB).toBe('slipakar');
    expect(config.services.rabbitmq.environment.RABBITMQ_DEFAULT_USER).toBe('slipakar');
    expect(config.services.api.environment.DATABASE_URL).toBe('postgresql://slipakar:fake-postgres-pw@postgres:5432/slipakar');
    expect(config.services.api.environment.RABBITMQ_URL).toBe('amqp://slipakar:fake-rabbitmq-pw@rabbitmq:5672');
    expect(config.services.api.environment.S3_BUCKET).toBe('slipakar');
    expect(config.services['garage-init'].environment.S3_BUCKET).toBe('slipakar');
    expect(config.services['uptime-kuma'].image).toBe('louislam/uptime-kuma:1.23.17');
    expect(config.services['kuma-init'].depends_on['uptime-kuma'].condition).toBe('service_healthy');
    expect(config.services['kuma-init'].restart).toBe('no');
    expect(config.services.api.environment.SETUP_GRAFANA_URL).toBe('http://grafana:3000');
    expect(config.services.api.environment.SETUP_UPTIME_URL).toBe('http://uptime-kuma:3001');
    expect(config.services.api.environment.SETUP_UPTIME_PASSWORD).toBe('fake-kuma-pw');

    expect(config.services.landing).toBeUndefined();
    const landingConfigOutput = execFileSync(
      'docker',
      ['compose', '-f', composeFile, '--env-file', validEnvFile, '--profile', 'landing', 'config', '--format', 'json'],
      { stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf8' },
    );
    const landingConfig = JSON.parse(landingConfigOutput);
    expect(landingConfig.services.landing.profiles).toEqual(['landing']);
    expect(landingConfig.services.landing.ports[0]).toMatchObject({ host_ip: '127.0.0.1', published: '8082', target: 8082 });

    // (5) the api depends on postgres, redis, rabbitmq, garage with service_healthy and garage-init with service_completed_successfully
    const apiDepends = config.services.api.depends_on;
    expect(apiDepends).toBeDefined();
    const healthyDeps = ['postgres', 'redis', 'rabbitmq', 'garage'];
    for (const dep of healthyDeps) {
      expect(apiDepends[dep], `Expected api to depend on ${dep}`).toBeDefined();
      expect(apiDepends[dep].condition).toBe('service_healthy');
    }
    expect(apiDepends['garage-init'], 'Expected api to depend on garage-init').toBeDefined();
    expect(apiDepends['garage-init'].condition).toBe('service_completed_successfully');
  });

  it('configures optional dev monitoring services under the monitoring profile', ({ skip }) => {
    if (!dockerComposeAvailable) skip('docker compose command is unavailable in this environment');
    const output = execFileSync('docker', ['compose', '-f', path.join(rootDir, 'docker-compose.dev.yml'), '--profile', 'monitoring', 'config', '--format', 'json'], { encoding: 'utf8' });
    const config = JSON.parse(output);
    for (const service of ['prometheus', 'grafana', 'uptime-kuma', 'kuma-init']) expect(config.services[service]).toBeDefined();
    expect(config.services['uptime-kuma'].ports[0]).toMatchObject({ host_ip: '127.0.0.1', published: '3012', target: 3001 });
    expect(config.services.grafana.ports[0]).toMatchObject({ host_ip: '127.0.0.1', published: '3011', target: 3000 });
    expect(config.services.api).toBeUndefined();
  });

  it('allows existing deployments to retain their database, queue, bucket, and compose project names', ({ skip }) => {
    if (!dockerComposeAvailable) {
      skip('docker compose command is unavailable in this environment');
    }

    const legacyEnvFile = path.join(tmpDir, 'legacy-names.env');
    const legacyValues = [
      'COMPOSE_PROJECT_NAME=existing-stack',
      'POSTGRES_USER=existing-user',
      'POSTGRES_DB=existing-db',
      'POSTGRES_PASSWORD=fake-postgres-pw',
      'RABBITMQ_USER=existing-user',
      'RABBITMQ_PASSWORD=fake-rabbitmq-pw',
      'S3_BUCKET=existing-bucket',
    ];
    const otherValues = fs.readFileSync(validEnvFile, 'utf8').split('\n').filter((line) =>
      !/^(COMPOSE_PROJECT_NAME|POSTGRES_USER|POSTGRES_DB|POSTGRES_PASSWORD|RABBITMQ_USER|RABBITMQ_PASSWORD|S3_BUCKET)=/.test(line),
    );
    fs.writeFileSync(legacyEnvFile, [...legacyValues, ...otherValues].join('\n'), 'utf8');

    const output = execFileSync(
      'docker',
      ['compose', '-f', composeFile, '--env-file', legacyEnvFile, 'config', '--format', 'json'],
      { stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf8' },
    );
    const config = JSON.parse(output);

    expect(config.name).toBe('existing-stack');
    expect(config.services.postgres.environment.POSTGRES_USER).toBe('existing-user');
    expect(config.services.postgres.environment.POSTGRES_DB).toBe('existing-db');
    expect(config.services.rabbitmq.environment.RABBITMQ_DEFAULT_USER).toBe('existing-user');
    expect(config.services.api.environment.DATABASE_URL).toBe('postgresql://existing-user:fake-postgres-pw@postgres:5432/existing-db');
    expect(config.services.api.environment.RABBITMQ_URL).toBe('amqp://existing-user:fake-rabbitmq-pw@rabbitmq:5672');
    expect(config.services.api.environment.S3_BUCKET).toBe('existing-bucket');
    expect(config.services['garage-init'].environment.S3_BUCKET).toBe('existing-bucket');
  });

  it('fails compose config when POSTGRES_PASSWORD is missing', ({ skip }) => {
    if (!dockerComposeAvailable) {
      skip('docker compose command is unavailable in this environment');
    }

    const missingPostgresEnv = path.join(tmpDir, 'missing-postgres.env');
    const validLines = fs.readFileSync(validEnvFile, 'utf8').split('\n');
    const filteredLines = validLines.filter((line) => !line.startsWith('POSTGRES_PASSWORD='));
    fs.writeFileSync(missingPostgresEnv, filteredLines.join('\n'), 'utf8');

    let failed = false;
    try {
      execFileSync(
        'docker',
        ['compose', '-f', composeFile, '--env-file', missingPostgresEnv, 'config', '--format', 'json'],
        { stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf8' },
      );
    } catch {
      failed = true;
    }
    expect(failed).toBe(true);
  });

  it('fails compose config when APP_ENCRYPTION_KEY is missing', ({ skip }) => {
    if (!dockerComposeAvailable) {
      skip('docker compose command is unavailable in this environment');
    }

    const missingKeyEnv = path.join(tmpDir, 'missing-key.env');
    const validLines = fs.readFileSync(validEnvFile, 'utf8').split('\n');
    const filteredLines = validLines.filter((line) => !line.startsWith('APP_ENCRYPTION_KEY='));
    fs.writeFileSync(missingKeyEnv, filteredLines.join('\n'), 'utf8');

    let failed = false;
    try {
      execFileSync(
        'docker',
        ['compose', '-f', composeFile, '--env-file', missingKeyEnv, 'config', '--format', 'json'],
        { stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf8' },
      );
    } catch {
      failed = true;
    }
    expect(failed).toBe(true);
  });

  it('fails compose config when GARAGE_RPC_SECRET is missing', ({ skip }) => {
    if (!dockerComposeAvailable) {
      skip('docker compose command is unavailable in this environment');
    }

    const missingRpcEnv = path.join(tmpDir, 'missing-rpc.env');
    const validLines = fs.readFileSync(validEnvFile, 'utf8').split('\n');
    const filteredLines = validLines.filter((line) => !line.startsWith('GARAGE_RPC_SECRET='));
    fs.writeFileSync(missingRpcEnv, filteredLines.join('\n'), 'utf8');

    let failed = false;
    try {
      execFileSync(
        'docker',
        ['compose', '-f', composeFile, '--env-file', missingRpcEnv, 'config', '--format', 'json'],
        { stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf8' },
      );
    } catch {
      failed = true;
    }
    expect(failed).toBe(true);
  });

  it('fails compose config when S3_SECRET_KEY is missing', ({ skip }) => {
    if (!dockerComposeAvailable) {
      skip('docker compose command is unavailable in this environment');
    }

    const missingS3SecretEnv = path.join(tmpDir, 'missing-s3-secret.env');
    const validLines = fs.readFileSync(validEnvFile, 'utf8').split('\n');
    const filteredLines = validLines.filter((line) => !line.startsWith('S3_SECRET_KEY='));
    fs.writeFileSync(missingS3SecretEnv, filteredLines.join('\n'), 'utf8');

    let failed = false;
    try {
      execFileSync(
        'docker',
        ['compose', '-f', composeFile, '--env-file', missingS3SecretEnv, 'config', '--format', 'json'],
        { stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf8' },
      );
    } catch {
      failed = true;
    }
    expect(failed).toBe(true);
  });
});
