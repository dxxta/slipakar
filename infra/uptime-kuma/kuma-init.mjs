import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';


const MONITORS = [
  { name: 'Slipakar API', type: 'http', url: 'http://api:3000/health' },
  { name: 'Slipakar Web', type: 'http', url: 'http://web:8080/healthz' },
  { name: 'Slipakar Landing', type: 'http', url: 'http://landing:8082/healthz' },
];

/** @typedef {{ name: string; type: string; url?: string }} MonitorSummary */
/** @typedef {{ emit(event: string, ...args: unknown[]): unknown; once(event: string, listener: (...args: unknown[]) => void): unknown; off?(event: string, listener: (...args: unknown[]) => void): unknown }} MonitorSocket */

/** @param {MonitorSummary[]} existing @param {boolean} includeLanding @returns {MonitorSummary[]} */
export function missingMonitors(existing, includeLanding = false) {
  const desired = includeLanding ? MONITORS : MONITORS.filter((monitor) => monitor.name !== 'Slipakar Landing');
  const names = new Set(existing.map((monitor) => monitor.name));
  return desired.filter((monitor) => !names.has(monitor.name));
}

/** @param {MonitorSocket} socket @param {string} event @param {...unknown} args @returns {Promise<unknown>} */
function emitWithAck(socket, event, ...args) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Uptime Kuma ${event} acknowledgement timed out`)), 8_000);
    socket.emit(event, ...args, (response) => {
      clearTimeout(timeout);
      resolve(response);
    });
  });
}

/** @param {unknown} response @param {string} operation @returns {void} */
function assertOk(response, operation) {
  if (!response || typeof response !== 'object' || !('ok' in response) || response.ok !== true) {
    const message = response && typeof response === 'object' && 'msg' in response && typeof response.msg === 'string'
      ? response.msg
      : 'operation failed';
    throw new Error(`Uptime Kuma ${operation}: ${message}`);
  }
}


/** @param {unknown} value @returns {MonitorSummary[]} */
function normalizeMonitorList(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') {
    return Object.values(value).filter((monitor) => monitor && typeof monitor === 'object');
  }
  return [];
}

/** @param {MonitorSocket} socket @param {{ username: string; password: string; includeLanding: boolean }} options @returns {Promise<{created: string[]}>} */
export async function provisionMonitors(socket, options) {
  const needSetup = await emitWithAck(socket, 'needSetup');
  if (needSetup === true) {
    assertOk(await emitWithAck(socket, 'setup', options.username, options.password), 'setup');
  }

  assertOk(await emitWithAck(socket, 'login', { username: options.username, password: options.password }), 'login');

  const listPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Uptime Kuma monitorList event timed out')), 8_000);
    socket.once('monitorList', (list) => {
      clearTimeout(timeout);
      resolve(normalizeMonitorList(list));
    });
  });
  assertOk(await emitWithAck(socket, 'getMonitorList'), 'getMonitorList');
  const existing = await listPromise;
  const missing = missingMonitors(existing, options.includeLanding);
  const created = [];

  for (const monitor of missing) {
    const response = await emitWithAck(socket, 'add', {
      ...monitor,
      url: (monitor.name === 'Slipakar API' ? options.apiUrl : monitor.name === 'Slipakar Web' ? options.webUrl : options.landingUrl) || monitor.url,
      method: 'GET',
      interval: 60,
      retryInterval: 60,
      maxretries: 0,
      accepted_statuscodes: ['200-299'],
      notificationIDList: {},
      kafkaProducerBrokers: [],
      kafkaProducerSaslOptions: [],
      active: true,
      ignoreTls: false,
      maxredirects: 10,
      expiryNotification: false,
      upsideDown: false,
    });
    assertOk(response, `add ${monitor.name}`);
    created.push(monitor.name);
  }

  return { created };
}

/** @param {{ username: string; password: string; includeLanding: boolean }} options @returns {Promise<{created: string[]}>} */
async function connectAndProvision(options) {
  const require = createRequire('/app/server/server.js');
  const { io } = require('socket.io-client');
  const socket = io('http://uptime-kuma:3001', {
    transports: ['websocket'],
    reconnection: false,
    timeout: 4_000,
  });

  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Uptime Kuma socket connection timed out')), 4_000);
      socket.once('connect', () => {
        clearTimeout(timeout);
        resolve(undefined);
      });
      socket.once('connect_error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
    return await provisionMonitors(socket, options);
  } finally {
    socket.disconnect();
  }
}

/** @param {number} milliseconds @returns {Promise<void>} */
function pause(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/** @param {unknown} error @param {string} password @returns {string} */
function safeError(error, password) {
  const message = error instanceof Error ? error.message : 'Unknown initialization error';
  return password ? message.replaceAll(password, '[redacted]') : message;
}

/** @returns {Promise<void>} */
export async function main() {
  const username = process.env.UPTIME_KUMA_ADMIN_USER || 'admin';
  const password = process.env.UPTIME_KUMA_ADMIN_PASSWORD;
  if (!password) throw new Error('UPTIME_KUMA_ADMIN_PASSWORD is required');
  const options = {
    username,
    password,
    includeLanding: process.env.KUMA_MONITOR_LANDING === 'true',
    apiUrl: process.env.KUMA_MONITOR_API_URL,
    webUrl: process.env.KUMA_MONITOR_WEB_URL,
    landingUrl: process.env.KUMA_MONITOR_LANDING_URL,
  };

  let delay = 1_000;
  for (let attempt = 1; attempt <= 7; attempt += 1) {
    try {
      const result = await connectAndProvision(options);
      console.log(`Uptime Kuma initialized; created ${result.created.length} monitor(s).`);
      return;
    } catch (error) {
      const message = safeError(error, password);
      if (attempt === 7) {
        throw new Error(`Uptime Kuma initialization failed after ${attempt} attempts: ${message}`);
      }
      console.warn(`Uptime Kuma initialization attempt ${attempt} failed: ${message}`);
      await pause(delay);
      delay = Math.min(delay * 2, 10_000);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Uptime Kuma initialization failed');
    process.exitCode = 1;
  });
}
