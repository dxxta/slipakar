import { Component, input, output } from '@angular/core';

export type ListBodyState = 'loading' | 'error' | 'ready';

@Component({
  selector: 'app-list-body',
  standalone: true,
  template: `
    @if (state() === 'loading') {
      <div data-list-state="loading" role="status" aria-busy="true" [attr.aria-label]="loadingLabel()" class="space-y-3">
        <div class="h-16 animate-pulse rounded-ui-lg bg-muted"></div><div class="h-16 animate-pulse rounded-ui-lg bg-muted"></div><div class="h-16 animate-pulse rounded-ui-lg bg-muted"></div>
      </div>
    } @else if (state() === 'error') {
      <section data-list-state="error" role="alert" class="rounded-ui-lg border border-destructive/30 bg-destructive/5 p-card">
        <h2 class="font-medium">{{ errorTitle() }}</h2><p class="mt-1 text-sm text-muted-foreground">{{ errorMessage() }}</p>
        <button type="button" class="mt-4 min-h-11 rounded-ui-md border border-border px-3 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" (click)="retry.emit()">{{ retryLabel() }}</button>
      </section>
    } @else if (itemCount() > 0) {
      <ng-content select="[list-content]" />
    } @else if (query().trim()) {
      <section data-list-state="search-empty" role="status" class="rounded-ui-lg border border-dashed border-border px-card py-10 text-center">
        <h2 class="font-medium">{{ emptyResultLabel() }} “{{ query().trim() }}”</h2>
        <button type="button" data-action="clear-search" class="mt-3 min-h-11 rounded-ui-md px-3 text-sm font-medium text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" (click)="clearQuery.emit()">{{ clearLabel() }}</button>
      </section>
    } @else {
      <section data-list-state="empty" role="status" class="rounded-ui-lg border border-dashed border-border px-card py-12 text-center">
        <h2 class="text-lg font-semibold">{{ emptyTitle() }}</h2><p class="mt-2 text-sm text-muted-foreground">{{ emptyMessage() }}</p>
        <ng-content select="[empty-action]" />
      </section>
    }
  `,
})
export class ListBody {
  readonly state = input<ListBodyState>('ready');
  readonly itemCount = input(0);
  readonly query = input('');
  readonly loadingLabel = input('Loading results');
  readonly errorTitle = input('Could not load results');
  readonly errorMessage = input('Check your connection and try again.');
  readonly retryLabel = input('Retry');
  readonly emptyTitle = input('Nothing here yet');
  readonly emptyMessage = input('There is no content to show yet.');
  readonly emptyResultLabel = input('No results match');
  readonly clearLabel = input('Clear search');
  readonly retry = output<void>();
  readonly clearQuery = output<void>();
}
