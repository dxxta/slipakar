import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerChevronDown, tablerInfoCircle } from '@ng-icons/tabler-icons';
import { ApiError } from '../../core/api-error';
import { HlmButton } from '../../ui/button/src';
import { ConfirmModal, Drawer, PageHeader } from '../../ui';
import { AdminSetupService, type IntegrationItem, type IntegrationKey, type IntegrationUpdate } from './admin-setup.service';
import { Ripple } from '../../ui/shared/ripple';
import { Pressed } from '../../ui/shared/pressed';

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
  imports: [Ripple, Pressed, CommonModule, NgTemplateOutlet, FormsModule, RouterLink, NgIcon, HlmButton, ConfirmModal, Drawer, PageHeader],
  viewProviders: [provideIcons({ tablerChevronDown, tablerInfoCircle })],
  template: `
    <app-page-header
      title="Setup"
      description="Connect the services the admin workspace needs."
      badge="Admin"
      [topLevel]="true"
    />
    @if (error()) { <p role="alert" class="rounded-ui-md border border-[#E5484D]/30 bg-[#E5484D]/10 p-3 text-sm text-[#E5484D]">{{ error() }}</p> }
    @if (loading()) { <p role="status">Loading integration settings…</p> }
    @if (setup.view(); as state) {
      <div class="grid grid-cols-1 gap-4" data-testid="setup-integration-rows">
        @for (integration of state.integrations; track integration.key) {
          <article appPressed class="flex w-full min-w-0 flex-col rounded-ui-lg border border-border bg-card p-card" [attr.data-testid]="'setup-row-' + integration.key">
            <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-6">
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2.5">
                  <h2 class="text-lg font-semibold">{{ integration.key === 'mail' ? 'Mail' : integration.label }}</h2>
                  <span class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium" [ngClass]="statusClass(integration)"><span aria-hidden="true" class="size-1.5 rounded-full" [ngClass]="statusDotClass(integration)"></span>{{ statusLabel(integration) }}</span>
                </div>
                <p class="mt-1 text-sm text-muted-foreground">{{ description(integration.key) }}</p>
                @if (integration.source || (integration.baseUrl && integration.key !== 'mail') || integration.credentialHint) {
                  <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    @if (integration.source) {
                      <p>Source: <span class="font-medium text-foreground">{{ integration.source === 'env' ? 'Environment' : 'Database' }}</span></p>
                    }
                    @if (integration.source === 'env' && integration.key !== 'mail') {
                      <p>Configured by the Docker environment. Change the container environment to edit these settings.</p>
                    }
                    @if (integration.baseUrl && integration.key !== 'mail') {
                      <p class="break-all">{{ integration.baseUrl }}</p>
                    }
                    @if (integration.credentialHint) {
                      <p>Saved credential: {{ integration.credentialHint }}</p>
                    }
                  </div>
                }
                @if (integration.lastError) {
                  <p role="alert" class="mt-3 rounded-ui-md border border-[#E5484D]/30 bg-[#E5484D]/10 px-3 py-2 text-sm text-[#E5484D]">{{ integration.lastError }}</p>
                }
              </div>
              <div class="flex shrink-0 flex-wrap items-center gap-2 md:justify-end">
                @if (integration.source !== 'env' || integration.key === 'mail') { <button hlmBtn type="button" (click)="openEditor(integration)">{{ integration.configured ? 'Edit settings' : 'Configure' }}</button> }
                <button hlmBtn variant="outline" type="button" [disabled]="!integration.configured || busy()" (click)="testConnection(integration.key)">Test connection</button>
                @if (integration.source === 'database') {
                  <button hlmBtn variant="destructive" type="button" (click)="requestClear(integration.key)">Clear saved settings</button>
                }
              </div>
            </div>
            <div class="mt-4 w-full border-t border-border pt-3">
              <button
                type="button"
                class="flex min-h-9 w-full items-center justify-between gap-2 rounded-ui-md px-2 py-1.5 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Setup guide"
                [attr.aria-expanded]="isHelpOpen(integration.key)"
                [attr.aria-controls]="'setup-help-' + integration.key"
                [attr.data-testid]="'help-toggle-' + integration.key"
                (click)="toggleHelp(integration.key)"
              >
                <span class="inline-flex items-center gap-1.5">
                  <ng-icon name="tablerInfoCircle" size="14" aria-hidden="true" />
                  <span>How to configure</span>
                </span>
                <ng-icon
                  name="tablerChevronDown"
                  size="14"
                  aria-hidden="true"
                  class="shrink-0 transition-transform"
                  [class.rotate-180]="isHelpOpen(integration.key)"
                />
              </button>
              @if (isHelpOpen(integration.key)) {
                <div [id]="'setup-help-' + integration.key" [attr.data-testid]="'card-help-' + integration.key" class="mt-2 rounded-ui-md bg-muted/40 p-3">
                  <ng-container *ngTemplateOutlet="helpSteps; context: { $implicit: integration.key }" />
                </div>
              }
            </div>
          </article>
        }
      </div>
    }
    <app-drawer [open]="editing() !== null" [title]="drawerTitle()" (closed)="editing.set(null)">
      @if (editing(); as item) {
        <div [attr.data-testid]="'drawer-help-' + item.key" class="mb-4 rounded-ui-md border border-border bg-muted/40 p-3">
          <p class="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
            <ng-icon name="tablerInfoCircle" size="14" aria-hidden="true" />
            <span>How to configure</span>
          </p>
          <ng-container *ngTemplateOutlet="helpSteps; context: { $implicit: item.key }" />
        </div>
        <form id="integration-form" class="grid gap-4" (ngSubmit)="saveSettings()">
          @if (item.key === 'uptime' || item.key === 'grafana') {
            <label class="grid gap-1.5 text-sm font-medium" for="integration-url">Base URL<input id="integration-url" name="baseUrl" type="url" required [(ngModel)]="form().baseUrl" placeholder="https://example.com" class="h-control-9 rounded-ui-md border border-input bg-background px-3 font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label>
          }
          @if (item.key === 'uptime') {
            <p class="text-xs text-muted-foreground">Use either an API key or a username and password. Leave saved secret fields blank to keep the current credential.</p>
            <label class="grid gap-1.5 text-sm font-medium" for="uptime-api-key">API key<input id="uptime-api-key" name="apiKey" type="password" autocomplete="new-password" [(ngModel)]="form().apiKey" placeholder="Enter password" class="h-control-9 rounded-ui-md border border-input bg-background px-3 font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label>
            <label class="grid gap-1.5 text-sm font-medium" for="uptime-username">Username<input id="uptime-username" name="username" [(ngModel)]="form().username" placeholder="Username" class="h-control-9 rounded-ui-md border border-input bg-background px-3 font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label>
            <label class="grid gap-1.5 text-sm font-medium" for="uptime-password">Password<input id="uptime-password" name="password" type="password" autocomplete="new-password" [(ngModel)]="form().password" placeholder="Enter password" class="h-control-9 rounded-ui-md border border-input bg-background px-3 font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label>
          }
          @if (item.key === 'grafana') {
            <p class="text-xs text-muted-foreground">Leave the token blank to keep the saved credential. Tokens are never shown again.</p>
            <label class="grid gap-1.5 text-sm font-medium" for="grafana-token">API token<input id="grafana-token" name="apiToken" type="password" autocomplete="new-password" [(ngModel)]="form().apiToken" placeholder="Enter password" class="h-control-9 rounded-ui-md border border-input bg-background px-3 font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label>
          }
          @if (item.key === 'mail') {
            <label class="grid gap-1.5 text-sm font-medium" for="mail-host">SMTP host<input id="mail-host" name="host" required [(ngModel)]="form().host" placeholder="smtp.example.com" class="h-control-9 rounded-ui-md border border-input bg-background px-3 font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label>
            <label class="grid gap-1.5 text-sm font-medium" for="mail-port">Port<input id="mail-port" name="port" type="number" min="1" max="65535" required [(ngModel)]="form().port" placeholder="587" class="h-control-9 rounded-ui-md border border-input bg-background px-3 font-normal tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label>
            <label class="flex h-control-9 items-center gap-3 text-sm font-medium" for="mail-secure"><input id="mail-secure" name="secure" type="checkbox" [(ngModel)]="form().secure" />Use TLS</label>
            <label class="grid gap-1.5 text-sm font-medium" for="mail-from">From address<input id="mail-from" name="fromAddress" type="email" required [(ngModel)]="form().fromAddress" placeholder="name@example.com" class="h-control-9 rounded-ui-md border border-input bg-background px-3 font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label>
            <label class="grid gap-1.5 text-sm font-medium" for="mail-username">Username (optional)<input id="mail-username" name="username" [(ngModel)]="form().username" placeholder="Username" class="h-control-9 rounded-ui-md border border-input bg-background px-3 font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label>
            <label class="grid gap-1.5 text-sm font-medium" for="mail-password">Password (write only)<input id="mail-password" name="password" type="password" autocomplete="new-password" [(ngModel)]="form().password" placeholder="Enter password" class="h-control-9 rounded-ui-md border border-input bg-background px-3 font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring" /><span class="text-xs font-normal text-muted-foreground">{{ item.hasCredentials ? 'Saved. Enter a value only to replace it.' : 'Leave empty if this server does not require authentication.' }}</span></label>
          }
          @if (actionError()) { <p role="alert" class="rounded-ui-md border border-[#E5484D]/30 bg-[#E5484D]/10 px-3 py-2 text-sm text-[#E5484D]">{{ actionError() }}</p> }
        </form>
      }
      @if (editing()) {
        <div drawer-footer class="contents"><button hlmBtn variant="outline" type="button" (click)="editing.set(null)">Cancel</button><button hlmBtn type="submit" form="integration-form" [disabled]="busy()">{{ busy() ? 'Saving…' : 'Save settings' }}</button></div>
      }
    </app-drawer>
    <ng-template #helpSteps let-key>
      @if (key === 'uptime') {
        <ol class="list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-muted-foreground break-words">
          <li>Base URL is the address the API server uses to reach Uptime Kuma. Docker Compose stack: <code class="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">http://uptime-kuma:3001</code>. API run on your own machine: <code class="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">http://localhost:3002</code>.</li>
          <li>Docker Compose initializes Uptime Kuma automatically with <code class="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">UPTIME_KUMA_ADMIN_USER</code> (default <code class="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">admin</code>) and <code class="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">UPTIME_KUMA_ADMIN_PASSWORD</code>. Open the browser UI at <code class="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">http://127.0.0.1:3002</code>.</li>
          <li>The API tests the configured URL using these credentials. The initializer creates Slipakar API and Web monitors; the optional Landing monitor is controlled by <code class="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">KUMA_MONITOR_LANDING</code>.</li>
          <li>When the integration source is Environment, update its settings in Docker Compose environment values and recreate the API service. Database-saved settings take priority.</li>
          <li>Save. Saved secrets are never shown again; leave a secret blank later to keep it.</li>
        </ol>
      } @else if (key === 'grafana') {
        <ol class="list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-muted-foreground break-words">
          <li>Base URL is the address the API server uses to reach Grafana. Docker Compose stack: <code class="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">http://grafana:3000</code>. API on your own machine: <code class="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">http://localhost:3001</code>.</li>
          <li>Open Grafana (default <code class="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">http://127.0.0.1:3001</code>) and sign in as <code class="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">admin</code> with the <code class="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">GRAFANA_ADMIN_PASSWORD</code> from your <code class="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">.env</code> file.</li>
          <li>Create a token: <code class="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">Administration &gt; Users and access &gt; Service accounts &gt; Add service account</code> (role <code class="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">Viewer</code>) <code class="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">&gt; Add service account token</code>. Copy it now; Grafana shows it only once.</li>
          <li>Paste it as <code class="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">API token</code> (optional but recommended) and save. Prometheus data source and dashboard are already provisioned.</li>
        </ol>
      } @else {
        <ol class="list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-muted-foreground break-words">
          <li>Mail is the SMTP server used for platform emails (profile email change, broadcasts, sign-in mail).</li>
          <li>Enter your provider's SMTP host, port, and From address. Port <code class="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">587</code> uses STARTTLS: leave <code class="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">Use TLS</code> off. Port <code class="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">465</code> uses implicit TLS: turn <code class="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">Use TLS</code> on.</li>
          <li>Username and password are needed by most providers (for Gmail use an app password, not your normal password). Leave both empty only for servers without authentication.</li>
          <li>If <code class="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">AUTH_SMTP_*</code> variables are set in the environment, the Mail card shows as configured; settings saved here take priority over them. Clearing the saved settings returns to the environment values.</li>
          <li>Save, then use the test action on the card to confirm it works.</li>
        </ol>
      }
    </ng-template>
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
  protected readonly testStatus = signal<Partial<Record<IntegrationKey, 'ok' | 'failed'>>>({});
  protected readonly editing = signal<IntegrationItem | null>(null);
  protected readonly clearing = signal<IntegrationKey | null>(null);
  protected readonly form = signal<IntegrationForm>(emptyForm());
  protected readonly expandedHelp = signal<Record<IntegrationKey, boolean>>({
    uptime: false,
    grafana: false,
    mail: false,
  });

  ngOnInit(): void { void this.load(); }

  protected isHelpOpen(key: IntegrationKey): boolean {
    return this.expandedHelp()[key];
  }

  protected toggleHelp(key: IntegrationKey): void {
    this.expandedHelp.update((current) => ({ ...current, [key]: !current[key] }));
  }

  protected async load(): Promise<void> {
    this.loading.set(true); this.error.set('');
    try { await this.setup.load(); } catch (error: unknown) { this.error.set(this.errorMessage(error)); }
    finally { this.loading.set(false); }
  }

  protected description(key: IntegrationKey): string {
    return key === 'uptime' ? 'Connect Uptime Kuma for service health monitoring.' : key === 'grafana' ? 'Connect Grafana to open monitoring dashboards.' : 'Configure the SMTP server used for platform email.';
  }

  protected statusLabel(item: IntegrationItem): string {
    const tested = this.testStatus()[item.key];
    return tested === 'ok' ? 'Connected' : tested === 'failed' ? 'Failed to connect' : !item.configured ? 'Not configured' : 'Configured';
  }
  protected statusClass(item: IntegrationItem): string {
    const tested = this.testStatus()[item.key];
    return tested === 'ok' ? 'border-primary/40 bg-primary/10 text-foreground'
      : tested === 'failed' ? 'border-[#E5484D]/40 bg-[#E5484D]/10 text-[#E5484D]'
      : 'border-border bg-muted text-muted-foreground';
  }
  protected statusDotClass(item: IntegrationItem): string {
    const tested = this.testStatus()[item.key];
    return tested === 'ok' ? 'bg-primary' : tested === 'failed' ? 'bg-[#E5484D]' : 'bg-muted-foreground';
  }
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
      await this.setup.save(item.key, payload);
      this.testStatus.update((current) => ({ ...current, [item.key]: undefined }));
      this.form.set(emptyForm());
      this.editing.set(null);
    } catch (error: unknown) { this.actionError.set(this.errorMessage(error)); }
    finally { this.busy.set(false); }
  }

  protected async testConnection(key: IntegrationKey): Promise<void> {
    this.busy.set(true); this.actionError.set(''); this.testMessage.set('Testing connection…');
    try { const result = await this.setup.test(key); this.testStatus.update((current) => ({ ...current, [key]: result.lastStatus === 'ok' ? 'ok' : 'failed' })); this.editing.update((current) => current?.key === key ? result : current); this.testMessage.set(result.lastStatus === 'ok' ? 'Connection successful.' : result.lastError || 'Connection failed.'); }
    catch (error: unknown) { this.testStatus.update((current) => ({ ...current, [key]: 'failed' })); this.testMessage.set(''); this.actionError.set(this.errorMessage(error)); }
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
