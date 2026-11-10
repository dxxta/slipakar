import { Directive, signal } from '@angular/core';

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
  readonly pressed = signal(false);

  onPointerDown(event: PointerEvent): void {
    const target = event.target;
    if (target === event.currentTarget || (target instanceof Element && !target.closest('a, button, input, select, textarea'))) {
      this.pressed.set(true);
    }
  }

  release(): void {
    this.pressed.set(false);
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) this.pressed.set(true);
  }

  onKeyUp(event: KeyboardEvent): void {
    if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) this.pressed.set(false);
  }
}
