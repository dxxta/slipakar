import { Directive, HostBinding, HostListener, input, output } from '@angular/core';

export type SortDirection = 'asc' | 'desc';
export type SortChange = { sortBy: string; sortDir: SortDirection };

@Directive({
  selector: 'button[appSortHeader]',
  host: {
    class: 'inline-flex items-center gap-1 rounded-sm text-left font-inherit hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
  },
})
export class SortHeader {
  readonly key = input('', { alias: 'appSortHeader' });
  readonly sortBy = input('');
  readonly sortDir = input<SortDirection>('desc');
  readonly sortChange = output<SortChange>();

  @HostBinding('attr.aria-pressed')
  protected get pressed(): string {
    return String(this.sortBy() === this.key());
  }

  @HostListener('click')
  protected toggleSort(): void {
    const sortDir: SortDirection = this.sortBy() === this.key() && this.sortDir() === 'asc' ? 'desc' : 'asc';
    this.sortChange.emit({ sortBy: this.key(), sortDir });
  }
}
