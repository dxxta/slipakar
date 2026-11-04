import { expect, test } from '@playwright/test';
import { MockApiStore, setupApiMock } from './helpers/api-mock';

test.describe('PDF Template Builder Flow e2e', () => {
  let store: MockApiStore;
  const projectId = 'proj-pdf-1';

  test.beforeEach(async ({ page }) => {
    store = new MockApiStore();
    store.projects.push({
      id: projectId,
      name: 'Payroll Operations',
      rateLimitPerMinute: 60,
      maxUploadBytes: 10_000_000,
      maxRows: 10_000,
      storageQuotaBytes: '1073741824',
    });

    // Upload with placeholders: name, email, net_pay
    store.uploads.push({
      id: 'upload-1',
      projectId,
      fileName: 'employees.csv',
      rowCount: 5,
      columns: ['name', 'email', 'net_pay'],
      preview: [
        { name: 'John Doe', email: 'john@example.com', net_pay: '$4,500' },
        { name: 'Jane Smith', email: 'jane@example.com', net_pay: '$5,200' },
      ],
      createdAt: new Date().toISOString(),
    });

    await setupApiMock(page, store);
  });

  test('feature flag off: the PDF templates tab shows the Feature disabled card', async ({ page }) => {
    store.pdfBuilderEnabled = false;

    await page.goto(`/projects/${projectId}/pdf-templates`);

    // The feature disabled card should be displayed
    await expect(page.getByRole('heading', { name: 'PDF Builder is disabled' })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'The visual PDF template builder feature is currently turned off' })).toBeVisible();
    // New template button should NOT be visible
    await expect(page.getByRole('button', { name: 'New template' })).not.toBeVisible();
  });

  test('create a payslip: open PDF templates, New, enter a name, add text, table, and divider nodes, edit text in properties panel, move with keyboard, undo/redo, validation error on invalid width, fix, and save with valid payload', async ({
    page,
  }) => {
    await page.goto(`/projects/${projectId}/pdf-templates`);

    // Click "New template" or "Create your first PDF template"
    const newBtn = page.getByRole('button', { name: /New template|Create your first PDF template/ }).first();
    await newBtn.click();
    await expect(page).toHaveURL(`/projects/${projectId}/pdf-templates/new`);

    // 1. Enter template name
    const nameInput = page.getByRole('textbox', { name: 'Template Name' });
    await nameInput.fill('Monthly Payslip');
    await page.getByRole('button', { name: 'Done' }).click();

    // Default template starts with 1 text node: 'node-title-1'
    const appEditor = page.getByRole('application', { name: 'PDF template editor' });
    await expect(appEditor).toBeVisible();

    // 2. Add a table node and a divider node
    await page.getByRole('button', { name: 'Add table element' }).click();
    await page.getByRole('button', { name: 'Add divider element' }).click();

    // 3. Select the text node and edit its content in the properties panel
    const textNodeCanvas = appEditor.getByRole('group', { name: 'text node node-title-1' });
    await textNodeCanvas.click();

    const textContent = page.getByRole('textbox', { name: 'Content' });
    await expect(textContent).toBeVisible();
    await textContent.fill('Payslip for {{name}} - Net: {{net_pay}}');

    // Canvas preview should display updated text / placeholder chips
    await expect(textNodeCanvas).toContainText('Payslip for');
    await expect(textNodeCanvas).toContainText('{{name}}');
    await expect(textNodeCanvas).toContainText('{{net_pay}}');

    // 4. Move text node with keyboard (arrow keys) and assert canvas preview position changed
    // Click the canvas text node to select it and focus it
    await textNodeCanvas.click();
    await textNodeCanvas.focus();

    const xInput = page.getByRole('spinbutton', { name: 'X' });
    const yInput = page.getByRole('spinbutton', { name: 'Y' });
    await expect(xInput).toHaveValue('40');
    await expect(yInput).toHaveValue('40');

    // In user-web, arrow keys move the selected node by 1pt (or 8pt with Shift+Arrow)
    // Press Shift+ArrowDown to move Y by +8 (snap grid: 40 -> 48)
    await page.keyboard.press('Shift+ArrowDown');
    await expect(xInput).toHaveValue('40');
    await expect(yInput).toHaveValue('48');
    await expect(textNodeCanvas).toHaveAttribute('style', /top:\s*48px/);

    // 5. Undo and redo the keyboard move; parent input updates must preserve the history.
    await page.keyboard.press('ControlOrMeta+z');
    await expect(yInput).toHaveValue('40');
    await expect(textNodeCanvas).toHaveAttribute('style', /top:\s*40px/);
    await page.keyboard.press('ControlOrMeta+Shift+z');
    await expect(yInput).toHaveValue('48');
    await expect(textNodeCanvas).toHaveAttribute('style', /top:\s*48px/);

    // 6. Try saving with an invalid node (set width beyond the page) and see validation errors
    // Page width is 595. Set width to 600.
    const widthInput = page.getByRole('spinbutton', { name: 'Width' });
    await widthInput.fill('600');

    await page.getByRole('button', { name: 'Save template' }).click();
    const validationErrors = page.getByRole('alert').filter({ hasText: 'Validation failed' });
    await expect(validationErrors).toBeVisible();
    await expect(validationErrors).toContainText(/exceeds page width/i);
    await expect(store.pdfTemplateRequests).toHaveLength(0);

    // 7. Fix width and save
    await widthInput.fill('350');
    await page.getByRole('button', { name: 'Save template' }).click();

    // A newly created template navigates to its edit route after the POST succeeds.
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/pdf-templates/pdf-tpl-`));

    // Assert the created template in the store
    expect(store.pdfTemplates).toHaveLength(1);
    expect(store.pdfTemplateRequests).toHaveLength(1);
    expect(store.pdfTemplateRequests[0]).toMatchObject({ method: 'POST' });
    const created = store.pdfTemplates[0];
    expect(created.name).toBe('Monthly Payslip');
    expect(created.nodeTree.nodes).toHaveLength(3);

    const savedTextNode = created.nodeTree.nodes.find((n) => n.type === 'text') as {
      type: 'text';
      content: string;
      width: number;
      x: number;
      y: number;
    };
    expect(savedTextNode).toBeDefined();
    expect(savedTextNode.content).toBe('Payslip for {{name}} - Net: {{net_pay}}');
    expect(savedTextNode.width).toBe(350);
    expect(savedTextNode.x + savedTextNode.width).toBeLessThanOrEqual(595);
    expect(store.pdfTemplateRequests[0].body).toMatchObject({
      name: 'Monthly Payslip',
      nodeTree: {
        page: { size: 'A4', margin: 20 },
        nodes: expect.arrayContaining([
          expect.objectContaining({ type: 'text', content: 'Payslip for {{name}} - Net: {{net_pay}}', width: 350 }),
          expect.objectContaining({ type: 'table' }),
          expect.objectContaining({ type: 'divider' }),
        ]),
      },
    });
  });

  test('edit an existing template: open it, delete a node, save, and assert PATCH body', async ({ page }) => {
    const existingId = 'tpl-existing-1';
    store.pdfTemplates.push({
      id: existingId,
      projectId,
      name: 'Existing Tax Form',
      nodeTree: {
        page: { size: 'A4', margin: 20 },
        nodes: [
          {
            id: 'node-t1',
            type: 'text',
            x: 40,
            y: 40,
            width: 200,
            height: 40,
            content: 'Tax Summary',
            style: { fontSize: 14, bold: true, align: 'left', color: '#000000' },
          },
          {
            id: 'node-d1',
            type: 'divider',
            x: 40,
            y: 90,
            width: 400,
            height: 1,
            style: { color: '#cccccc', thickness: 1 },
          },
        ],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await page.goto(`/projects/${projectId}/pdf-templates`);

    // Existing templates open from their row actions menu.
    await page.getByRole('button', { name: 'Actions for Existing Tax Form' }).click();
    await page.getByRole('menuitem', { name: 'Edit' }).click();
    await expect(page).toHaveURL(`/projects/${projectId}/pdf-templates/${existingId}`);
    await page.getByRole('button', { name: 'Done' }).click();

    // Select the divider node and delete it
    const editor = page.getByRole('application', { name: 'PDF template editor' });
    const dividerNodeCanvas = editor.getByRole('group', { name: 'divider node node-d1' });
    await dividerNodeCanvas.click();

    await page.getByRole('button', { name: 'Delete' }).click();

    // Verify only 1 node remains in canvas
    await expect(editor.getByRole('group', { name: 'text node node-t1' })).toHaveCount(1);
    await expect(dividerNodeCanvas).toHaveCount(0);

    // Save
    await page.getByRole('button', { name: 'Save template' }).click();
    await expect(page.getByRole('status')).toContainText('saved successfully');

    // Check the actual PATCH request body and resulting store state.
    expect(store.pdfTemplateRequests).toHaveLength(1);
    expect(store.pdfTemplateRequests[0]).toMatchObject({
      method: 'PATCH',
      id: existingId,
      body: {
        name: 'Existing Tax Form',
        nodeTree: {
          nodes: [expect.objectContaining({ id: 'node-t1', type: 'text' })],
        },
      },
    });
    const updated = store.pdfTemplates.find((t) => t.id === existingId);
    expect(updated).toBeDefined();
    expect(updated!.nodeTree.nodes).toHaveLength(1);
    expect(updated!.nodeTree.nodes[0].type).toBe('text');
  });

  test('leaving the editor with unsaved changes asks for confirmation', async ({ page }) => {
    await page.goto(`/projects/${projectId}/pdf-templates/new`);

    // Make an edit (type in name)
    const nameInput = page.getByRole('textbox', { name: 'Template Name' });
    await nameInput.fill('Unsaved Draft');
    await page.getByRole('button', { name: 'Done' }).click();

    // Confirm dialog handler
    let dialogPrompted = false;
    page.once('dialog', async (dialog) => {
      dialogPrompted = true;
      expect(dialog.message()).toContain('unsaved changes');
      await dialog.dismiss(); // Dismiss / cancel leaving
    });

    // Try navigating back via "← Back to PDF Templates"
    await page.getByRole('link', { name: '← Back to PDF Templates' }).click();
    expect(dialogPrompted).toBe(true);

    // Should remain on the editor page because user cancelled
    expect(page.url()).toContain('/pdf-templates/new');

    // Now accept the dialog when clicking Cancel
    page.once('dialog', async (dialog) => {
      await dialog.accept(); // Confirm leaving
    });

    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page).toHaveURL(`/projects/${projectId}/pdf-templates`);
  });
});
