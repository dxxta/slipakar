import { Component, HostListener, input, output } from '@angular/core';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { HlmButton } from '../button/src/lib/hlm-button';

@Component({
  selector: 'app-confirm-modal',
  imports: [CdkTrapFocus, HlmButton],
  template: `
    @if (open()) {
      <div class="fixed inset-0 z-[60] grid place-items-center bg-black/45 p-4" (click)="onBackdrop($event)">
        <section
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          aria-describedby="confirm-message"
          tabindex="-1"
          cdkTrapFocus
          cdkTrapFocusAutoCapture
          data-focus-trap
          [attr.data-testid]="dialogTestId()"
          class="w-full max-w-md rounded-ui-lg border border-border bg-card p-card shadow-xl"
        >
          <h2 id="confirm-title" class="text-lg font-semibold">{{ title() }}</h2>
          <p id="confirm-message" [attr.data-testid]="messageTestId()" class="mt-2 text-sm text-muted-foreground">{{ message() }}</p>
          <div class="mt-6 flex justify-end gap-2">
            <button type="button" data-action="cancel" class="min-h-11 sm:min-h-9 rounded-ui-md border border-border px-3 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" (click)="cancelled.emit()">{{ cancelLabel() }}</button>
            <button hlmBtn type="button" variant="destructiveSolid" class="min-h-11 sm:min-h-9" data-action="confirm" [attr.data-testid]="confirmTestId()" (click)="confirmed.emit()">{{ confirmLabel() }}</button>
          </div>
        </section>
      </div>
    }
  `,
})
export class ConfirmModal {
  readonly open = input(false);
  readonly title = input('Confirm action');
  readonly message = input('Are you sure?');
  readonly confirmLabel = input('Confirm');
  readonly cancelLabel = input('Cancel');
  readonly dialogTestId = input<string | null>(null);
  readonly messageTestId = input<string | null>(null);
  readonly confirmTestId = input<string | null>(null);
  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.open()) this.cancelled.emit();
  }

  protected onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.cancelled.emit();
  }
}
