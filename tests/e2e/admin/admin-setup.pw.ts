import { expect, test } from '@playwright/test';
import { setupAdminApiMock } from './admin-helpers';

test.describe('Admin setup gate', () => {
  test('keeps admin pages behind setup and treats environment mail as configured', async ({ page }) => {
    const mock = await setupAdminApiMock(page, { completeSetup: false, mailFromEnvironment: true });
    await page.goto('/flags');

    await expect(page).toHaveURL(/\/setup$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Setup' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Mail' })).toBeVisible();
    const mailCard = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Mail' }) });
    await expect(mailCard).toContainText('Configured');
    await expect(mailCard).toContainText('Environment');
    await mailCard.getByRole('button', { name: 'Edit settings' }).click();
    await expect(page.getByLabel('SMTP host')).toHaveValue('smtp.example.test');
    await expect(page.getByLabel('Port')).toHaveValue('587');
    await expect(page.getByLabel('Use TLS')).not.toBeChecked();
    await expect(page.getByLabel('From address')).toHaveValue('notices@example.test');
    await expect(page.getByLabel('Password (write only)')).toHaveValue('');
    await page.getByRole('button', { name: 'Close panel' }).click();
    const uptimeCard = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Uptime Kuma' }) });
    await expect(uptimeCard).toContainText('Not configured');
    await page.getByRole('link', { name: 'Feature flags' }).first().click();
    await expect(page).toHaveURL(/\/setup$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Setup' })).toBeVisible();
    expect(mock.setupRequests.some((request) => request.path === '/admin/setup' && request.method === 'GET')).toBe(true);
  });

  test('saves mail settings and tests without echoing its write-only password', async ({ page }) => {
    const mock = await setupAdminApiMock(page, { completeSetup: false });
    await page.goto('/setup');
    const mailCard = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Mail' }) });
    await mailCard.getByRole('button', { name: 'Configure' }).click();

    await page.getByLabel('SMTP host').fill('smtp.example.test');
    await page.getByLabel('Port').fill('465');
    await page.getByLabel('Use TLS').check();
    await page.getByLabel('From address').fill('notices@example.test');
    await page.getByLabel('Username (optional)').fill('mailer');
    await page.getByLabel('Password (write only)').fill('private-secret');
    await page.getByRole('button', { name: 'Save settings' }).click();
    await expect(page.getByRole('status')).toContainText('Settings saved');
    await expect(page.getByLabel('Password (write only)')).toHaveValue('');
    await page.getByRole('button', { name: 'Test connection' }).last().click();
    await expect(page.getByRole('status')).toContainText('Connection successful');

    expect(mock.setupRequests.find((request) => request.method === 'PUT')?.body).toEqual({ host: 'smtp.example.test', port: 465, secure: true, username: 'mailer', password: 'private-secret', fromAddress: 'notices@example.test' });
    const renderedText = await page.locator('body').innerText();
    expect(renderedText).not.toContain('private-secret');
    await expect(page.locator('input[type="password"]')).toHaveValue('');
  });
});
