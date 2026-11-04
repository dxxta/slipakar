import { expect, test } from '@playwright/test';
import { MockApiStore, setupApiMock } from './helpers/api-mock';

test.describe('Full Campaign Wizard Flow e2e', () => {
  let store: MockApiStore;

  test.beforeEach(async ({ page }) => {
    store = new MockApiStore();
    await setupApiMock(page, store);
  });

  test('walks through project creation, SMTP setup, template design with unsafe check, data upload, field mapping, campaign creation, and delivery', async ({
    page,
  }) => {
    // 1. Create a project
    await page.goto('/projects');
    await page.getByRole('button', { name: 'New project' }).click();
    const projectNameInput = page.getByRole('textbox', { name: 'Project name' });
    await projectNameInput.fill('HR Operations');
    await page.getByRole('button', { name: 'Create project' }).click();

    const projectLink = page.getByRole('link', { name: 'HR Operations' });
    await expect(projectLink).toBeVisible();

    // Navigate into the project
    await projectLink.click();
    await expect(page).toHaveURL(/\/projects\/[^/]+\/overview/);
    await expect(page.getByText('Workspace', { exact: true })).toHaveCount(0);

    // 2. Configure SMTP Connection
    const nav = page.getByRole('tablist', { name: 'Project sections' });
    const smtpTab = nav.getByRole('tab', { name: 'SMTP', exact: true });
    await smtpTab.click();
    await expect(page).toHaveURL(/\/smtp/);

    // Open Add SMTP connection
    const addSmtpBtn = page.getByRole('button', { name: 'Add connection' }).first();
    await addSmtpBtn.click();

    await page.getByRole('textbox', { name: 'Host' }).fill('smtp.mailtrap.io');
    await page.getByRole('spinbutton', { name: 'Port' }).fill('587');
    await page.getByRole('textbox', { name: 'Username' }).fill('smtp_user');
    await page.getByLabel('Password', { exact: false }).fill('secret_smtp_password');
    await page.getByRole('textbox', { name: 'From Address' }).fill('hr@lokaslip.com');

    await page.getByRole('button', { name: 'Create connection' }).click();
    await expect(page.getByRole('heading', { name: 'smtp.mailtrap.io:587' })).toBeVisible();

    // 3. Create Template with placeholder validation
    const templatesTab = nav.getByRole('tab', { name: 'Templates', exact: true });
    await templatesTab.click();
    await expect(page).toHaveURL(/\/templates/);

    const newTemplateBtn = page.getByRole('button', { name: /New template|Create your first template/ }).first();
    await newTemplateBtn.click();

    await page.getByRole('textbox', { name: 'Template name' }).fill('Salary Notification');
    await page.getByRole('textbox', { name: 'Subject line' }).fill('Salary Slip for {{name}}');

    const bodyTextarea = page.getByRole('textbox', { name: 'HTML body' });

    // Test unsafe syntax detection
    await bodyTextarea.fill('<p>Hello {{name}}, {{#if bonus}}bonus{{/if}}</p>');
    await expect(page.getByRole('heading', { name: 'Unsupported placeholder syntax' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create template' })).toBeDisabled();

    // Correct to valid safe placeholder syntax
    await bodyTextarea.fill('<p>Dear {{name}},</p><p>Your pay is {{amount}}.</p>');
    await expect(page.getByRole('heading', { name: 'Unsupported placeholder syntax' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Create template' })).toBeEnabled();

    await page.getByRole('button', { name: 'Create template' }).click();
    await expect(page.getByRole('heading', { name: 'Salary Notification' })).toBeVisible();

    // 4. Upload Data File & Map Fields
    const dataTab = nav.getByRole('tab', { name: 'Data', exact: true });
    await dataTab.click();
    await expect(page).toHaveURL(/\/data/);

    // Upload CSV file
    const csvContent = 'name,email,amount\nAlice,alice@example.com,$1000\nBob,bob@example.com,$2000';
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Choose file' }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'recipients.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent),
    });

    await expect(page.getByRole('cell', { name: 'recipients.csv Active' })).toBeVisible();

    // Preview table should display
    await expect(page.getByRole('table', { name: 'Data preview table' })).toBeVisible();

    // Select email template in field mapping
    await page.getByRole('button', { name: 'Configure field mapping' }).click();
    const templateSelect = page.getByLabel('Email Template', { exact: true });
    await templateSelect.selectOption({ label: 'Salary Notification' });

    // Map recipient email column
    const emailColSelect = page.getByLabel('Recipient Email Column', { exact: false });
    await emailColSelect.selectOption('email');

    // Auto-suggest matches or map placeholders
    await page.getByRole('button', { name: 'Auto-suggest matches' }).click();

    // Ensure mapping complete and save
    const saveMappingBtn = page.getByRole('button', { name: 'Save mapping' });
    await expect(saveMappingBtn).toBeEnabled();
    await saveMappingBtn.click();

    await expect(page.getByRole('status').filter({ hasText: 'Field mapping saved successfully' })).toBeVisible();

    // 5. Create and Send Campaign
    const campaignsTab = nav.getByRole('tab', { name: 'Campaigns', exact: true });
    await campaignsTab.click();
    await expect(page).toHaveURL(/\/campaigns$/);

    const newCampaignBtn = page.getByRole('button', { name: /New campaign|Create your first campaign/ }).first();
    await newCampaignBtn.click();
    await expect(page).toHaveURL(/\/campaigns\/new/);

    // Select campaign settings
    await page.getByLabel('Email Template *').selectOption({ label: 'Salary Notification (Salary Slip for {{name}})' });
    await page.getByLabel('Recipient Data Upload *').selectOption({ label: 'recipients.csv (3 rows)' });
    await page.getByLabel('Recipient Email Column *').selectOption('email');
    await page.getByLabel('SMTP Delivery Connection *').selectOption({ label: 'smtp.mailtrap.io:587 (smtp_user)' });

    // Submit campaign creation
    await page.getByRole('button', { name: 'Create Campaign' }).click();

    // Navigated to campaign detail page
    await expect(page).toHaveURL(/\/campaigns\/camp-/);

    // Verify initial status is Draft
    const campaignHeading = page.getByRole('heading', { level: 1, name: /Campaign #/ });
    await expect(campaignHeading).toBeVisible();
    const campaignStatus = page.getByTestId('campaign-status-badge');
    await expect(campaignStatus).toHaveText('Draft');

    // Trigger Send
    const sendCampaignBtn = page.getByRole('button', { name: 'Send campaign' });
    await expect(sendCampaignBtn).toBeVisible();
    await sendCampaignBtn.click();

    // Confirm dialog
    const confirmDialog = page.getByRole('alertdialog', { name: 'Confirm Campaign Delivery' });
    await expect(confirmDialog).toBeVisible();

    const confirmSendBtn = confirmDialog.getByRole('button', { name: 'Yes, Send Now' });
    await confirmSendBtn.click();

    // Status transitions from sending to completed (mock poll count)
    await expect(campaignStatus).toHaveText(/Sending|Completed/);
    await expect(campaignStatus).toHaveText('Completed');

    // Verify exactly one send request was dispatched to backend
    expect(store.sendRequests.length).toBe(1);

    // Verify recipient rows appear as sent
    await expect(page.getByRole('table', { name: 'Recipients delivery table' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'alice@example.com' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'bob@example.com' })).toBeVisible();
  });
});
