import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, ElementRef, HostListener, inject, input, output, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerArrowLeft, tablerDeviceFloppy, tablerDots, tablerEye, tablerPencil, tablerPlus, tablerPower, tablerPrinter, tablerRefresh, tablerSend, tablerTrash, tablerX } from '@ng-icons/tabler-icons';

export type RowActionIcon = 'eye' | 'pencil' | 'trash' | 'power' | 'refresh' | 'plus' | 'send' | 'close' | 'save' | 'print' | 'back';
export type RowActionItem = { id: string; label: string; icon: RowActionIcon; destructive?: boolean; disabled?: boolean };
type MenuPosition = { top: number; left: number };

@Component({
  selector: 'app-row-actions',
  standalone: true,
  host: { class: 'flex justify-end' },
  imports: [CommonModule, NgIcon],
  providers: [provideIcons({ tablerArrowLeft, tablerDeviceFloppy, tablerDots, tablerEye, tablerPencil, tablerPlus, tablerPower, tablerPrinter, tablerRefresh, tablerSend, tablerTrash, tablerX })],
  template: `
    <button #trigger data-row-action-trigger type="button" class="grid size-9 shrink-0 place-items-center rounded-ui-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      [class]="solid() ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80' : 'text-muted-foreground hover:bg-muted hover:text-foreground'" [attr.aria-label]="label()" aria-haspopup="menu" [attr.aria-expanded]="open()" (click)="toggle()">
      <ng-icon name="tablerDots" aria-hidden="true" class="size-5" />
    </button>
    @if (open()) {
      <div role="menu" [attr.aria-label]="label()" class="fixed z-[80] min-w-40 rounded-ui-md border border-border bg-popover p-1 text-popover-foreground shadow-lg" [style.top.px]="position().top" [style.left.px]="position().left" (keydown)="onMenuKeydown($event)">
        @for (item of items(); track item.id; let index = $index) {
          <button type="button" role="menuitem" [attr.tabindex]="activeIndex() === index ? 0 : -1" [disabled]="item.disabled ?? false" class="flex h-control-9 min-w-40 w-full items-center gap-2 rounded-ui-sm px-3 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" [ngClass]="item.destructive ? 'text-destructive hover:bg-destructive/10' : 'hover:bg-muted'" (focus)="activeIndex.set(index)" (click)="choose(item)">
            <ng-icon [name]="iconName(item.icon)" aria-hidden="true" class="size-4 shrink-0" />
            <span>{{ item.label }}</span>
          </button>
        }
      </div>
    }
  `,
})
export class RowActions {
  readonly label = input('Row actions');
  /** Filled primary trigger, used for page-level action menus. */
  readonly solid = input(false);
  readonly items = input.required<RowActionItem[]>();
  readonly actionSelect = output<RowActionItem>();
  protected readonly open = signal(false);
  protected readonly activeIndex = signal(0);
  protected readonly position = signal<MenuPosition>({ top: 0, left: 0 });

  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly document = inject(DOCUMENT);

  protected toggle(): void {
    if (this.open()) { this.close(true); return; }
    this.position.set(this.calculatePosition());
    this.activeIndex.set(0);
    this.open.set(true);
    queueMicrotask(() => this.focusItem(0));
  }

  protected choose(item: RowActionItem): void {
    if (item.disabled) return;
    this.actionSelect.emit(item);
    this.close(true);
  }

  protected iconName(icon: RowActionIcon): string {
    const names: Record<RowActionIcon, string> = {
      eye: 'tablerEye',
      pencil: 'tablerPencil',
      trash: 'tablerTrash',
      power: 'tablerPower',
      refresh: 'tablerRefresh',
      plus: 'tablerPlus',
      send: 'tablerSend',
      close: 'tablerX',
      save: 'tablerDeviceFloppy',
      print: 'tablerPrinter',
      back: 'tablerArrowLeft',
    };
    return names[icon];
  }

  @HostListener('document:pointerdown', ['$event'])
  protected closeOutside(event: PointerEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.close(false);
  }

  @HostListener('document:keydown', ['$event'])
  protected closeOnEscape(event: KeyboardEvent): void {
    if (this.open() && event.key === 'Escape') { event.preventDefault(); this.close(true); }
  }

  protected onMenuKeydown(event: KeyboardEvent): void {
    const count = this.items().length;
    if (!count) return;
    let next = this.activeIndex();
    if (event.key === 'ArrowDown') next = (next + 1) % count;
    else if (event.key === 'ArrowUp') next = (next - 1 + count) % count;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = count - 1;
    else return;
    event.preventDefault();
    this.activeIndex.set(next);
    this.focusItem(next);
  }

  private calculatePosition(): MenuPosition {
    const root = this.host.nativeElement as HTMLElement;
    const trigger = root.querySelector('[data-row-action-trigger]') as HTMLElement | null;
    const bounds = trigger?.getBoundingClientRect();
    const view = this.document.defaultView;
    if (!bounds || !view) return { top: 8, left: 8 };
    const menuWidth = 160;
    const menuHeight = Math.min(this.items().length * 36 + 8, 240);
    const left = Math.max(8, Math.min(bounds.right - menuWidth, view.innerWidth - menuWidth - 8));
    const top = bounds.bottom + menuHeight + 8 <= view.innerHeight
      ? bounds.bottom + 4
      : Math.max(8, bounds.top - menuHeight - 4);
    return { top, left };
  }

  private focusItem(index: number): void {
    const root = this.host.nativeElement as HTMLElement;
    const items = root.querySelectorAll('[role="menuitem"]') as NodeListOf<HTMLButtonElement>;
    items.item(index)?.focus();
  }

  private close(returnFocus: boolean): void {
    this.open.set(false);
    if (returnFocus) queueMicrotask(() => (this.host.nativeElement as HTMLElement).querySelector<HTMLElement>('[data-row-action-trigger]')?.focus());
  }
}
