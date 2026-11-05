import { expect, test } from '@playwright/test';
import { MockApiStore, setupApiMock } from './helpers/api-mock';

test('user login activity displays events and requests map tiles only on demand', async ({ page }) => {
  const store = new MockApiStore();
  store.loginActivity = [{ id: 'event-1', userId: 'user-1', ip: '203.0.113.15', proxy: true, browser: 'Chrome', os: 'macOS', deviceType: 'Desktop', country: 'ID', region: 'Jakarta', city: 'Jakarta', latitude: -6.2, longitude: 106.8, createdAt: '2026-11-09T00:00:00.000Z' }];
  await setupApiMock(page, store);
  await page.goto('/login-activity');
  await expect(page.getByRole('heading', { level: 1, name: 'Login activity' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Chrome · macOS' })).toBeVisible();
  await expect(page.locator('img[src^="https://tile.openstreetmap.org/"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'View map for Jakarta, Jakarta, ID' }).click();
  await expect(page.getByRole('img', { name: 'Map around Jakarta, Jakarta, ID' })).toBeVisible();
  await expect(page.locator('img[src^="https://tile.openstreetmap.org/"]')).toHaveCount(9);
});
