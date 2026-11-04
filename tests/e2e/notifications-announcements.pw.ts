import { expect, test } from '@playwright/test';
import { MockApiStore, setupApiMock } from './helpers/api-mock';

test('announcement reads update the combined sidebar unread badge', async ({ page }) => {
  const store = new MockApiStore();
  store.userNotices = [
    { id: 'notice-1', userId: 'user-1', broadcastId: 'b1', title: 'Workspace update', message: 'Templates are available.', readAt: null, createdAt: '2026-11-09T09:00:00.000Z' },
    { id: 'notice-2', userId: 'user-1', broadcastId: 'b2', title: 'Maintenance window', message: 'Scheduled this weekend.', readAt: null, createdAt: '2026-11-09T08:00:00.000Z' },
  ];
  await setupApiMock(page, store);
  await page.goto('/notifications');

  await expect(page.getByRole('link', { name: 'Notifications 2 unread' })).toBeVisible();
  await page.getByRole('tab', { name: 'Announcements' }).click();
  await expect(page.getByRole('heading', { name: 'Workspace update' })).toBeVisible();
  await page.getByRole('button', { name: 'Mark announcement as read: Workspace update' }).click();
  await expect(page.getByRole('link', { name: 'Notifications 1 unread' })).toBeVisible();
  await page.getByRole('button', { name: 'Mark all announcements as read' }).click();
  await expect(page.getByRole('link', { name: 'Notifications', exact: true })).toBeVisible();
});
