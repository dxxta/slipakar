import { Component, ElementRef, inject, input, output } from '@angular/core';

export type TabItem = { id: string; label: string; disabled?: boolean };

@Component({
  selector: 'app-tabs',
  standalone: true,
  template: `
    <div class="overflow-x-auto overscroll-x-contain">
      <div role="tablist" [attr.aria-label]="ariaLabel()" class="flex min-w-max items-stretch gap-1 border-b border-border pb-1">
        @for (item of items(); track item.id; let index = $index) {
          <button
            type="button"
            role="tab"
            [id]="tabId(item.id)"
            [attr.aria-selected]="selected() === item.id"
            [attr.aria-controls]="panelId(item.id)"
            [attr.tabindex]="selected() === item.id ? 0 : -1"
            [disabled]="item.disabled ?? false"
            class="-mb-1 h-control-9 max-md:min-h-11 whitespace-nowrap border-b-2 px-3 pb-3 pt-2 text-sm font-medium text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            [class.border-primary]="selected() === item.id"
            [class.text-foreground]="selected() === item.id"
            [class.border-transparent]="selected() !== item.id"
            (click)="activate(item)"
            (keydown)="onKeydown($event, index)"
          >{{ item.label }}</button>
        }
      </div>
    </div>
  `,
})
export class Tabs {
  readonly ariaLabel = input.required<string>();
  readonly items = input.required<TabItem[]>();
  readonly selected = input.required<string>();
  readonly selectedChange = output<string>();
  private readonly host = inject(ElementRef<HTMLElement>);

  protected tabId(id: string): string { return `tab-${id}`; }
  protected panelId(id: string): string { return `panel-${id}`; }

  protected activate(item: TabItem): void {
    if (!item.disabled) this.selectedChange.emit(item.id);
  }

  protected onKeydown(event: KeyboardEvent, currentIndex: number): void {
    const available = this.items().filter((item) => !item.disabled);
    if (!available.length) return;
    const current = this.items()[currentIndex];
    let nextIndex = -1;
    if (event.key === 'ArrowRight') nextIndex = (available.findIndex((item) => item.id === current?.id) + 1) % available.length;
    else if (event.key === 'ArrowLeft') nextIndex = (available.findIndex((item) => item.id === current?.id) - 1 + available.length) % available.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = available.length - 1;
    if (nextIndex < 0) return;

    event.preventDefault();
    const next = available[nextIndex];
    if (!next) return;
    const tabs = (this.host.nativeElement as HTMLElement).querySelectorAll('[role="tab"]') as NodeListOf<HTMLButtonElement>;
    const nextTab = [...tabs]
      .find((tab) => tab.id === this.tabId(next.id));
    nextTab?.focus();
    this.selectedChange.emit(next.id);
  }
}
