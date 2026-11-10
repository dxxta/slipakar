import { Component, ElementRef, inject, input, output } from '@angular/core';
import type { TabItem } from './tabs';
import { Ripple } from './ripple';

@Component({
  imports: [Ripple],
  selector: 'app-segmented-tabs',
  standalone: true,
  template: `
    <div class="overflow-x-auto overscroll-x-contain">
      <div role="tablist" [attr.aria-label]="ariaLabel()" class="inline-flex min-w-max items-center gap-1 rounded-ui-lg bg-muted p-1">
        @for (item of items(); track item.id; let index = $index) {
          <button type="button" role="tab" [id]="tabId(item.id)" [attr.aria-selected]="selected() === item.id" [attr.aria-controls]="panelId(item.id)" [attr.tabindex]="selected() === item.id ? 0 : -1" [disabled]="item.disabled ?? false" class="h-control-9 whitespace-nowrap rounded-ui-md px-3 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" [class.bg-background]="selected() === item.id" [class.text-foreground]="selected() === item.id" [class.shadow-sm]="selected() === item.id" (click)="activate(item)" (keydown)="onKeydown($event, index)">{{ item.label }}</button>
        }
      </div>
    </div>
  `,
})
export class SegmentedTabs {
  readonly ariaLabel = input.required<string>();
  readonly items = input.required<TabItem[]>();
  readonly selected = input.required<string>();
  readonly selectedChange = output<string>();
  private readonly host = inject(ElementRef<HTMLElement>);

  protected tabId(id: string): string { return `segmented-tab-${id}`; }
  protected panelId(id: string): string { return `segmented-panel-${id}`; }
  protected activate(item: TabItem): void { if (!item.disabled) this.selectedChange.emit(item.id); }

  protected onKeydown(event: KeyboardEvent, currentIndex: number): void {
    const available = this.items().filter((item) => !item.disabled);
    if (!available.length) return;
    const current = this.items()[currentIndex];
    const selectedIndex = available.findIndex((item) => item.id === current?.id);
    let nextIndex = -1;
    if (event.key === 'ArrowRight') nextIndex = (selectedIndex + 1) % available.length;
    else if (event.key === 'ArrowLeft') nextIndex = (selectedIndex - 1 + available.length) % available.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = available.length - 1;
    if (nextIndex < 0) return;
    event.preventDefault();
    const next = available[nextIndex];
    if (!next) return;
    Array.from((this.host.nativeElement as HTMLElement).querySelectorAll('[role="tab"]'), (tab) => tab as HTMLButtonElement)
      .find((tab) => tab.id === this.tabId(next.id))?.focus();
    this.selectedChange.emit(next.id);
  }
}
