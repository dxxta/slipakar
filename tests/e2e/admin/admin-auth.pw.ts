import { expect, test } from '@playwright/test';
import { setupAdminApiMock } from './admin-helpers';

test.describe('Admin authentication', () => {
  test('signed-out users are redirected to login', async ({ page }) => {
    await setupAdminApiMock(page, { user: null });

    await page.goto('/console/flags');

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Sign in to your workspace' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
  });

  test('signed-in non-admin users land on forbidden page', async ({ page }) => {
    await setupAdminApiMock(page, {
      user: { id: 'user-1', email: 'member@example.com', name: 'Member', role: 'user' },
    });

    await page.goto('/console/flags');

    await expect(page).toHaveURL(/\/forbidden$/);
    await expect(page.getByRole('heading', { name: 'This area is for administrators' })).toBeVisible();
  });

  test('admins can open the feature flags page', async ({ page }) => {
    await setupAdminApiMock(page);

    await page.goto('/console/flags');

    await expect(page).toHaveURL(/\/flags$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Feature flags' })).toBeVisible();
    await expect(page.getByText('Admin', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open user app' })).toHaveAttribute('href', 'http://localhost:4300');
    await expect(page.getByRole('link', { name: 'Open user app' })).toHaveAttribute('rel', 'noopener noreferrer');
  });

  test('the user-app route redirects to the configured local user app', async ({ page }) => {
    await setupAdminApiMock(page);
    await page.route('http://localhost:4300/**', async (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<title>User app destination</title>' }));
    await page.goto('/console/user-app');
    await expect(page).toHaveURL('http://localhost:4300/');
    await expect(page).toHaveTitle('User app destination');
  });
});
