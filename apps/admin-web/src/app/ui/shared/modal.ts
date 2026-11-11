import { Component, HostListener, input, output } from '@angular/core';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerX } from '@ng-icons/tabler-icons';

@Component({
  selector: 'app-modal',
  imports: [CdkTrapFocus, NgIcon],
  providers: [provideIcons({ tablerX })],
  template: `
    @if (open()) {
      <div data-modal-overlay class="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-black/45 p-4" (click)="onBackdrop($event)">
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          tabindex="-1"
          cdkTrapFocus
          cdkTrapFocusAutoCapture
          data-focus-trap
          class="flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-ui-lg border-2 border-border bg-card shadow-xl"
          [class.max-w-sm]="size() === 'sm'"
          [class.max-w-md]="size() === 'md'"
          [class.max-w-2xl]="size() === 'lg'"
        >
          <header class="flex shrink-0 items-center justify-between gap-4 border-b border-border px-card py-4">
            <h2 id="modal-title" class="min-w-0 font-display text-lg font-semibold">{{ title() }}</h2>
            <button type="button" class="grid size-9 shrink-0 place-items-center rounded-ui-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Close" (click)="closed.emit()"><ng-icon name="tablerX" class="size-5" aria-hidden="true" /></button>
          </header>
          <div class="min-h-0 flex-1 overflow-y-auto p-card"><ng-content /></div>
          <footer class="flex shrink-0 items-center justify-end gap-2 border-t border-border bg-card px-card py-3 empty:hidden"><ng-content select="[drawer-footer]" /></footer>
        </section>
      </div>
    }
  `,
})
export class Modal {
  readonly open = input(false);
  readonly title = input('Details');
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  readonly closed = output<void>();

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.open()) this.closed.emit();
  }

  protected onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closed.emit();
  }
}
