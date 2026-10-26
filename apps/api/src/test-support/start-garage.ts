import { randomBytes } from 'node:crypto';
import { connect as connectSocket } from 'node:net';
import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';
import { startContainer } from './start-container.js';

const image = 'dxflrs/garage:v1.0.1';
const configPath = '/etc/garage.toml';
const bucket = 'lokaslip';
const region = 'garage';
const accessKey = 'GK0123456789abcdef01234567';
const secretKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

export type Garage = {
  container: StartedTestContainer;
  endpoint: string;
  port: number;
  accessKey: string;
  secretKey: string;
  bucket: string;
  region: string;
  pathStyle: true;
  stop(): Promise<void>;
};

function garageConfig(): string {
  const rpcSecret = randomBytes(32).toString('hex');
  const adminToken = randomBytes(32).toString('hex');
  return `metadata_dir = "/var/lib/garage/meta"
data_dir = "/var/lib/garage/data"
db_engine = "sqlite"
replication_factor = 1
rpc_bind_addr = "0.0.0.0:3901"
rpc_public_addr = "127.0.0.1:3901"
rpc_secret = "${rpcSecret}"

[s3_api]
s3_region = "garage"
api_bind_addr = "0.0.0.0:3900"
root_domain = ".s3.garage"

[admin]
api_bind_addr = "0.0.0.0:3903"
admin_token = "${adminToken}"
metrics_token = "${randomBytes(32).toString('hex')}"
`;
}

function execOutput(result: { output: string; stdout: string; stderr: string }): string {
  return [result.stdout, result.stderr, result.output].filter((part) => part.length > 0).join('\n');
}

async function runGarageCommand(container: StartedTestContainer, command: string[]): Promise<string> {
  const result = await container.exec(command);
  if (result.exitCode !== 0) {
    throw new Error(`Garage command failed (${command.join(' ')}), exit ${result.exitCode}:\n${execOutput(result)}`);
  }
  return execOutput(result);
}

async function waitForNodeId(container: StartedTestContainer): Promise<string> {
  const deadline = Date.now() + 30_000;
  let lastOutput = '';
  let lastExitCode = -1;
  while (Date.now() < deadline) {
    const result = await container.exec(['/garage', '-c', configPath, 'status']);
    lastOutput = execOutput(result);
    lastExitCode = result.exitCode;
    const nodeId = lastOutput.match(/^([0-9a-f]{16})\b/m)?.[1];
    if (result.exitCode === 0 && nodeId) return nodeId;
    await new Promise<void>((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for Garage node ID after 30 seconds. Last status exit ${lastExitCode}:\n${lastOutput}`);
}

async function waitForS3Endpoint(endpoint: string, port: number): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const connected = await new Promise<boolean>((resolve) => {
      const socket = connectSocket({ host: endpoint, port });
      const timeout = setTimeout(() => {
        socket.destroy();
        resolve(false);
      }, 1_000);
      socket.once('connect', () => {
        clearTimeout(timeout);
        socket.destroy();
        resolve(true);
      });
      socket.once('error', () => {
        clearTimeout(timeout);
        resolve(false);
      });
    });
    if (connected) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for Garage S3 endpoint at ${endpoint}:${port} after 30 seconds`);
}

export async function startGarage(): Promise<Garage> {
  let startupLogs = '';
  let container: StartedTestContainer;
  try {
    container = await startContainer(() => new GenericContainer(image)
      .withCopyContentToContainer([{ content: garageConfig(), target: configPath, mode: 0o644 }])
      .withCommand(['/garage', '-c', configPath, 'server'])
      .withExposedPorts(3900)
      .withWaitStrategy(Wait.forLogMessage(/S3 API server listening/))
      .withLogConsumer((stream) => stream.on('data', (chunk: Buffer) => { startupLogs += chunk.toString(); }))
      .start());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const relevantLogs = startupLogs.split('\n').filter((line) => /error|warn|panic|listen|S3 API|started|bind|address|config/i.test(line)).slice(0, 60).join('\n');
    throw new Error(`Garage container failed to start: ${message}\nContainer output:\n${relevantLogs}`, { cause: error });
  }

  try {
    const endpoint = container.getHost();
    const port = container.getMappedPort(3900);
    const [nodeId] = await Promise.all([waitForNodeId(container), waitForS3Endpoint(endpoint, port)]);
    await runGarageCommand(container, ['/garage', '-c', configPath, 'layout', 'assign', '-z', 'dc1', '-c', '10G', nodeId]);
    await runGarageCommand(container, ['/garage', '-c', configPath, 'layout', 'apply', '--version', '1']);
    await runGarageCommand(container, ['/garage', '-c', configPath, 'key', 'import', '-n', 'lokaslip-key', '--yes', accessKey, secretKey]);
    await runGarageCommand(container, ['/garage', '-c', configPath, 'key', 'allow', '--create-bucket', accessKey]);
    await runGarageCommand(container, ['/garage', '-c', configPath, 'bucket', 'create', bucket]);
    await runGarageCommand(container, ['/garage', '-c', configPath, 'bucket', 'allow', '--read', '--write', '--owner', bucket, '--key', accessKey]);
  } catch (error) {
    await container.stop().catch(() => undefined);
    throw error;
  }

  return {
    container,
    endpoint: container.getHost(),
    port: container.getMappedPort(3900),
    accessKey,
    secretKey,
    bucket,
    region,
    pathStyle: true,
    async stop(): Promise<void> {
      await container.stop();
    },
  };
}
