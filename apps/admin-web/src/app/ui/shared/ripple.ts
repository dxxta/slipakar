import { Directive, ElementRef, inject } from '@angular/core';

const AUTO_TITLE_ATTRIBUTE = 'data-ripple-title';

/**
 * Material-style ripple for clickable, non-input elements (buttons, links, tabs, menu items).
 * Also gives the element a "Click to ..." tooltip unless it already has its own title.
 */
@Directive({
  selector: "button, a[href], a[routerLink], [role='button'], [role='tab'], [role='menuitem'], [appRipple]",
  host: {
    '(pointerdown)': 'onPointerDown($any($event))',
    '(mouseenter)': 'ensureTooltip()',
    '(focusin)': 'ensureTooltip()',
  },
})
export class Ripple {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  protected onPointerDown(event: PointerEvent): void {
    if (this.element.matches('button[appSortHeader]') || this.element.closest('.input-group') !== null) return;
    if (this.isDisabled() || event.button > 0) return;
    const view = this.element.ownerDocument.defaultView;
    if (!view || view.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const bounds = this.element.getBoundingClientRect();
    const size = Math.max(bounds.width, bounds.height) * 2;
    const style = view.getComputedStyle(this.element);
    if (style.position === 'static') this.element.style.position = 'relative';
    if (style.overflow === 'visible' && style.display !== 'inline') this.element.style.overflow = 'hidden';

    const wave = this.element.ownerDocument.createElement('span');
    wave.className = 'ripple-wave';
    wave.setAttribute('aria-hidden', 'true');
    wave.style.width = wave.style.height = `${size}px`;
    wave.style.left = `${event.clientX - bounds.left - size / 2}px`;
    wave.style.top = `${event.clientY - bounds.top - size / 2}px`;
    this.element.appendChild(wave);
    wave.addEventListener('animationend', () => wave.remove(), { once: true });
  }

  protected ensureTooltip(): void {
    if (this.element.matches('button[appSortHeader]') || this.element.closest('.input-group') !== null) return;
    if (this.element.getAttribute('role') === 'menuitem' || this.element.closest('[role="menu"]') !== null) {
      if (this.element.hasAttribute(AUTO_TITLE_ATTRIBUTE)) this.element.removeAttribute('title');
      this.element.removeAttribute(AUTO_TITLE_ATTRIBUTE);
      return;
    }
    const current = this.element.getAttribute('title');
    if (current !== null && !this.element.hasAttribute(AUTO_TITLE_ATTRIBUTE)) return;
    if (this.isDisabled()) {
      this.element.removeAttribute('title');
      this.element.removeAttribute(AUTO_TITLE_ATTRIBUTE);
      return;
    }
    const label = (this.element.getAttribute('aria-label') ?? this.element.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (!label || label.length > 60) return;
    this.element.setAttribute('title', `Click to ${label}`);
    this.element.setAttribute(AUTO_TITLE_ATTRIBUTE, '');
  }

  private isDisabled(): boolean {
    const element = this.element;
    return (element as HTMLButtonElement).disabled === true || element.getAttribute('aria-disabled') === 'true';
  }
}
