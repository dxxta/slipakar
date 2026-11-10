import { Component, HostListener, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { tablerX } from '@ng-icons/tabler-icons';

@Component({
  selector: 'app-drawer',
  imports: [CdkTrapFocus, NgIcon],
  providers: [provideIcons({ tablerX })],
  template: `
    @if (open()) {
      <div data-drawer-overlay class="fixed inset-0 z-50 flex bg-black/40" [class.justify-start]="side() === 'left'" [class.justify-end]="side() === 'right'" (click)="onBackdrop($event)">
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="drawer-title"
          tabindex="-1"
          cdkTrapFocus
          cdkTrapFocusAutoCapture
          data-focus-trap
          class="flex h-full w-full max-w-xl flex-col border-border bg-background shadow-xl"
          [class.border-l]="side() === 'right'"
          [class.border-r]="side() === 'left'"
          [class.max-w-sm]="side() === 'left'"
        >
          <header class="flex items-center justify-between border-b border-border px-card py-4">
            <h2 id="drawer-title" class="text-lg font-semibold">{{ title() }}</h2>
            <button type="button" class="grid size-9 shrink-0 place-items-center rounded-ui-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Close panel" (click)="closed.emit()"><ng-icon name="tablerX" class="size-5" aria-hidden="true" /></button>
          </header>
          <div class="min-h-0 flex-1 overflow-y-auto p-card"><ng-content /></div>
          <footer class="flex shrink-0 items-center justify-end gap-2 border-t border-border bg-background px-card py-3 empty:hidden"><ng-content select="[drawer-footer]" /></footer>
        </section>
      </div>
    }
  `,
})
export class Drawer {
  readonly open = input(false);
  readonly title = input('Details');
  readonly side = input<'left' | 'right'>('right');
  readonly closed = output<void>();

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.open()) this.closed.emit();
  }

  protected onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closed.emit();
  }
}
