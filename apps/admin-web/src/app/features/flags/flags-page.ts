import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ApiError } from '../../core/api-error';
import { HlmAlert, HlmAlertDescription, HlmAlertTitle } from '../../ui/alert/src';
import { HlmBadge } from '../../ui/badge/src';
import { HlmButton } from '../../ui/button/src';
import { HlmCard, HlmCardContent, HlmCardDescription, HlmCardHeader, HlmCardTitle } from '../../ui/card/src';
import { HlmSwitch } from '../../ui/switch/src';
import { PageHeader } from '../../ui/shared/page-header';
import { FEATURE_FLAG_DEFINITIONS, type FeatureFlagKey, type FeatureFlags, FlagsService } from './flags.service';

@Component({
  selector: 'app-flags-page',
  imports: [
    CommonModule,
    HlmCard,
    HlmCardHeader,
    HlmCardTitle,
    HlmCardDescription,
    HlmCardContent,
    HlmSwitch,
    HlmButton,
    HlmBadge,
    HlmAlert,
    HlmAlertTitle,
    HlmAlertDescription,
    PageHeader,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Feature flags" badge="Admin" [topLevel]="true" />

    @if (errorAlert()) {
      <div class="mb-6" aria-live="polite" role="alert">
        <div hlmAlert variant="destructive">
          <h4 hlmAlertTitle>Error updating feature flag</h4>
          <p hlmAlertDescription>{{ errorAlert() }}</p>
        </div>
      </div>
    }

    @if (loading()) {
      <div data-testid="flags-loading-skeleton" class="grid gap-4 md:grid-cols-3">
        @for (item of definitions; track item.key) {
          <div hlmCard class="animate-pulse">
            <div hlmCardHeader>
              <div class="h-5 w-32 rounded bg-muted"></div>
              <div class="mt-2 h-4 w-48 rounded bg-muted/60"></div>
            </div>
            <div hlmCardContent class="flex items-center justify-between pt-2">
              <div class="h-6 w-11 rounded-full bg-muted"></div>
            </div>
          </div>
        }
      </div>
    } @else if (loadError()) {
      <div data-testid="flags-error-state" class="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center" aria-live="polite">
        <p class="text-sm font-medium text-destructive mb-1">Failed to load feature flags</p>
        <p class="text-xs text-muted-foreground mb-4">{{ loadError() }}</p>
        <button hlmBtn variant="outline" (click)="loadFlags()">Retry</button>
      </div>
    } @else {
      <div class="grid gap-4 md:grid-cols-3">
        @for (flag of definitions; track flag.key) {
          <div hlmCard [attr.data-testid]="'flag-card-' + flag.key">
            <div hlmCardHeader>
              <div class="flex items-center justify-between">
                <h3 hlmCardTitle class="text-base font-medium">{{ flag.label }}</h3>
                @if (savedState()[flag.key]) {
                  <span hlmBadge variant="outline" class="text-xs text-emerald-700 dark:text-emerald-300 border-emerald-500/25 bg-emerald-500/10">
                    Saved
                  </span>
                }
              </div>
              <p hlmCardDescription>{{ flag.description }}</p>
            </div>
            <div hlmCardContent class="flex items-center justify-between pt-2">
              <span class="text-xs text-muted-foreground">
                {{ flags()[flag.key] ? 'Enabled' : 'Disabled' }}
              </span>
              <hlm-switch
                [inputId]="'switch-' + flag.key"
                [aria-label]="flag.label"
                [checked]="flags()[flag.key]"
                [disabled]="isUpdating(flag.key)"
                (checkedChange)="toggle(flag.key, $event)"
              />
            </div>
          </div>
        }
      </div>
    }
  `,
})
export class FlagsPage implements OnInit {
  private readonly flagsService = inject(FlagsService);

  readonly definitions = FEATURE_FLAG_DEFINITIONS;

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly flags = signal<FeatureFlags>({
    scalar_docs: false,
    pdf_builder: false,
    self_signup: false,
  });

  readonly errorAlert = signal<string | null>(null);
  readonly updatingKeys = signal<Set<FeatureFlagKey>>(new Set());
  readonly savedState = signal<Record<FeatureFlagKey, boolean>>({
    scalar_docs: false,
    pdf_builder: false,
    self_signup: false,
  });

  private readonly savedTimers = new Map<FeatureFlagKey, ReturnType<typeof setTimeout>>();

  ngOnInit(): void {
    this.loadFlags();
  }

  loadFlags(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.flagsService.getConfig().subscribe({
      next: (config) => {
        this.flags.set(config);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        const msg = err instanceof ApiError ? err.message : 'Unable to connect to server';
        this.loadError.set(msg);
      },
    });
  }

  isUpdating(key: FeatureFlagKey): boolean {
    return this.updatingKeys().has(key);
  }

  toggle(key: FeatureFlagKey, nextVal: boolean): void {
    const previous = this.flags();
    const prevVal = previous[key];
    if (prevVal === nextVal) {
      return;
    }

    // Clear any previous error
    this.errorAlert.set(null);

    // Optimistic update
    this.flags.set({ ...previous, [key]: nextVal });

    // Mark as updating
    const updating = new Set(this.updatingKeys());
    updating.add(key);
    this.updatingKeys.set(updating);

    this.flagsService.updateFlag(key, nextVal).subscribe({
      next: (updatedConfig) => {
        const up = new Set(this.updatingKeys());
        up.delete(key);
        this.updatingKeys.set(up);
        if (updatedConfig.key === key && typeof updatedConfig.value === 'boolean') {
          this.flags.set({ ...this.flags(), [key]: updatedConfig.value });
        }
        this.triggerSaved(key);
      },
      error: (err: unknown) => {
        // Rollback
        this.flags.set({ ...this.flags(), [key]: prevVal });
        const up = new Set(this.updatingKeys());
        up.delete(key);
        this.updatingKeys.set(up);

        const msg = err instanceof ApiError ? err.message : 'Failed to update flag';
        this.errorAlert.set(msg);
      },
    });
  }

  private triggerSaved(key: FeatureFlagKey): void {
    const prevTimer = this.savedTimers.get(key);
    if (prevTimer) {
      clearTimeout(prevTimer);
    }
    this.savedState.set({ ...this.savedState(), [key]: true });
    const timer = setTimeout(() => {
      this.savedState.set({ ...this.savedState(), [key]: false });
      this.savedTimers.delete(key);
    }, 2500);
    this.savedTimers.set(key, timer);
  }
}
