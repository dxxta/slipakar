import { expect, test } from '@playwright/test';
import { setupAdminApiMock } from './admin-helpers';

test('admins can search, view, edit, disable, and see user status', async ({ page }) => {
  const state = await setupAdminApiMock(page);
  await page.goto('/console/users');

  await expect(page.getByRole('heading', { name: 'Users', level: 1 })).toBeVisible();
  const memberRow = page.getByRole('row').filter({ hasText: 'member@example.test' }).first();
  await expect(memberRow).toBeVisible();
  const search = page.getByRole('searchbox', { name: 'Search' });
  await search.fill('member');
  await expect.poll(() => state.userListCalls).toBe(2);

  await memberRow.getByRole('button', { name: 'Actions for member@example.test' }).click();
  await page.getByRole('menuitem', { name: 'Detail' }).click();
  await expect(page.getByRole('dialog', { name: 'User details' })).toContainText('member@example.test');
  await page.getByRole('button', { name: 'Close panel' }).click();
  await memberRow.getByRole('button', { name: 'Actions for member@example.test' }).click();
  await page.getByRole('menuitem', { name: 'Edit' }).click();
  const editDrawer = page.getByRole('dialog', { name: 'Edit user' });
  await editDrawer.getByLabel('Name').fill('Updated member');
  await editDrawer.getByLabel('Image URL').fill('https://images.example.test/member.png');
  await editDrawer.getByRole('button', { name: 'Save user' }).click();
  await expect(page.getByRole('row').filter({ hasText: 'member@example.test' }).first()).toContainText('Updated member');

  await memberRow.getByRole('button', { name: 'Actions for member@example.test' }).click();
  await page.getByRole('menuitem', { name: 'Disable' }).click();
  const confirmation = page.getByRole('alertdialog');
  await expect(confirmation).toContainText('Disable member@example.test?');
  await confirmation.getByRole('button', { name: 'Disable user' }).click();
  await expect(page.getByRole('row').filter({ hasText: 'member@example.test' }).first().getByText('Disabled', { exact: true })).toBeVisible();
  expect(state.userMutations).toEqual(['PATCH', 'disable']);
});
