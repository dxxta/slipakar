import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UsersPage } from './users-page';

const user = { id: 'u-1', email: '*****@example.test', name: 'Member', image: null, role: 'user', emailVerified: true, createdAt: '2026-10-01T00:00:00.000Z', disabledAt: null };

describe('UsersPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [UsersPage], providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('loads users from the paginated admin contract and supports server search', () => {
    const fixture = TestBed.createComponent(UsersPage);
    fixture.detectChanges();
    http.expectOne('/admin/users?page=1&limit=20&sortBy=createdAt&sortDir=desc').flush({ message: 'ok', data: [user], metadata: { page: 1, limit: 20, total: 1 }, success: true });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('*****@example.test');
    expect(fixture.nativeElement.textContent).not.toContain('Projects');
    const search = fixture.nativeElement.querySelector('input[type="search"]') as HTMLInputElement;
    search.value = 'member';
    search.dispatchEvent(new Event('input'));
    http.expectOne('/admin/users?page=1&limit=20&sortBy=createdAt&sortDir=desc&q=member').flush({ message: 'ok', data: [user], metadata: { page: 1, limit: 20, total: 1 }, success: true });
  });

  it('shows user details in a drawer and offers edit and disable actions', () => {
    const fixture = TestBed.createComponent(UsersPage);
    fixture.detectChanges();
    http.expectOne('/admin/users?page=1&limit=20&sortBy=createdAt&sortDir=desc').flush({ message: 'ok', data: [user], metadata: { page: 1, limit: 20, total: 1 }, success: true });
    fixture.detectChanges();
    // Open the row actions menu
    const trigger = fixture.nativeElement.querySelector('[data-row-action-trigger]') as HTMLButtonElement;
    expect(trigger).not.toBeNull();
    trigger.click();
    fixture.detectChanges();

    // Click "Detail"
    const detailBtn = Array.from(fixture.nativeElement.querySelectorAll('[role="menuitem"]') as NodeListOf<HTMLButtonElement>)
      .find((b) => b.textContent?.includes('Detail'));
    expect(detailBtn).toBeDefined();
    detailBtn!.click();

    http.expectOne('/admin/users/u-1').flush({ message: 'ok', data: user, success: true });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')?.textContent).toContain('*****@example.test');

    // Close detail drawer
    const closeBtn = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .find((b) => b.getAttribute('aria-label') === 'Close panel');
    closeBtn?.click();
    fixture.detectChanges();

    // Open row actions again and click "Edit"
    trigger.click();
    fixture.detectChanges();
    const editBtn = Array.from(fixture.nativeElement.querySelectorAll('[role="menuitem"]') as NodeListOf<HTMLButtonElement>)
      .find((b) => b.textContent?.includes('Edit'));
    expect(editBtn).toBeDefined();
    editBtn!.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="dialog"]')?.textContent).toContain('Edit user');
    expect(fixture.nativeElement.querySelector('input#user-name')).not.toBeNull();

    // Check disable action in row actions
    trigger.click();
    fixture.detectChanges();
    const disableBtn = Array.from(fixture.nativeElement.querySelectorAll('[role="menuitem"]') as NodeListOf<HTMLButtonElement>)
      .find((b) => b.textContent?.includes('Disable'));
    expect(disableBtn).toBeDefined();
  });
});
