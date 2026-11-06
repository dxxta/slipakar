import { Component, input, output } from '@angular/core';

export type TablePageMetadata = { page: number; limit: number; total: number };

@Component({
  selector: 'app-data-table-controls',
  template: `
    <div data-filter-row class="flex flex-wrap items-end gap-3">
      <label class="grid min-w-64 flex-1 gap-1 text-xs font-medium text-muted-foreground">
        <span>Search</span>
        <input type="search" class="h-control-9 w-full rounded-ui-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" [placeholder]="searchPlaceholder()" [value]="query()" (input)="onQueryInput($event)" />
      </label>
      <div class="ml-auto flex flex-wrap items-end justify-end gap-3"><ng-content select="[table-filters]" /></div>
    </div>
  `,
})
export class DataTableControls {
  readonly query = input('');
  readonly searchPlaceholder = input('Search records...');
  // Retained for gradual feature migration; pagination renders through app-pagination.
  readonly metadata = input<TablePageMetadata | undefined>();
  readonly queryChange = output<string>();
  readonly pageChange = output<number>();

  protected onQueryInput(event: Event): void {
    this.queryChange.emit((event.currentTarget as HTMLInputElement).value);
  }
}
