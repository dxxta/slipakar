import { Component, input, output } from '@angular/core';

export type PageStateKind = 'loading' | 'empty' | 'error' | 'ready';

@Component({
  selector: 'app-page-state',
  template: `
    @if (state() === 'loading') {
      <div data-state="loading" role="status" aria-busy="true" [attr.aria-label]="loadingLabel()" class="space-y-3">
        <div class="h-16 animate-pulse rounded-ui-lg bg-muted"></div>
        <div class="h-16 animate-pulse rounded-ui-lg bg-muted"></div>
        <div class="h-16 animate-pulse rounded-ui-lg bg-muted"></div>
      </div>
    } @else if (state() === 'error') {
      <section data-state="error" role="alert" class="rounded-ui-lg border border-destructive/30 bg-destructive/5 p-card">
        <h2 class="font-medium">{{ title() }}</h2>
        <p class="mt-1 text-sm text-muted-foreground">{{ message() }}</p>
        <button type="button" data-action="retry" class="mt-4 h-control-9 rounded-ui-md border border-border px-3 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" (click)="retry.emit()">{{ retryLabel() }}</button>
      </section>
    } @else if (state() === 'empty') {
      <section data-state="empty" role="status" class="rounded-ui-lg border border-dashed border-border px-card py-12 text-center">
        <h2 class="text-lg font-semibold">{{ emptyTitle() }}</h2>
        <p class="mt-2 text-sm text-muted-foreground">{{ emptyMessage() }}</p>
        <ng-content select="[empty-action]" />
      </section>
    } @else {
      <ng-content />
    }
  `,
})
export class PageState {
  readonly state = input<PageStateKind>('loading');
  readonly title = input('Unable to load this page');
  readonly message = input('Please try again.');
  readonly loadingLabel = input('Loading');
  readonly emptyTitle = input('Nothing here yet');
  readonly emptyMessage = input('There is no content to show.');
  readonly retryLabel = input('Retry');
  readonly retry = output<void>();
}
