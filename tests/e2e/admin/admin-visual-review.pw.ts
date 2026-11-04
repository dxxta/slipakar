import { expect, test } from '@playwright/test';
import { setupAdminApiMock } from './admin-helpers';

test('captures admin pages in light and dark themes for visual review', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const mode of ['light', 'dark'] as const) {
    await setupAdminApiMock(page);
    await page.route('**/me/preferences', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Preferences retrieved', data: { themeMode: mode, themeAccent: 'slate' }, success: true }) });
    });
    const capture = async (name: string): Promise<void> => {
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
      await page.screenshot({ path: testInfo.outputPath(`${mode}-admin-${name}.png`), fullPage: true });
    };

    await page.goto('/flags');
    await expect(page.getByRole('heading', { level: 1, name: 'Feature flags' })).toBeVisible();
    if (mode === 'dark') await expect(page.locator('html')).toHaveClass(/dark/);
    else await expect(page.locator('html')).not.toHaveClass(/dark/);
    await capture('flags');

    await page.goto('/users');
    const row = page.getByRole('row').filter({ hasText: 'member@example.test' }).first();
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: 'Actions for member@example.test' }).click();
    await expect(page.getByRole('menu')).toBeVisible();
    await capture('users-actions');
  }
});
