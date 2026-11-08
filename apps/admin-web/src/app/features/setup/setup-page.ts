import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiError } from '../../core/api-error';
import { HlmButton } from '../../ui/button/src';
import { ConfirmModal, Drawer, PageHeader } from '../../ui';
import { AdminSetupService, type IntegrationItem, type IntegrationKey, type IntegrationUpdate } from './admin-setup.service';

type IntegrationForm = {
  baseUrl: string;
  username: string;
  password: string;
  apiKey: string;
  apiToken: string;
  host: string;
  port: number;
  secure: boolean;
  fromAddress: string;
};

const emptyForm = (): IntegrationForm => ({ baseUrl: '', username: '', password: '', apiKey: '', apiToken: '', host: '', port: 587, secure: false, fromAddress: '' });

@Component({
  selector: 'app-setup-page',
  imports: [CommonModule, FormsModule, RouterLink, HlmButton, ConfirmModal, Drawer, PageHeader],
  template: `
    <app-page-header
      title="Setup"
      description="Connect the services the admin workspace needs."
      badge="Admin"
      [topLevel]="true"
    />
    @if (error()) { <p role="alert" class="rounded-ui-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{{ error() }}</p> }
    @if (loading()) { <p role="status">Loading integration settings…</p> }
    @if (setup.view(); as state) {
      @if (state.complete) { <div class="flex flex-wrap items-center justify-between gap-3 rounded-ui-md border border-emerald-500/30 bg-emerald-500/10 p-4"><p class="text-sm">All integrations are configured and passing their connection tests.</p><a routerLink="/flags" class="rounded-ui-md bg-primary px-4 py-2 text-sm text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Continue to admin</a></div> }
      <div class="grid items-stretch gap-4 md:grid-cols-3">
        @for (integration of state.integrations; track integration.key) {
          <article class="flex min-w-0 flex-col rounded-ui-lg border border-border bg-card p-card">
            <div class="flex flex-wrap items-start justify-between gap-3"><div><h2 class="text-lg font-semibold">{{ integration.key === 'mail' ? 'Mail' : integration.label }}</h2><p class="mt-1 text-sm text-muted-foreground">{{ description(integration.key) }}</p></div><span class="rounded-full border px-2.5 py-1 text-xs font-medium" [ngClass]="statusClass(integration)">{{ statusLabel(integration) }}</span></div>
            @if (integration.source) { <p class="mt-4 text-sm text-muted-foreground">Source: <span class="font-medium text-foreground">{{ integration.source === 'env' ? 'Environment' : 'Database' }}</span></p> }
            @if (integration.baseUrl && integration.key !== 'mail') { <p class="mt-2 break-all text-xs text-muted-foreground">{{ integration.baseUrl }}</p> }
            @if (integration.credentialHint) { <p class="mt-2 text-xs text-muted-foreground">Saved credential: {{ integration.credentialHint }}</p> }
            @if (integration.lastError) { <p role="alert" class="mt-3 text-sm text-destructive">{{ integration.lastError }}</p> }
            <div class="mt-auto flex flex-wrap gap-2 pt-6"><button hlmBtn type="button" (click)="openEditor(integration)">{{ integration.configured ? 'Edit settings' : 'Configure' }}</button><button hlmBtn variant="outline" type="button" [disabled]="!integration.configured || busy()" (click)="testConnection(integration.key)">Test connection</button>@if (integration.source === 'database') { <button hlmBtn variant="destructive" type="button" (click)="requestClear(integration.key)">Clear saved settings</button> }</div>
          </article>
        }
      </div>
    }
    <app-drawer [open]="editing() !== null" [title]="drawerTitle()" (closed)="editing.set(null)">
      @if (editing(); as item) {
        <form class="grid gap-4" (ngSubmit)="saveSettings()">
          @if (item.key === 'uptime' || item.key === 'grafana') {
            <label class="grid gap-1.5 text-sm font-medium" for="integration-url">Base URL<input id="integration-url" name="baseUrl" type="url" required [(ngModel)]="form().baseUrl" placeholder="https://example.com" class="min-h-11 rounded-ui-md border border-input bg-background px-3 font-normal" /></label>
          }
          @if (item.key === 'uptime') {
            <p class="text-xs text-muted-foreground">Use either an API key or a username and password. Leave saved secret fields blank to keep the current credential.</p>
            <label class="grid gap-1.5 text-sm font-medium" for="uptime-api-key">API key<input id="uptime-api-key" name="apiKey" type="password" autocomplete="new-password" [(ngModel)]="form().apiKey" placeholder="Enter password" class="min-h-11 rounded-ui-md border border-input bg-background px-3 font-normal" /></label>
            <label class="grid gap-1.5 text-sm font-medium" for="uptime-username">Username<input id="uptime-username" name="username" [(ngModel)]="form().username" placeholder="Username" class="min-h-11 rounded-ui-md border border-input bg-background px-3 font-normal" /></label>
            <label class="grid gap-1.5 text-sm font-medium" for="uptime-password">Password<input id="uptime-password" name="password" type="password" autocomplete="new-password" [(ngModel)]="form().password" placeholder="Enter password" class="min-h-11 rounded-ui-md border border-input bg-background px-3 font-normal" /></label>
          }
          @if (item.key === 'grafana') {
            <p class="text-xs text-muted-foreground">Leave the token blank to keep the saved credential. Tokens are never shown again.</p>
            <label class="grid gap-1.5 text-sm font-medium" for="grafana-token">API token<input id="grafana-token" name="apiToken" type="password" autocomplete="new-password" [(ngModel)]="form().apiToken" placeholder="Enter password" class="min-h-11 rounded-ui-md border border-input bg-background px-3 font-normal" /></label>
          }
          @if (item.key === 'mail') {
            <label class="grid gap-1.5 text-sm font-medium" for="mail-host">SMTP host<input id="mail-host" name="host" required [(ngModel)]="form().host" placeholder="smtp.example.com" class="min-h-11 rounded-ui-md border border-input bg-background px-3 font-normal" /></label>
            <label class="grid gap-1.5 text-sm font-medium" for="mail-port">Port<input id="mail-port" name="port" type="number" min="1" max="65535" required [(ngModel)]="form().port" placeholder="587" class="min-h-11 rounded-ui-md border border-input bg-background px-3 font-normal" /></label>
            <label class="flex min-h-11 items-center gap-3 text-sm font-medium" for="mail-secure"><input id="mail-secure" name="secure" type="checkbox" [(ngModel)]="form().secure" />Use TLS</label>
            <label class="grid gap-1.5 text-sm font-medium" for="mail-from">From address<input id="mail-from" name="fromAddress" type="email" required [(ngModel)]="form().fromAddress" placeholder="name@example.com" class="min-h-11 rounded-ui-md border border-input bg-background px-3 font-normal" /></label>
            <label class="grid gap-1.5 text-sm font-medium" for="mail-username">Username (optional)<input id="mail-username" name="username" [(ngModel)]="form().username" placeholder="Username" class="min-h-11 rounded-ui-md border border-input bg-background px-3 font-normal" /></label>
            <label class="grid gap-1.5 text-sm font-medium" for="mail-password">Password (write only)<input id="mail-password" name="password" type="password" autocomplete="new-password" [(ngModel)]="form().password" placeholder="Enter password" class="min-h-11 rounded-ui-md border border-input bg-background px-3 font-normal" /><span class="text-xs font-normal text-muted-foreground">{{ item.hasCredentials ? 'Saved. Enter a value only to replace it.' : 'Leave empty if this server does not require authentication.' }}</span></label>
          }
          @if (actionError()) { <p role="alert" class="text-sm text-destructive">{{ actionError() }}</p> }
          <div class="flex flex-wrap justify-end gap-2 border-t border-border pt-4"><button hlmBtn variant="outline" type="button" (click)="editing.set(null)">Cancel</button><button hlmBtn type="submit" [disabled]="busy()">{{ busy() ? 'Saving…' : 'Save settings' }}</button></div>
        </form>
        @if (item.configured) { <div class="mt-4 border-t border-border pt-4"><button hlmBtn variant="outline" type="button" [disabled]="busy()" (click)="testConnection(item.key)">Test connection</button>@if (testMessage()) { <p role="status" class="mt-2 text-sm">{{ testMessage() }}</p> }</div> }
      }
    </app-drawer>
    <app-confirm-modal [open]="clearing() !== null" title="Clear saved integration settings?" message="The saved URL and credentials will be removed. Environment configured mail will remain available." confirmLabel="Clear settings" (cancelled)="clearing.set(null)" (confirmed)="clearSettings()" />
  `,
})
export class SetupPage implements OnInit {
  protected readonly setup = inject(AdminSetupService);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly actionError = signal('');
  protected readonly testMessage = signal('');
  protected readonly editing = signal<IntegrationItem | null>(null);
  protected readonly clearing = signal<IntegrationKey | null>(null);
  protected readonly form = signal<IntegrationForm>(emptyForm());

