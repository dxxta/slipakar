import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Avatar } from '@slipakar/ui/avatar';
import { buttonVariants } from '../button/src/lib/hlm-button';
import { ListBody } from './list-body';
import { PageHeader } from './page-header';
import { RowActions, type RowActionItem } from './row-actions';
import { Tabs, type TabItem } from './tabs';
import { ThemeToggle } from './theme-toggle';
import { ThemePreferencesService } from '../../core/theme-preferences.service';
import { AccountMenu } from './account-menu';
import { DataTableControls } from './data-table-controls';

@Component({ imports: [Tabs], template: `<app-tabs ariaLabel="Sections" [items]="items" [selected]="selected()" (selectedChange)="selected.set($event)" />` })
class TabsHost {
  readonly selected = signal('activity');
  readonly items: TabItem[] = [{ id: 'activity', label: 'Activity' }, { id: 'announcements', label: 'Announcements' }];
}

@Component({ imports: [ListBody], template: `<div data-testid="filters">Search controls</div><app-list-body state="ready" query="term" [itemCount]="0" emptyTitle="No rows yet" emptyResultLabel="No rows match" (clearQuery)="cleared()"><div list-content>Rows</div></app-list-body>`, })
class ListBodyHost { readonly cleared = vi.fn(); }

@Component({ imports: [PageHeader], template: `<app-page-header title="Projects" description="Your workspace" badge="Workspace" [topLevel]="topLevel()"><button page-actions>New project</button></app-page-header>` })
class PageHeaderHost { readonly topLevel = signal(true); }

@Component({ imports: [RowActions], template: `<app-row-actions label="Project actions" [items]="items" (actionSelect)="chosen($event)" />` })
class RowActionsHost {
  readonly items: RowActionItem[] = [{ id: 'detail', label: 'Detail', icon: 'eye' }, { id: 'delete', label: 'Delete', icon: 'trash', destructive: true }];
  readonly chosen = vi.fn();
}

