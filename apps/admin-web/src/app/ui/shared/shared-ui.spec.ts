import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DataTableControls } from './data-table-controls';
import { AccountMenu } from './account-menu';
import { Drawer } from './drawer';
import { ConfirmModal } from './confirm-modal';
import { PageLayout } from './page-layout';
import { PageState } from './page-state';
import { SortHeader } from './sort-header';
import { PageBadge } from './page-badge';
import { Pagination } from './pagination';
import { SelectControl } from './select-control';

@Component({
  imports: [DataTableControls, SelectControl],
  template: `<app-data-table-controls [query]="'payroll'"><div table-filters><label>Sort by <select appSelect aria-label="Sort by"><option>Name</option></select></label><button type="button">Mark all</button></div></app-data-table-controls>`,
})
class FilterRowHost {}

@Component({
  imports: [Drawer],
  template: `<app-drawer [open]="true" title="Edit project"><button>First field</button></app-drawer>`,
})
class DrawerHost {}

@Component({
  imports: [Drawer],
  template: `<app-drawer [open]="open()" title="Navigation" (closed)="open.set(false)"><button>First field</button></app-drawer>`,
})
class EscapeDrawerHost { readonly open = signal(true); }

@Component({
  imports: [SortHeader],
  template: `<button appSortHeader="createdAt" [sortBy]="sortBy()" [sortDir]="sortDir()" (sortChange)="onSort($event)">Created</button>`,
})
class SortHeaderHost {
  readonly sortBy = signal('createdAt');
  readonly sortDir = signal<'asc' | 'desc'>('desc');
  onSort(change: { sortBy: string; sortDir: 'asc' | 'desc' }): void {
    this.sortBy.set(change.sortBy);
    this.sortDir.set(change.sortDir);
  }
}

@Component({
  imports: [PageLayout],
  template: `<main appPageLayout><span>Page contents</span></main>`,
})
class PageLayoutHost {}

