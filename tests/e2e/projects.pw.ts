import { expect, test } from '@playwright/test';
import { MockApiStore, setupApiMock } from './helpers/api-mock';

test.describe('Projects management e2e', () => {
  let store: MockApiStore;

  test.beforeEach(async ({ page }) => {
    store = new MockApiStore();
    await setupApiMock(page, store);
  });

  test('creates, renames, and deletes a project with confirmation', async ({ page }) => {
    await page.goto('/projects');
    await expect(page.getByRole('heading', { level: 1, name: 'Projects' })).toBeVisible();
    await expect(page.getByText('Workspace', { exact: true })).toBeVisible();

    // 1. Create project
    await page.getByRole('button', { name: 'New project' }).click();
    const projectNameInput = page.getByRole('textbox', { name: 'Project name' });
    await expect(projectNameInput).toBeVisible();
    await projectNameInput.fill('Monthly Payroll');

    const createBtn = page.getByRole('button', { name: 'Create project' });
    await createBtn.click();

    // The new project should appear in the list
    const projectLink = page.getByRole('link', { name: 'Monthly Payroll' });
    await expect(projectLink).toBeVisible();

    // 2. Rename project
    await page.getByRole('button', { name: 'Actions for Monthly Payroll' }).click();
    await page.getByRole('menuitem', { name: 'Rename' }).click();
    const renameInput = page.getByRole('textbox', { name: 'Project name' });
    await expect(renameInput).toBeVisible();
    await renameInput.fill('Annual Payroll');

    const saveNameBtn = page.getByRole('button', { name: 'Save name' });
    await saveNameBtn.click();

    const updatedLink = page.getByRole('link', { name: 'Annual Payroll' });
    await expect(updatedLink).toBeVisible();

    // 3. Delete project with confirm
    await page.getByRole('button', { name: 'Actions for Annual Payroll' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();

    // Confirm dialog / prompt should be visible
    const confirmDeleteBtn = page.getByRole('button', { name: 'Delete project' });
    await expect(confirmDeleteBtn).toBeVisible();

    await confirmDeleteBtn.click();

    // Project should disappear and empty state shown
    await expect(page.getByRole('link', { name: 'Annual Payroll' })).not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'No projects yet' })).toBeVisible();
  });

  test('search-empty keeps filters and pagination mounted', async ({ page }) => {
    store.projects = [{ id: 'p-1', name: 'Payroll', rateLimitPerMinute: 5, maxUploadBytes: 5_242_880, maxRows: 10_000, storageQuotaBytes: '1073741824' }];
    await page.goto('/projects');
    await expect(page.getByRole('link', { name: 'Payroll' })).toBeVisible();
    await page.getByRole('searchbox', { name: 'Search' }).fill('no match');
    await expect(page.getByText('No results match “no match”')).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Sort projects' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Table pagination' })).toBeVisible();
    await expect(page.getByRole('table', { name: 'Your projects' })).toHaveCount(0);
  });
});
