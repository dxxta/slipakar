import { Component, input, output } from '@angular/core';

export type TablePageMetadata = { page: number; limit: number; total: number };

@Component({
  selector: 'app-data-table-controls',
  host: { class: 'mb-3 block' },
  template: `
    <div data-filter-row class="flex flex-wrap items-end gap-3">
      <label class="grid w-full min-w-0 gap-1 md:w-auto md:min-w-64 md:flex-1 text-xs font-medium text-muted-foreground">
        <span>Search</span>
        <input type="search" class="h-control-9 w-full rounded-ui-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" [placeholder]="searchPlaceholder()" [value]="query()" (input)="onQueryInput($event)" />
      </label>
      <div class="w-full md:ml-auto md:flex md:w-auto md:flex-wrap md:items-end md:justify-end md:gap-3"><ng-content select="[table-filters]" /></div>
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
