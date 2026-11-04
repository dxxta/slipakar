import { expect, test } from '@playwright/test';
import { setupAdminApiMock } from './admin-helpers';

test.describe('Admin monitoring', () => {
  test('shows the four monitoring links with safe new-tab attributes', async ({ page }) => {
    await setupAdminApiMock(page);
    await page.goto('/monitoring');

    const links = [
      { name: 'Open Grafana', href: 'http://localhost:3001' },
      { name: 'Open Uptime Kuma', href: 'http://localhost:3002' },
      { name: 'Open API reference', href: '/docs' },
      { name: 'Open OpenAPI JSON', href: '/openapi.json' },
    ];
    for (const linkInfo of links) {
      const link = page.getByRole('link', { name: linkInfo.name });
      await expect(link).toHaveAttribute('href', linkInfo.href);
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });

  test('shows Healthy after API health succeeds and Refresh makes another request', async ({ page }) => {
    const mock = await setupAdminApiMock(page);
    await page.goto('/monitoring');
    await expect(page.getByTestId('health-badge')).toContainText('Healthy');
    expect(mock.healthCalls).toBe(1);

    const refreshResponse = page.waitForResponse((response) =>
      response.request().method() === 'GET' && new URL(response.url()).pathname === '/health' && mock.healthCalls === 2,
    );
    await page.getByRole('button', { name: 'Refresh API health status' }).click();
    await refreshResponse;

    await expect(page.getByTestId('health-badge')).toContainText('Healthy');
    expect(mock.healthCalls).toBe(2);
  });

  test('shows Unreachable when the health endpoint fails', async ({ page }) => {
    await setupAdminApiMock(page, { failHealthCalls: [1] });
    await page.goto('/monitoring');

    await expect(page.getByTestId('health-badge')).toContainText('Unreachable');
  });
});