  ngOnInit(): void { void this.load(); }

  protected async load(): Promise<void> {
    this.loading.set(true); this.error.set('');
    try { await this.setup.load(); } catch (error: unknown) { this.error.set(this.errorMessage(error)); }
    finally { this.loading.set(false); }
  }

  protected description(key: IntegrationKey): string {
    return key === 'uptime' ? 'Connect Uptime Kuma for service health monitoring.' : key === 'grafana' ? 'Connect Grafana to open monitoring dashboards.' : 'Configure the SMTP server used for platform email.';
  }

  protected statusLabel(item: IntegrationItem): string { return !item.configured ? 'Not configured' : item.lastStatus === 'failed' ? 'Failing' : 'Configured'; }
  protected statusClass(item: IntegrationItem): string { return !item.configured ? 'border-border bg-muted text-muted-foreground' : item.lastStatus === 'failed' ? 'border-destructive/40 bg-destructive/10 text-destructive' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'; }
  protected drawerTitle(): string { const item = this.editing(); return item ? `Configure ${item.key === 'mail' ? 'Mail' : item.label}` : 'Configure integration'; }

  protected openEditor(item: IntegrationItem): void {
    this.actionError.set(''); this.testMessage.set('');
    this.form.set({
      ...emptyForm(),
      baseUrl: item.key === 'mail' ? '' : item.baseUrl ?? '',
      host: item.key === 'mail' ? item.settings?.host ?? item.baseUrl ?? '' : '',
      port: item.settings?.port ?? 587,
      secure: item.settings?.secure ?? false,
      username: item.settings?.username ?? '',
      fromAddress: item.settings?.fromAddress ?? '',
    });
    this.editing.set(item);
  }

  protected async saveSettings(): Promise<void> {
    const item = this.editing(); if (!item) return;
    this.busy.set(true); this.actionError.set('');
    try {
      const fields = this.form();
      const payload: IntegrationUpdate = item.key === 'uptime'
        ? { baseUrl: fields.baseUrl, username: fields.username || undefined, password: fields.password || undefined, apiKey: fields.apiKey || undefined }
        : item.key === 'grafana'
          ? { baseUrl: fields.baseUrl, apiToken: fields.apiToken || undefined }
          : { host: fields.host, port: Number(fields.port), secure: fields.secure, username: fields.username || undefined, password: fields.password || undefined, fromAddress: fields.fromAddress };
      const updated = await this.setup.save(item.key, payload);
      this.editing.set(updated);
      this.form.update((current) => ({ ...current, password: '', apiKey: '', apiToken: '' }));
      this.testMessage.set('Settings saved. Test the connection to complete setup.');
    } catch (error: unknown) { this.actionError.set(this.errorMessage(error)); }
    finally { this.busy.set(false); }
  }

  protected async testConnection(key: IntegrationKey): Promise<void> {
    this.busy.set(true); this.actionError.set(''); this.testMessage.set('Testing connection…');
    try { const result = await this.setup.test(key); this.editing.update((current) => current?.key === key ? result : current); this.testMessage.set(result.lastStatus === 'ok' ? 'Connection successful.' : result.lastError || 'Connection failed.'); }
    catch (error: unknown) { this.testMessage.set(''); this.actionError.set(this.errorMessage(error)); }
    finally { this.busy.set(false); }
  }

  protected requestClear(key: IntegrationKey): void { this.clearing.set(key); }

  protected async clearSettings(): Promise<void> {
    const key = this.clearing(); if (!key) return;
    this.clearing.set(null); this.busy.set(true); this.error.set('');
    try { await this.setup.clear(key); } catch (error: unknown) { this.error.set(this.errorMessage(error)); }
    finally { this.busy.set(false); }
  }

  private errorMessage(error: unknown): string { return error instanceof ApiError ? error.message : error instanceof Error ? error.message : 'Request failed'; }
}
