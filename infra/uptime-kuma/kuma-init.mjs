import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

/** @typedef {'webUrl' | 'adminUrl' | 'apiUrl' | 'landingUrl'} MonitorUrlOption */
/** @type {{ name: string; type: 'http'; urlOption: MonitorUrlOption; landing?: boolean }[]} */
const MONITORS = [
  { name: 'Slipakar Web', type: 'http', urlOption: 'webUrl' },
  { name: 'Slipakar Admin', type: 'http', urlOption: 'adminUrl' },
  { name: 'Slipakar API', type: 'http', urlOption: 'apiUrl' },
  { name: 'Slipakar Landing', type: 'http', urlOption: 'landingUrl', landing: true },
];

/** @typedef {{ id?: number; name: string; type: string; url?: string }} MonitorSummary */
/** @typedef {{ username: string; password: string; includeLanding: boolean; webUrl?: string; adminUrl?: string; apiUrl?: string; landingUrl?: string; statusPageSlug?: string; statusPageTitle?: string }} ProvisionOptions */
/** @typedef {{ emit(event: string, ...args: unknown[]): unknown; once(event: string, listener: (...args: unknown[]) => void): unknown; off?(event: string, listener: (...args: unknown[]) => void): unknown }} MonitorSocket */

/** @param {ProvisionOptions} options @returns {MonitorSummary[]} */
function configuredMonitors(options) {
  return MONITORS.flatMap((monitor) => {
    if (monitor.landing && !options.includeLanding) return [];
    const url = options[monitor.urlOption]?.trim();
    return url ? [{ name: monitor.name, type: monitor.type, url }] : [];
  });
}

/** @param {MonitorSummary[]} existing @param {ProvisionOptions} options @returns {MonitorSummary[]} */
export function missingMonitors(existing, options) {
  const names = new Set(existing.map((monitor) => monitor.name));
  return configuredMonitors(options).filter((monitor) => !names.has(monitor.name));
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

/** @param {MonitorSocket} socket @param {string} event @returns {Promise<unknown>} */
function waitForEvent(socket, event) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Uptime Kuma ${event} event timed out`)), 8_000);
    socket.once(event, (value) => {
      clearTimeout(timeout);
      resolve(value);
    });
  });
}

/** @param {unknown} value @returns {MonitorSummary[]} */
function normalizeMonitorList(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, monitor]) => {
    if (!monitor || typeof monitor !== 'object') return [];
    const summary = /** @type {MonitorSummary} */ (monitor);
    const id = Number(key);
    return [{ ...summary, ...(summary.id === undefined && Number.isSafeInteger(id) ? { id } : {}) }];
  });
}

/** @param {unknown} value @returns {{ slug?: string; config?: { slug?: string } }[]} */
function normalizeStatusPageList(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([slug, page]) => {
    if (!page || typeof page !== 'object') return [];
    const statusPage = /** @type {{ slug?: string; config?: { slug?: string } }} */ (page);
    return [{ ...statusPage, slug: statusPage.slug ?? slug }];
  });
}

/** @param {MonitorSocket} socket @returns {Promise<MonitorSummary[]>} */
async function getMonitorList(socket) {
  const listPromise = waitForEvent(socket, 'monitorList');
  void listPromise.catch(() => undefined);
  assertOk(await emitWithAck(socket, 'getMonitorList'), 'getMonitorList');
  return normalizeMonitorList(await listPromise);
}

/** @param {MonitorSocket} socket @param {ProvisionOptions} options @param {{ slug?: string; config?: { slug?: string } }[]} statusPages @returns {Promise<void>} */
async function saveStatusPage(socket, options, statusPages) {
  const slug = options.statusPageSlug || 'status';
  const title = options.statusPageTitle || 'Slipakar status';
  const exists = statusPages.some((page) => page.slug === slug || page.config?.slug === slug);
  if (!exists) assertOk(await emitWithAck(socket, 'addStatusPage', title, slug), 'addStatusPage');

  const desiredNames = new Set(configuredMonitors(options).map((monitor) => monitor.name));
  const monitors = await getMonitorList(socket);
  const monitorList = monitors
    .filter((monitor) => desiredNames.has(monitor.name) && typeof monitor.id === 'number' && Number.isSafeInteger(monitor.id))
    .map((monitor) => ({ id: /** @type {number} */ (monitor.id) }));
  const config = {
    slug,
    title,
    description: '',
    theme: 'auto',
    published: true,
    showTags: false,
    showPoweredBy: false,
    footerText: '',
    customCSS: '',
    autoRefreshInterval: 300,
    domainNameList: [],
  };
  assertOk(await emitWithAck(socket, 'saveStatusPage', slug, config, '/icon.svg', [{ name: 'Services', monitorList }]), 'saveStatusPage');
}

/** @param {MonitorSocket} socket @param {ProvisionOptions} options @returns {Promise<{created: string[]}>} */
export async function provisionMonitors(socket, options) {
  const needSetup = await emitWithAck(socket, 'needSetup');
  if (needSetup === true) {
    assertOk(await emitWithAck(socket, 'setup', options.username, options.password), 'setup');
  }

  const statusPagesPromise = waitForEvent(socket, 'statusPageList');
  void statusPagesPromise.catch(() => undefined);
  assertOk(await emitWithAck(socket, 'login', { username: options.username, password: options.password }), 'login');

  const existing = await getMonitorList(socket);
  const missing = missingMonitors(existing, options);
  /** @type {string[]} */
  const created = [];
  for (const monitor of missing) {
    const response = await emitWithAck(socket, 'add', {
      ...monitor,
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

  try {
    await saveStatusPage(socket, options, normalizeStatusPageList(await statusPagesPromise));
  } catch (error) {
    console.warn(`Uptime Kuma status page initialization failed: ${safeError(error, options.password)}`);
    throw error;
  }

  return { created };
}

/** @param {{ username: string; password: string; includeLanding: boolean; apiUrl?: string; webUrl?: string; adminUrl?: string; landingUrl?: string; statusPageSlug?: string; statusPageTitle?: string }} options @returns {Promise<{created: string[]}>} */
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
    adminUrl: process.env.KUMA_MONITOR_ADMIN_URL,
    landingUrl: process.env.KUMA_MONITOR_LANDING_URL,
    statusPageSlug: process.env.STATUS_PAGE_SLUG || 'status',
    statusPageTitle: process.env.STATUS_PAGE_TITLE || 'Slipakar status',
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
