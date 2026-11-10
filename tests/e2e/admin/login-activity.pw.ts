import { expect, test } from '@playwright/test';
import { setupAdminApiMock } from './admin-helpers';

test('admin login activity searches users and opens the on-demand map preview', async ({ page }) => {
  const state = await setupAdminApiMock(page, { loginActivity: [{
    id: 'event-1', userId: 'member-1', userEmail: 'member@example.test', userName: 'Member', ip: '203.0.113.10', proxy: true,
    browser: 'Firefox', os: 'Linux', deviceType: 'Desktop', country: 'US', region: 'CA', city: 'San Francisco', latitude: 37.7,
    longitude: -122.4, createdAt: '2026-11-09T00:00:00.000Z',
  }] });
  await page.goto('/console/login-activity');
  await expect(page.getByRole('heading', { level: 1, name: 'Login activity' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'member@example.test' })).toBeVisible();
  await expect(page.getByText('Possible proxy', { exact: true })).toHaveAttribute('title', 'best effort');
  await expect(page.locator('img[src^="https://tile.openstreetmap.org/"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'View map for San Francisco, CA, US' }).click();
  await expect(page.getByRole('img', { name: 'Map around San Francisco, CA, US' })).toBeVisible();
  await expect(page.locator('img[src^="https://tile.openstreetmap.org/"]')).toHaveCount(9);
  await expect(page.getByRole('link', { name: '© OpenStreetMap contributors' })).toHaveAttribute('href', 'https://www.openstreetmap.org/copyright');
  expect(state.loginActivityCalls).toBe(1);
});
