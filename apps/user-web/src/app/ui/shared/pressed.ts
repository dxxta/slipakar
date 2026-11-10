import { Directive, ElementRef, inject, signal } from '@angular/core';

@Directive({
  selector: '[appPressed]',
  standalone: true,
  host: {
    '[attr.data-pressed]': "pressed() ? '' : null",
    '(pointerdown)': 'onPointerDown($event)',
    '(pointerup)': 'release()',
    '(pointercancel)': 'release()',
    '(pointerleave)': 'release()',
    '(blur)': 'release()',
    '(keydown)': 'onKeyDown($event)',
    '(keyup)': 'onKeyUp($event)',
  },
})
export class Pressed {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  readonly pressed = signal(false);

  onPointerDown(event: PointerEvent): void {
    if (this.isDisabled()) return;

    const target = event.target;
    const hostIsInteractive = this.host.matches('button, a, [role="button"], [role="tab"], [role="menuitem"]');
    const targetIsInteractive = target instanceof Element && target.closest('a, button, input, select, textarea, [role="button"], [role="tab"], [role="menuitem"], [role="switch"]') !== null;
    if (hostIsInteractive || !targetIsInteractive) this.pressed.set(true);
  }

  release(): void {
    this.pressed.set(false);
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.target === event.currentTarget && !event.repeat && !this.isDisabled() && (event.key === 'Enter' || event.key === ' ')) {
      this.pressed.set(true);
    }
  }

  onKeyUp(event: KeyboardEvent): void {
    if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) this.pressed.set(false);
  }

  private isDisabled(): boolean {
    return this.host.matches(':disabled, [aria-disabled="true"]');
  }
}
