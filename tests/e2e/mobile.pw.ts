import { expect, test } from '@playwright/test';
import { MockApiStore, setupApiMock } from './helpers/api-mock';

test('user navigation opens from the mobile bar and closes after choosing a page', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setupApiMock(page, new MockApiStore());
  await page.goto('/projects');

  await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeHidden();
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.getByRole('dialog', { name: 'Navigation' })).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Account menu' })).toBeVisible();
  await page.getByRole('dialog').getByRole('link', { name: 'Notifications' }).click();
  await expect(page).toHaveURL(/\/notifications$/);
  await expect(page.getByRole('dialog', { name: 'Navigation' })).toBeHidden();
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Navigation' })).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
