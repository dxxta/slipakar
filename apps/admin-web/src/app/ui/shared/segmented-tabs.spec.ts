import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { SegmentedTabs } from './segmented-tabs';

@Component({ imports: [SegmentedTabs], template: `<app-segmented-tabs ariaLabel="Notice categories" [items]="items" [selected]="selected" (selectedChange)="selected = $event" />` })
class SegmentedTabsHost {
  items = [{ id: 'activity', label: 'Activity' }, { id: 'announcements', label: 'Announcements' }];
  selected = 'activity';
}

describe('SegmentedTabs', () => {
  it('renders the active pill and changes tabs with arrow keys', async () => {
    await TestBed.configureTestingModule({ imports: [SegmentedTabsHost] }).compileComponents();
    const fixture = TestBed.createComponent(SegmentedTabsHost);
    fixture.detectChanges();
    const tabs = fixture.nativeElement.querySelectorAll('[role="tab"]') as NodeListOf<HTMLButtonElement>;
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true');
    expect(tabs[0]?.className).toContain('bg-background');
    tabs[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.selected).toBe('announcements');
    expect(tabs[1]?.getAttribute('aria-selected')).toBe('true');
  });
});
