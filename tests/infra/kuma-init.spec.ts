import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { missingMonitors, provisionMonitors, type MonitorSocket } from '../../infra/uptime-kuma/kuma-init.mjs';

type FakeMonitor = { id: number; name: string; type: string; url?: string };
type FakeStatusPage = { slug: string; config?: { slug: string }; groups?: unknown[] };

class FakeKumaSocket extends EventEmitter implements MonitorSocket {
  readonly monitors: FakeMonitor[] = [];
  readonly calls: string[] = [];
  readonly statusPages: FakeStatusPage[] = [];
  readonly savedGroups: { name: string; monitorList: { id: number }[] }[][] = [];
  setupNeeded = true;
  private nextMonitorId = 1;

  emit(event: string, ...args: unknown[]): boolean {
    this.calls.push(event);
    const callbackValue = args.at(-1);
    const callback = typeof callbackValue === 'function' ? callbackValue as (value: unknown) => void : undefined;
    if (event === 'needSetup') callback?.(this.setupNeeded);
    if (event === 'setup') {
      this.setupNeeded = false;
      callback?.({ ok: true });
    }
    if (event === 'login') {
      setTimeout(() => super.emit('statusPageList', [...this.statusPages]), 0);
      callback?.({ ok: true, token: 'test-token' });
    }
    if (event === 'getMonitorList') {
      setTimeout(() => super.emit('monitorList', Object.fromEntries(this.monitors.map((monitor) => [String(monitor.id), monitor]))), 0);
      callback?.({ ok: true });
    }
    if (event === 'add') {
      const monitor = args[0] as Omit<FakeMonitor, 'id'>;
      this.monitors.push({ ...monitor, id: this.nextMonitorId++ });
      callback?.({ ok: true });
    }
    if (event === 'addStatusPage') {
      const title = args[0] as string;
      const slug = args[1] as string;
      this.statusPages.push({ slug, config: { slug }, groups: [{ title }] });
      callback?.({ ok: true, slug });
    }
    if (event === 'saveStatusPage') {
      const groups = args[3] as { name: string; monitorList: { id: number }[] }[];
      this.savedGroups.push(groups);
      callback?.({ ok: true });
    }
    return true;
  }
}

describe('Kuma initialization helpers', () => {
  it('creates only configured monitors, adds Admin, and refreshes the existing status page without duplicates', async () => {
    const socket = new FakeKumaSocket();
    const options = {
      username: 'admin',
      password: 'secret',
      includeLanding: false,
      webUrl: 'https://app.example.com/healthz',
      adminUrl: 'https://admin.example.com/healthz',
      apiUrl: 'https://api.example.com/health',
      landingUrl: '',
      statusPageSlug: 'status',
      statusPageTitle: 'Slipakar status',
    };

    const first = await provisionMonitors(socket, options);
    const second = await provisionMonitors(socket, { ...options, includeLanding: true, landingUrl: 'https://landing.example.com/healthz' });
    const third = await provisionMonitors(socket, { ...options, includeLanding: true, landingUrl: 'https://landing.example.com/healthz' });

    expect(socket.calls).toContain('setup');
    expect(socket.calls.filter((event) => event === 'add')).toHaveLength(4);
    expect(socket.calls.filter((event) => event === 'addStatusPage')).toHaveLength(1);
    expect(socket.calls.filter((event) => event === 'saveStatusPage')).toHaveLength(3);
    expect(first.created).toEqual(['Slipakar Web', 'Slipakar Admin', 'Slipakar API']);
    expect(second.created).toEqual(['Slipakar Landing']);
    expect(third.created).toEqual([]);
    expect(socket.monitors.map(({ name }) => name)).toEqual(['Slipakar Web', 'Slipakar Admin', 'Slipakar API', 'Slipakar Landing']);
    expect(socket.monitors[1]).toMatchObject({ name: 'Slipakar Admin', type: 'http', url: 'https://admin.example.com/healthz' });
    expect(socket.savedGroups.at(-1)?.[0]).toMatchObject({ name: 'Services', monitorList: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }] });
  });

  it('skips monitors whose URL is empty, even when landing monitoring is enabled', () => {
    expect(missingMonitors([], {
      username: 'admin',
      password: 'secret',
      includeLanding: true,
      webUrl: '',
      adminUrl: '',
      apiUrl: '',
      landingUrl: '',
    })).toEqual([]);
  });
});
