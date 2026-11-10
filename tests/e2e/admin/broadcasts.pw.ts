import { expect, test } from '@playwright/test';
import { setupAdminApiMock } from './admin-helpers';

test('admin composes, previews, and confirms a broadcast against the strict API contract', async ({ page }) => {
  const state = await setupAdminApiMock(page);
  await page.goto('/console/broadcasts');
  await expect(page.getByRole('heading', { level: 1, name: 'Broadcasts' })).toBeVisible();
  await page.getByRole('button', { name: 'Create broadcast' }).click();
  await page.getByLabel('Subject').fill('Quarterly update');
  await page.getByLabel('Plain-text message').fill('Hello {{name}}');
  await page.getByRole('button', { name: 'Preview broadcast' }).click();
  await expect(page.getByText('2 recipients')).toBeVisible();
  await expect(page.getByText('a***@example.test')).toBeVisible();
  await page.getByRole('region', { name: 'Broadcast preview' }).getByRole('button', { name: 'Send broadcast' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Send broadcast' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Broadcast sent' })).toBeVisible();

  expect(state.broadcastRequests).toEqual(expect.arrayContaining([
    { method: 'POST', path: '/admin/broadcasts', body: { subject: 'Quarterly update', bodyText: 'Hello {{name}}', audience: 'all' } },
    { method: 'POST', path: '/admin/broadcasts/broadcast-1/preview' },
    { method: 'POST', path: '/admin/broadcasts/broadcast-1/send' },
  ]));
  expect(state.broadcastRequests.find((request) => request.method === 'POST' && request.path === '/admin/broadcasts')?.body).toEqual({ subject: 'Quarterly update', bodyText: 'Hello {{name}}', audience: 'all' });
});
