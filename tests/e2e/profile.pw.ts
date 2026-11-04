import { expect, test } from '@playwright/test';
import { MockApiStore, setupApiMock } from './helpers/api-mock';

test('profile updates name and avatar, while email remains pending verification', async ({ page }) => {
  const store = new MockApiStore();
  store.user = { id: 'user-1', email: 'person@example.test', name: 'Ada Lovelace', role: 'user' };
  await setupApiMock(page, store);
  await page.goto('/profile');

  const avatarButton = page.getByRole('button', { name: 'Change avatar' });
  await expect(avatarButton).toContainText('AL');
  await expect(avatarButton.locator('img')).toHaveCount(0);
  await page.getByLabel('Avatar image file').setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aWQAAAAASUVORK5CYII=', 'base64') });
  await expect(page.getByRole('status')).toContainText('Avatar updated successfully.');
  await expect(avatarButton.locator('img')).toHaveAttribute('src', '/me/avatar/user-1?v=mock-hash');
  await expect(page.getByRole('button', { name: 'Account menu' }).locator('img')).toHaveAttribute('src', '/me/avatar/user-1?v=mock-hash');
  await expect(page.getByLabel('Avatar URL')).toHaveValue('/me/avatar/user-1?v=mock-hash');
  await page.getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByRole('status')).toContainText('Avatar removed.');
  await expect(avatarButton).toContainText('AL');
  await expect(avatarButton.locator('img')).toHaveCount(0);
  await page.getByLabel('Name', { exact: true }).fill('Ada');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(page.getByRole('status')).toContainText('Profile saved successfully.');

  await page.getByLabel('New email').fill('ada@example.test');
  await page.getByRole('button', { name: 'Send verification link' }).click();
  await expect(page.getByText('Check ada@example.test to confirm')).toBeVisible();
  await expect(page.getByText('Current email: person@example.test')).toBeVisible();
  expect(store.user?.email).toBe('person@example.test');
});