describe('shared UI primitives', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('renders drawers as labelled modal dialogs with focus containment', () => {
    TestBed.configureTestingModule({ imports: [DrawerHost] });
    const fixture = TestBed.createComponent(DrawerHost);
    fixture.detectChanges();

    const dialog = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement | null;
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.getAttribute('aria-labelledby')).toBeTruthy();
    expect(dialog?.hasAttribute('cdktrapfocus')).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('First field');
  });

  it('supports a full-height left-side drawer for mobile navigation', () => {
    @Component({
      imports: [Drawer],
      template: `<app-drawer [open]="true" [side]="'left'" title="Navigation"><nav>Links</nav></app-drawer>`,
    })
    class LeftDrawerHost {}
    TestBed.configureTestingModule({ imports: [LeftDrawerHost] });
    const fixture = TestBed.createComponent(LeftDrawerHost);
    fixture.detectChanges();

    const overlay = fixture.nativeElement.querySelector('[data-drawer-overlay]') as HTMLElement;
    const dialog = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    expect(overlay.classList.contains('justify-start')).toBe(true);
    expect(dialog.classList.contains('border-r')).toBe(true);
    expect(dialog.classList.contains('h-full')).toBe(true);
  });

  it('closes the drawer when Escape is pressed', () => {
    TestBed.configureTestingModule({ imports: [EscapeDrawerHost] });
    const fixture = TestBed.createComponent(EscapeDrawerHost);
    fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
  });

  it('exposes modal cancel and confirm actions separately', () => {
    TestBed.configureTestingModule({ imports: [ConfirmModal] });
    const fixture = TestBed.createComponent(ConfirmModal);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('title', 'Delete project?');
    fixture.componentRef.setInput('message', 'This action cannot be undone.');
    fixture.detectChanges();
    const cancelled = vi.fn();
    const confirmed = vi.fn();
    fixture.componentInstance.cancelled.subscribe(cancelled);
    fixture.componentInstance.confirmed.subscribe(confirmed);

    (fixture.nativeElement.querySelector('[data-action="cancel"]') as HTMLButtonElement).click();
    (fixture.nativeElement.querySelector('[data-action="confirm"]') as HTMLButtonElement).click();
    expect(cancelled).toHaveBeenCalledOnce();
    expect(confirmed).toHaveBeenCalledOnce();
  });

  it('emits server-side search and pagination changes', () => {
    TestBed.configureTestingModule({ imports: [DataTableControls] });
    const fixture = TestBed.createComponent(DataTableControls);
    fixture.componentRef.setInput('query', '');
    fixture.detectChanges();
    const queryChange = vi.fn();
    fixture.componentInstance.queryChange.subscribe(queryChange);

    const search = fixture.nativeElement.querySelector('input[type="search"]') as HTMLInputElement;
    search.value = 'Payroll';
    search.dispatchEvent(new Event('input'));

    expect(queryChange).toHaveBeenCalledWith('Payroll');
    expect(fixture.nativeElement.querySelector('[aria-label="Table pagination"]')).toBeNull();
  });

  it('aligns search, sort, and list actions in one filter row with a shared select control', () => {
    TestBed.configureTestingModule({ imports: [FilterRowHost] });
    const fixture = TestBed.createComponent(FilterRowHost);
    fixture.detectChanges();

    const row = fixture.nativeElement.querySelector('[data-filter-row]') as HTMLElement;
    expect(row.querySelector('input[type="search"]')).not.toBeNull();
    expect(row.querySelector('select[appSelect]')).not.toBeNull();
    expect(row.querySelector('button')?.textContent).toContain('Mark all');
  });

  it('renders the page badge as a compact labeled chip', () => {
    TestBed.configureTestingModule({ imports: [PageBadge] });
    const fixture = TestBed.createComponent(PageBadge);
    fixture.componentRef.setInput('label', 'Workspace');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-page-badge]')?.textContent.trim()).toBe('Workspace');
  });

  it('emits previous and next page requests from the separate pagination control', () => {
    TestBed.configureTestingModule({ imports: [Pagination] });
    const fixture = TestBed.createComponent(Pagination);
    fixture.componentRef.setInput('metadata', { page: 2, limit: 10, total: 25 });
    fixture.detectChanges();
    const pageChange = vi.fn();
    fixture.componentInstance.pageChange.subscribe(pageChange);

    (fixture.nativeElement.querySelector('[data-action="previous-page"]') as HTMLButtonElement).click();
    (fixture.nativeElement.querySelector('[data-action="next-page"]') as HTMLButtonElement).click();

    expect(pageChange.mock.calls).toEqual([[1], [3]]);
    expect(fixture.nativeElement.textContent).toContain('Page 2 of 3');
  });

  it('adds a stable shared styling hook to the native select', () => {
    @Component({ imports: [SelectControl], template: `<select appSelect><option>One</option></select>` })
    class SelectHost {}
    TestBed.configureTestingModule({ imports: [SelectHost] });
    const fixture = TestBed.createComponent(SelectHost);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('select')?.classList.contains('app-select')).toBe(true);
  });

  it('emits a new sort direction from sortable headers', () => {
    TestBed.configureTestingModule({ imports: [SortHeaderHost] });
    const fixture = TestBed.createComponent(SortHeaderHost);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('button').click();
    expect(fixture.componentInstance.sortDir()).toBe('asc');
  });

  it('renders explicit loading, empty, and error states', () => {
    TestBed.configureTestingModule({ imports: [PageState] });
    const fixture = TestBed.createComponent(PageState);
    fixture.componentRef.setInput('state', 'loading');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[aria-busy="true"]')).not.toBeNull();

    fixture.componentRef.setInput('state', 'empty');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-state="empty"]')).not.toBeNull();

    fixture.componentRef.setInput('state', 'error');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('provides the consistent page content wrapper', () => {
    TestBed.configureTestingModule({ imports: [PageLayoutHost] });
    const fixture = TestBed.createComponent(PageLayoutHost);
    fixture.detectChanges();
    const layout = fixture.nativeElement.querySelector('[data-page-layout]') as HTMLElement;
    expect(layout).not.toBeNull();
    expect(layout.classList.contains('max-w-screen-2xl')).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Page contents');
  });

  it('shows an account menu with an explicit sign-out action', () => {
    TestBed.configureTestingModule({ imports: [AccountMenu] });
    const fixture = TestBed.createComponent(AccountMenu);
    fixture.componentRef.setInput('email', 'person@example.test');
    fixture.componentRef.setInput('name', 'Grace Hopper');
    fixture.componentRef.setInput('imageUrl', '/me/avatar/admin-1?v=hash');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('person@example.test');
    expect(fixture.nativeElement.querySelector('img[alt="Avatar for Grace Hopper"]')?.getAttribute('src')).toBe('/me/avatar/admin-1?v=hash');
    expect(fixture.nativeElement.querySelector('[aria-hidden="true"] svg')).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('⌄');
    const requested = vi.fn();
    fixture.componentInstance.signOutRequested.subscribe(requested);
    (fixture.nativeElement.querySelector('[aria-label="Account menu"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[role="menuitem"]') as HTMLButtonElement).click();
    expect(requested).toHaveBeenCalledOnce();
  });
});
