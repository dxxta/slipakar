import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { provisionMonitors, type MonitorSocket } from '../../infra/uptime-kuma/kuma-init.mjs';

class FakeKumaSocket extends EventEmitter implements MonitorSocket {
  readonly monitors: { name: string; type: string; url?: string }[] = [];
  readonly calls: string[] = [];
  setupNeeded = true;

  emit(event: string, ...args: unknown[]): boolean {
    this.calls.push(event);
    const callback = args.at(-1);
    if (event === 'needSetup' && typeof callback === 'function') callback(this.setupNeeded);
    if (event === 'setup' && typeof callback === 'function') {
      this.setupNeeded = false;
      callback({ ok: true });
    }
    if (event === 'login' && typeof callback === 'function') callback({ ok: true, token: 'test-token' });
    if (event === 'getMonitorList') {
      setTimeout(() => super.emit('monitorList', Object.fromEntries(this.monitors.map((monitor, index) => [String(index + 1), monitor]))), 0);
      if (typeof callback === 'function') callback({ ok: true });
    }
    if (event === 'add' && typeof callback === 'function') {
      const monitor = args[0] as { name: string; type: string; url?: string };
      this.monitors.push(monitor);
      callback({ ok: true });
    }
    return true;
  }
}

describe('Kuma initialization helpers', () => {
  it('sets up, logs in and creates only missing monitors; reruns are no-ops', async () => {
    const socket = new FakeKumaSocket();
    const options = { username: 'admin', password: 'secret', includeLanding: false };

    const first = await provisionMonitors(socket, options);
    const second = await provisionMonitors(socket, options);

    expect(socket.calls).toContain('setup');
    expect(socket.calls.filter((event) => event === 'add')).toHaveLength(2);
    expect(first.created).toEqual(['Slipakar API', 'Slipakar Web']);
    expect(second.created).toEqual([]);
    expect(socket.monitors.map((monitor) => monitor.name)).toEqual(['Slipakar API', 'Slipakar Web']);
    expect(socket.monitors[0]).toMatchObject({ type: 'http', url: 'http://api:3000/health' });
  });

  it('includes the landing monitor only when requested', async () => {
    const socket = new FakeKumaSocket();
    const result = await provisionMonitors(socket, { username: 'admin', password: 'secret', includeLanding: true });
    expect(result.created).toEqual(['Slipakar API', 'Slipakar Web', 'Slipakar Landing']);
  });
});
