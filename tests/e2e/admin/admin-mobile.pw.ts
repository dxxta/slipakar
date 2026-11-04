import { expect, test } from '@playwright/test';
import { setupAdminApiMock } from './admin-helpers';

test('admin navigation opens from the mobile bar and closes after choosing a page', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setupAdminApiMock(page);
  await page.goto('/flags');

  await expect(page.getByRole('heading', { name: 'Feature flags' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible();
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.getByRole('dialog', { name: 'Navigation' })).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Account menu' })).toBeVisible();
  await page.getByRole('dialog').getByRole('link', { name: 'Monitoring' }).click();
  await expect(page).toHaveURL(/\/monitoring$/);
  await expect(page.getByRole('dialog', { name: 'Navigation' })).toBeHidden();
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('dialog', { name: 'Navigation' }).press('Escape');
  await expect(page.getByRole('dialog', { name: 'Navigation' })).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
