import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Drawer } from './drawer';

@Component({
  imports: [Drawer],
  template: `<app-drawer [open]="true" title="Edit"><p>Body</p><button drawer-footer type="button">Save</button></app-drawer>`,
})
class WithFooter {}

@Component({ imports: [Drawer], template: `<app-drawer [open]="true" title="Details"><p>Body</p></app-drawer>` })
class WithoutFooter {}

describe('Drawer footer', () => {
  it('projects drawer-footer content into a footer outside the scrolling body', () => {
    const fixture = TestBed.createComponent(WithFooter);
    fixture.detectChanges();
    const footer = fixture.nativeElement.querySelector('footer') as HTMLElement;
    expect(footer.textContent).toContain('Save');
    expect(footer.parentElement?.querySelector('.overflow-y-auto')?.contains(footer)).toBe(false);
  });

  it('keeps the footer empty (hidden) when nothing is projected', () => {
    const fixture = TestBed.createComponent(WithoutFooter);
    fixture.detectChanges();
    const footer = fixture.nativeElement.querySelector('footer') as HTMLElement;
    expect(footer.textContent?.trim()).toBe('');
    expect(footer.className).toContain('empty:hidden');
  });
});
