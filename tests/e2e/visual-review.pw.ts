import { expect, test } from '@playwright/test';
import { MockApiStore, setupApiMock } from './helpers/api-mock';

test('captures user pages in light and dark themes for visual review', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const store = new MockApiStore();
  store.user = { id: 'user-1', email: 'review@example.test', name: 'Review User', role: 'user', image: null };
  store.projects = [{ id: 'project-review', name: 'Payroll', rateLimitPerMinute: 5, maxUploadBytes: 5_242_880, maxRows: 10_000, storageQuotaBytes: '1073741824' }];
  store.notifications = [{ id: 'notice-review', projectId: 'project-review', campaignId: null, type: 'campaign_finished', message: 'Monthly payroll completed', createdAt: '2026-11-09T09:00:00.000Z', readAt: null }];
  await setupApiMock(page, store);

  for (const mode of ['light', 'dark'] as const) {
    store.themePreference = { themeMode: mode, themeAccent: 'slate' };
    const capture = async (name: string): Promise<void> => {
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
      await page.screenshot({ path: testInfo.outputPath(`${mode}-${name}.png`), fullPage: true });
    };

    await page.goto('/projects');
    await expect(page.getByRole('heading', { level: 1, name: 'Projects' })).toBeVisible();
    if (mode === 'dark') await expect(page.locator('html')).toHaveClass(/dark/);
    else await expect(page.locator('html')).not.toHaveClass(/dark/);
    await capture('projects');

    await page.goto('/projects/project-review/overview');
    await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recent changes' })).toBeVisible();
    await capture('overview');

    await page.goto('/notifications');
    await expect(page.getByRole('heading', { level: 1, name: 'Notifications' })).toBeVisible();
    await capture('notifications');

    await page.goto('/profile');
    await expect(page.getByRole('heading', { level: 1, name: 'Profile' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Change avatar' })).toBeVisible();
    await capture('profile');

    await page.goto('/projects');
    await page.getByRole('searchbox', { name: 'Search' }).fill('no matching project');
    await expect(page.getByText('No results match “no matching project”')).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Sort projects' })).toBeVisible();
    await capture('projects-search-empty');

    await page.goto('/projects');
    await page.getByRole('button', { name: 'Actions for Payroll' }).click();
    await expect(page.getByRole('menu')).toBeVisible();
    await capture('row-actions');
  }
});