describe('shared UI building blocks', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('renders keyboard-operable tabs with one selected tab', async () => {
    await TestBed.configureTestingModule({ imports: [TabsHost] }).compileComponents();
    const fixture = TestBed.createComponent(TabsHost);
    fixture.detectChanges();
    const tabs = fixture.nativeElement.querySelectorAll('[role="tab"]') as NodeListOf<HTMLButtonElement>;
    expect(fixture.nativeElement.querySelector('[role="tablist"]')).not.toBeNull();
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true');
    tabs[0]?.focus();
    tabs[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    fixture.detectChanges();
    expect(tabs[1]?.getAttribute('aria-selected')).toBe('true');
    tabs[1]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    fixture.detectChanges();
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true');
    tabs[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    fixture.detectChanges();
    expect(tabs[1]?.getAttribute('aria-selected')).toBe('true');
  });

  it('keeps filters mounted and offers a clear action for empty search results', async () => {
    await TestBed.configureTestingModule({ imports: [ListBodyHost] }).compileComponents();
    const fixture = TestBed.createComponent(ListBodyHost);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="filters"]')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('No rows match “term”');
    (fixture.nativeElement.querySelector('[data-action="clear-search"]') as HTMLButtonElement).click();
    expect(fixture.componentInstance.cleared).toHaveBeenCalledOnce();
  });

  it('renders loading and error states within the list body', async () => {
    await TestBed.configureTestingModule({ imports: [ListBody] }).compileComponents();
    const fixture = TestBed.createComponent(ListBody);
    fixture.componentRef.setInput('state', 'loading');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-list-state="loading"]')).not.toBeNull();
    fixture.componentRef.setInput('state', 'error');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-list-state="error"]')).not.toBeNull();
  });

  it('places a small page badge beside the heading only on top-level pages', async () => {
    await TestBed.configureTestingModule({ imports: [PageHeaderHost] }).compileComponents();
    const fixture = TestBed.createComponent(PageHeaderHost);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('h1 + app-page-badge [data-page-badge]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[page-actions]')).not.toBeNull();
    fixture.componentInstance.topLevel.set(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-page-badge]')).toBeNull();
  });

  it('opens a focusable menu and returns selected row actions', async () => {
    await TestBed.configureTestingModule({ imports: [RowActionsHost] }).compileComponents();
    const fixture = TestBed.createComponent(RowActionsHost);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[aria-label="Project actions"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    const menu = fixture.nativeElement.querySelector('[role="menu"]') as HTMLElement;
    expect(menu).not.toBeNull();
    expect(menu.classList.contains('fixed')).toBe(true);
    (menu.querySelector('[role="menuitem"]') as HTMLButtonElement).click();
    expect(fixture.componentInstance.chosen).toHaveBeenCalledWith(fixture.componentInstance.items[0]);
  });

  it('supports arrow navigation and closes the row menu with Escape', async () => {
    await TestBed.configureTestingModule({ imports: [RowActionsHost] }).compileComponents();
    const fixture = TestBed.createComponent(RowActionsHost);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[aria-label="Project actions"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    const items = fixture.nativeElement.querySelectorAll('[role="menuitem"]') as NodeListOf<HTMLButtonElement>;
    items[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(items[1]);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="menu"]')).toBeNull();
  });

  it('applies the shared destructive and solid-confirm button styles', () => {
    expect(buttonVariants({ variant: 'destructive' })).toContain('border-destructive');
    expect(buttonVariants({ variant: 'destructiveSolid' })).toContain('bg-destructive');
  });

  it('renders shared avatar sizes as round, cropped fixed boxes', async () => {
    await TestBed.configureTestingModule({ imports: [Avatar] }).compileComponents();
    const fixture = TestBed.createComponent(Avatar);
    fixture.componentRef.setInput('name', 'Ada Lovelace');
    fixture.componentRef.setInput('size', 'sm');
    fixture.detectChanges();
    let avatar = fixture.nativeElement.querySelector('[data-avatar]') as HTMLElement;
    expect(avatar.style.width).toBe('28px');
    expect(avatar.style.height).toBe('28px');
    expect(avatar.classList.contains('rounded-full')).toBe(true);
    fixture.componentRef.setInput('imageUrl', '/avatar.png');
    fixture.componentRef.setInput('size', 'lg');
    fixture.detectChanges();
    avatar = fixture.nativeElement.querySelector('[data-avatar]') as HTMLElement;
    expect(avatar.style.width).toBe('96px');
    expect(avatar.style.height).toBe('96px');
    expect(avatar.classList.contains('overflow-hidden')).toBe(true);
    expect(fixture.nativeElement.querySelector('img')?.getAttribute('src')).toBe('/avatar.png');
    (fixture.nativeElement.querySelector('img') as HTMLImageElement).dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-avatar]')?.textContent).toContain('AL');
  });

  it('keeps account avatars compact and gives shared search controls a placeholder', async () => {
    await TestBed.configureTestingModule({ imports: [AccountMenu, DataTableControls] }).compileComponents();
    const accountFixture = TestBed.createComponent(AccountMenu);
    accountFixture.componentRef.setInput('name', 'Grace Hopper');
    accountFixture.componentRef.setInput('email', 'grace@example.test');
    accountFixture.detectChanges();
    expect((accountFixture.nativeElement.querySelector('[data-avatar]') as HTMLElement).style.width).toBe('28px');
    expect(accountFixture.nativeElement.querySelector('button[aria-label="Account menu"]')?.classList.contains('min-w-0')).toBe(true);

    const controlsFixture = TestBed.createComponent(DataTableControls);
    controlsFixture.componentRef.setInput('searchPlaceholder', 'Search projects...');
    controlsFixture.detectChanges();
    expect((controlsFixture.nativeElement.querySelector('input[type="search"]') as HTMLInputElement).placeholder).toBe('Search projects...');
  });

  it('toggles effective system theme to an explicit light or dark preference', async () => {
    const preference = signal({ themeMode: 'system' as const, themeAccent: 'slate' as const });
    const setMode = vi.fn();
    await TestBed.configureTestingModule({
      imports: [ThemeToggle],
      providers: [{ provide: ThemePreferencesService, useValue: { preference, setMode } }],
    }).compileComponents();
    const fixture = TestBed.createComponent(ThemeToggle);
    fixture.detectChanges();
    const toggle = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-label')).toMatch(/^Switch to (dark|light) theme$/);
    toggle.click();
    expect(setMode).toHaveBeenCalledWith(expect.stringMatching(/^(dark|light)$/));
  });

  it('hides the theme toggle if an embedding provides an incomplete preference service', async () => {
    await TestBed.configureTestingModule({
      imports: [ThemeToggle],
      providers: [{ provide: ThemePreferencesService, useValue: {} as unknown as ThemePreferencesService }],
    }).compileComponents();
    const fixture = TestBed.createComponent(ThemeToggle);
    expect(() => fixture.detectChanges()).not.toThrow();
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });
});
