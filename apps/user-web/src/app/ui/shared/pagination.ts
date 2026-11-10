import { Component, computed, input, output } from '@angular/core';

export type PaginationMetadata = { page: number; limit: number; total: number };

@Component({
  selector: 'app-pagination',
  template: `
    <nav aria-label="Table pagination" class="flex items-center justify-end gap-3 text-sm">
      <span aria-live="polite" class="min-w-24 text-center text-muted-foreground tabular-nums">Page {{ metadata().page }} of {{ pageCount() }}</span>
      <button type="button" aria-label="Previous page" data-action="previous-page" class="min-h-10 min-w-11 rounded-ui-md border border-border px-3 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40" [disabled]="metadata().page <= 1" (click)="pageChange.emit(metadata().page - 1)">Previous</button>
      <button type="button" aria-label="Next page" data-action="next-page" class="min-h-10 min-w-11 rounded-ui-md border border-border px-3 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40" [disabled]="metadata().page >= pageCount()" (click)="pageChange.emit(metadata().page + 1)">Next</button>
    </nav>
  `,
})
export class Pagination {
  readonly metadata = input<PaginationMetadata>({ page: 1, limit: 20, total: 0 });
  readonly pageChange = output<number>();
  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.metadata().total / this.metadata().limit)));
}
