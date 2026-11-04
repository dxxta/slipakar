import { expect, test } from '@playwright/test';
import { MockApiStore, setupApiMock } from './helpers/api-mock';

test.describe('Authentication e2e', () => {
  let store: MockApiStore;

  test.beforeEach(async ({ page }) => {
    store = new MockApiStore();
    await setupApiMock(page, store);
  });

  test('signed-out user visiting /projects is redirected to /login and sees the Google sign-in button', async ({
    page,
  }) => {
    store.user = null; // simulate unauthenticated

    await page.goto('/projects');

    // Should redirect to /login
    await expect(page).toHaveURL(/\/login/);

    // Verify main landmarks and accessible heading
    const loginSection = page.getByRole('region', { name: 'Sign in to your workspace' });
    await expect(loginSection).toBeVisible();

    const title = page.getByRole('heading', { name: 'Sign in to your workspace' });
    await expect(title).toBeVisible();

    // Check Google sign-in button
    const googleBtn = page.getByRole('button', { name: 'Sign in with Google' });
    await expect(googleBtn).toBeVisible();
    await expect(googleBtn).toBeEnabled();
  });

  test('signed-in user visiting /projects sees the projects workspace page', async ({ page }) => {
    // Authenticated user
    store.user = {
      id: 'usr-1',
      email: 'user@lokaslip.com',
      name: 'Test User',
      role: 'user',
    };

    await page.goto('/projects');

    await expect(page).toHaveURL(/\/projects/);

    // Header landmark and title
    const heading = page.getByRole('heading', { level: 1, name: 'Projects' });
    await expect(heading).toBeVisible();

    await expect(page.getByRole('button', { name: 'New project' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create your first project' })).toBeVisible();
  });

  test('disabled account receives a clear access-disabled page', async ({ page }) => {
    store.accountDisabled = true;
    await page.goto('/projects');
    await expect(page).toHaveURL(/\/account-disabled$/);
    await expect(page.getByRole('heading', { name: 'Account disabled' })).toBeVisible();
    await expect(page.getByText(/Contact your workspace administrator/)).toBeVisible();
  });
});
