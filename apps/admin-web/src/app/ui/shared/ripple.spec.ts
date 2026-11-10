import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Ripple } from './ripple';

@Component({
  imports: [Ripple],
  template: `
    <button type="button" id="plain">Save template</button>
    <button type="button" id="titled" title="Custom">Other</button>
    <button type="button" id="off" disabled>Disabled</button>
    <input id="field" type="text" />
  `,
})
class Host {}

function pointerDown(element: HTMLElement): void {
  element.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 5, clientY: 5 }));
}

describe('Ripple directive', () => {
  function render(): HTMLElement {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('adds a ripple wave on press and gives the element a click tooltip', () => {
    const root = render();
    const button = root.querySelector('#plain') as HTMLElement;
    button.dispatchEvent(new MouseEvent('mouseenter'));
    expect(button.getAttribute('title')).toBe('Click to Save template');
    pointerDown(button);
    expect(button.querySelector('.ripple-wave')).not.toBeNull();
  });

  it('keeps an existing title and skips disabled buttons and inputs', () => {
    const root = render();
    const titled = root.querySelector('#titled') as HTMLElement;
    titled.dispatchEvent(new MouseEvent('mouseenter'));
    expect(titled.getAttribute('title')).toBe('Custom');

    const disabled = root.querySelector('#off') as HTMLElement;
    disabled.dispatchEvent(new MouseEvent('mouseenter'));
    pointerDown(disabled);
    expect(disabled.hasAttribute('title')).toBe(false);
    expect(disabled.querySelector('.ripple-wave')).toBeNull();

    const field = root.querySelector('#field') as HTMLElement;
    field.dispatchEvent(new MouseEvent('mouseenter'));
    expect(field.hasAttribute('title')).toBe(false);
  });
});
