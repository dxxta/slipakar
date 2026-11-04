import { expect, test } from '@playwright/test';
import { MockApiStore, setupApiMock } from './helpers/api-mock';

test('notifications badge tracks one-read and read-all actions', async ({ page }) => {
  const store = new MockApiStore();
  store.projects = [{
    id: 'project-1', name: 'Payroll', rateLimitPerMinute: 5, maxUploadBytes: 5_242_880,
    maxRows: 10_000, storageQuotaBytes: '1073741824',
  }];
  store.notifications = [
    {
      id: 'notification-1', projectId: 'project-1', campaignId: null,
      type: 'campaign_finished', message: 'Payroll completed', createdAt: '2026-11-09T09:00:00.000Z', readAt: null,
    },
    {
      id: 'notification-2', projectId: 'project-1', campaignId: null,
      type: 'send_failed', message: 'Payroll needs attention', createdAt: '2026-11-09T08:00:00.000Z', readAt: null,
    },
  ];
  await setupApiMock(page, store);

  await page.goto('/notifications');
  const notificationsLink = page.getByRole('link', { name: /Notifications.*2 unread/ });
  await expect(notificationsLink).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Notifications' })).toBeVisible();

  const filterRow = page.locator('[data-filter-row]');
  const listBody = page.locator('app-list-body').first();
  const gap = await filterRow.evaluate((element) => getComputedStyle(element).columnGap);
  const verticalGap = await page.evaluate(({ filter, body }) => {
    const filterBottom = filter.getBoundingClientRect().bottom;
    const bodyTop = body.getBoundingClientRect().top;
    return `${bodyTop - filterBottom}px`;
  }, { filter: await filterRow.elementHandle(), body: await listBody.elementHandle() });
  expect(verticalGap).toBe(gap);

  await page.getByRole('button', { name: 'Mark as read: Payroll completed' }).click();
  await expect(page.getByRole('link', { name: /Notifications.*1 unread/ })).toBeVisible();

  await page.getByRole('button', { name: 'Mark all as read' }).click();
  await expect(page.getByRole('link', { name: 'Notifications', exact: true })).toBeVisible();
});
