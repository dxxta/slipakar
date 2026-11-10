import { expect, test } from '@playwright/test';
import { setupAdminApiMock } from './admin-helpers';

test.describe('Admin feature flags', () => {
  test('renders the flags and sends the real API body when a switch changes', async ({ page }) => {
    const mock = await setupAdminApiMock(page);
    await page.goto('/console/flags');

    await expect(page.getByRole('heading', { level: 1, name: 'Feature flags' })).toBeVisible();
    const switches = page.getByRole('switch');
    await expect(switches).toHaveCount(3);
    const scalarDocsSwitch = page.getByRole('switch', { name: 'Scalar documentation' });
    await expect(scalarDocsSwitch).not.toBeChecked();

    const putResponse = page.waitForResponse((response) =>
      response.request().method() === 'PUT' && response.url().endsWith('/admin/config/scalar_docs'),
    );
    await scalarDocsSwitch.click();
    await putResponse;

    await expect(scalarDocsSwitch).toBeChecked();
    expect(mock.putCalls).toEqual([{ key: 'scalar_docs', body: { value: true } }]);
  });

  test('rolls a failed optimistic switch update back and shows the error', async ({ page }) => {
    const mock = await setupAdminApiMock(page, { failPutKeys: ['pdf_builder'] });
    await page.goto('/console/flags');
    const pdfSwitch = page.getByRole('switch', { name: 'PDF builder' });
    await expect(pdfSwitch).not.toBeChecked();

    const putResponse = page.waitForResponse((response) =>
      response.request().method() === 'PUT' && response.url().endsWith('/admin/config/pdf_builder'),
    );
    await pdfSwitch.click();
    await putResponse;

    await expect(pdfSwitch).not.toBeChecked();
    await expect(page.getByRole('alert').first()).toContainText('Configuration update failed');
    expect(mock.putCalls).toEqual([{ key: 'pdf_builder', body: { value: true } }]);
  });

  test('shows Retry after a config GET failure and reloads the real config response', async ({ page }) => {
    const mock = await setupAdminApiMock(page, { failConfigGetCalls: [2] });
    await page.goto('/console/flags');

    await expect(page.getByTestId('flags-error-state')).toBeVisible();
    await expect(page.getByText('Configuration service unavailable')).toBeVisible();
    const retryResponse = page.waitForResponse((response) =>
      response.request().method() === 'GET' && new URL(response.url()).pathname === '/admin/config' && mock.configGetCalls >= 3,
    );
    await page.getByRole('button', { name: 'Retry' }).click();
    await retryResponse;

    await expect(page.getByTestId('flags-error-state')).toHaveCount(0);
    await expect(page.getByRole('switch', { name: 'Self sign-up' })).toBeVisible();
  });
});
