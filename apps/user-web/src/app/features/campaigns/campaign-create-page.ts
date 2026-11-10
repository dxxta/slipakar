import { CommonModule } from '@angular/common';
import { SelectControl } from '../../ui/shared/select-control';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiClient } from '../../core/api-client';
import { ApiError } from '../../core/api-error';
import { HlmAlert, HlmAlertDescription, HlmAlertTitle } from '../../ui/alert/src';
import { HlmButton } from '../../ui/button/src';
import { HlmCard, HlmCardContent, HlmCardDescription, HlmCardHeader, HlmCardTitle } from '../../ui/card/src';
import { Drawer } from '../../ui/shared/drawer';
import { CampaignsService, type CreateCampaignPayload } from './campaigns.service';

interface EmailTemplateSummary {
  id: string;
  name: string;
  subject: string;
}

interface PdfTemplateSummary {
  id: string;
  name: string;
}

interface SmtpConnectionSummary {
  id: string;
  host: string;
  port: number;
  username: string;
}

interface UploadSummary {
  id: string;
  fileName: string;
  columns: string[];
  rowCount: number;
}

interface FieldMappingSummary {
  id: string;
  templateId: string;
  uploadId: string;
  mapping: Record<string, string>;
}

@Component({
  selector: 'app-campaign-create-page',
  imports: [
    SelectControl,
    CommonModule,
    HlmButton,
    HlmCard,
    HlmCardHeader,
    HlmCardTitle,
    HlmCardDescription,
    HlmCardContent,
    HlmAlert,
    HlmAlertTitle,
    HlmAlertDescription,
    Drawer,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-drawer [open]="true" title="Create campaign" (closed)="navigateBack()">
    <div class="space-y-6">
      <p class="text-sm text-muted-foreground">Configure recipients, templates, and SMTP connection for your campaign.</p>

      @if (actionError()) {
        <div aria-live="polite" role="alert" data-testid="campaign-create-error">
          <div hlmAlert variant="destructive">
            <h4 hlmAlertTitle>Validation Error</h4>
            <p hlmAlertDescription>{{ actionError() }}</p>
            @if (invalidRows().length > 0) {
              <p class="mt-2 text-xs font-mono">
                Offending row index(es): {{ invalidRows().join(', ') }}
              </p>
            }
          </div>
        </div>
      }

      @if (missingPrerequisites().length > 0) {
        <div aria-live="polite" role="alert" data-testid="missing-prerequisites-alert">
          <div hlmAlert class="border-amber-500/25 bg-amber-500/10 text-amber-900 dark:text-amber-200">
            <h4 hlmAlertTitle class="text-amber-800 dark:text-amber-200">Missing Configuration</h4>
            <p hlmAlertDescription class="text-amber-700 dark:text-amber-300">
              Before creating a campaign, the following items are required:
            </p>
            <ul class="mt-2 list-disc list-inside text-xs space-y-1 text-amber-800 dark:text-amber-200">
              @for (item of missingPrerequisites(); track item.tab) {
                <li>
                  <a
                    [href]="'/projects/' + projectId() + '/' + item.tab"
                    class="font-semibold underline hover:text-amber-950"
                    (click)="navigateToSection($event, item.tab)"
                  >
                    {{ item.label }}
                  </a>
                </li>
              }
            </ul>
          </div>
        </div>
      }

      <div hlmCard>
        <div hlmCardHeader>
          <h3 hlmCardTitle>Campaign Configuration</h3>
          <p hlmCardDescription>Select the template, dataset, and delivery configuration.</p>
        </div>
        <div hlmCardContent>
          <form class="space-y-6" (submit)="$event.preventDefault(); submitForm()">
            <!-- 1. Email Template -->
            <div>
              <label for="template-select" class="mb-1 block text-sm font-medium">Email Template *</label>
              <select appSelect
                id="template-select"
                data-testid="template-select"
                class="h-control-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                [value]="selectedTemplateId()"
                (change)="onTemplateChange($event)"
                required
              >
                <option value="" disabled selected>-- Select email template --</option>
                @for (tpl of templates(); track tpl.id) {
                  <option [value]="tpl.id">{{ tpl.name }} ({{ tpl.subject }})</option>
                }
              </select>
            </div>

            <!-- 2. Data Upload -->
            <div>
              <label for="upload-select" class="mb-1 block text-sm font-medium">Recipient Data Upload *</label>
              <select appSelect
                id="upload-select"
                data-testid="upload-select"
                class="h-control-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                [value]="selectedUploadId()"
                (change)="onUploadChange($event)"
                required
              >
                <option value="" disabled selected>-- Select data upload --</option>
                @for (upload of uploads(); track upload.id) {
                  <option [value]="upload.id">{{ upload.fileName }} ({{ upload.rowCount }} rows)</option>
                }
              </select>
            </div>

            <!-- Mapping Warning if Template + Upload chosen but no mapping -->
            @if (selectedTemplateId() && selectedUploadId() && checkingMapping()) {
              <p class="text-xs text-muted-foreground animate-pulse">Checking field mapping…</p>
            } @else if (selectedTemplateId() && selectedUploadId() && !hasMapping()) {
              <div data-testid="no-mapping-warning" class="rounded-md border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
                <span>No field mapping found for this template and upload combination. </span>
                <a
                  [href]="'/projects/' + projectId() + '/data'"
                  class="font-semibold underline hover:text-amber-950"
                  (click)="navigateToSection($event, 'data')"
                >
                  Configure mapping in Data tab &rarr;
                </a>
              </div>
            }

            <!-- 3. Recipient Email Column -->
            <div>
              <label for="email-column-select" class="mb-1 block text-sm font-medium">Recipient Email Column *</label>
              <select appSelect
                id="email-column-select"
                data-testid="email-column-select"
                class="h-control-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                [value]="selectedEmailColumn()"
                (change)="onEmailColumnChange($event)"
                [disabled]="!availableColumns().length"
                required
              >
                <option value="" disabled selected>-- Select column containing recipient emails --</option>
                @for (col of availableColumns(); track col) {
                  <option [value]="col">{{ col }}</option>
                }
              </select>
              <p class="mt-1 text-xs text-muted-foreground">Select the column in your upload that contains recipient email addresses.</p>
            </div>

            <!-- 4. SMTP Connection -->
            <div>
              <label for="smtp-select" class="mb-1 block text-sm font-medium">SMTP Delivery Connection *</label>
              <select appSelect
                id="smtp-select"
                data-testid="smtp-select"
                class="h-control-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                [value]="selectedSmtpId()"
                (change)="onSmtpChange($event)"
                required
              >
                <option value="" disabled selected>-- Select SMTP connection --</option>
                @for (smtp of smtpConnections(); track smtp.id) {
                  <option [value]="smtp.id">{{ smtp.host }}:{{ smtp.port }} ({{ smtp.username }})</option>
                }
              </select>
            </div>

            <!-- 5. Optional PDF Template -->
            <div>
              <label for="pdf-template-select" class="mb-1 block text-sm font-medium">
                PDF Payslip Template <span class="text-xs text-muted-foreground font-normal">(Optional)</span>
              </label>
              <select appSelect
                id="pdf-template-select"
                data-testid="pdf-template-select"
                class="h-control-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                [value]="selectedPdfTemplateId()"
                (change)="onPdfTemplateChange($event)"
              >
                <option value="">-- None (No PDF attachment generated) --</option>
                @for (pdf of pdfTemplates(); track pdf.id) {
                  <option [value]="pdf.id">{{ pdf.name }}</option>
                }
              </select>
            </div>

            <!-- Submit -->
            <div class="flex items-center justify-end gap-3 pt-4 border-t border-border">
              <button hlmBtn variant="outline" type="button" (click)="navigateBack()">Cancel</button>
              <button
                hlmBtn
                type="submit"
                data-testid="submit-create-campaign"
                [disabled]="isSubmitting() || !isFormValid()"
              >
                {{ isSubmitting() ? 'Creating…' : 'Create Campaign' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
    </app-drawer>
  `,
})
export class CampaignCreatePage implements OnInit {
  private readonly campaignsService = inject(CampaignsService);
  private readonly api = inject(ApiClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly projectId = signal<string>('');

  // Dropdown datasets
  readonly templates = signal<EmailTemplateSummary[]>([]);
  readonly pdfTemplates = signal<PdfTemplateSummary[]>([]);
  readonly uploads = signal<UploadSummary[]>([]);
  readonly smtpConnections = signal<SmtpConnectionSummary[]>([]);

  // Selected values
  readonly selectedTemplateId = signal<string>('');
  readonly selectedUploadId = signal<string>('');
  readonly selectedEmailColumn = signal<string>('');
  readonly selectedSmtpId = signal<string>('');
  readonly selectedPdfTemplateId = signal<string>('');

  readonly availableColumns = signal<string[]>([]);
  readonly hasMapping = signal<boolean>(false);
  readonly checkingMapping = signal<boolean>(false);

  readonly isSubmitting = signal<boolean>(false);
  readonly actionError = signal<string | null>(null);
  readonly invalidRows = signal<number[]>([]);
  readonly missingPrerequisites = signal<Array<{ label: string; tab: string }>>([]);

  ngOnInit(): void {
    const pid =
      this.route.snapshot.paramMap.get('projectId') ||
      this.route.parent?.snapshot.paramMap.get('projectId') ||
      '';
    this.projectId.set(pid);
    this.loadPrerequisites();
  }

  loadPrerequisites(): void {
    const pid = this.projectId();
    if (!pid) return;

    this.api.getPage<EmailTemplateSummary>(`/projects/${pid}/templates?page=1&limit=100&sortBy=createdAt&sortDir=desc`).subscribe({
      next: (page) => this.templates.set(page.data),
      error: () => {},
    });

    this.api.getPage<PdfTemplateSummary>(`/projects/${pid}/pdf-templates?page=1&limit=100&sortBy=createdAt&sortDir=desc`).subscribe({
      next: (page) => this.pdfTemplates.set(page.data),
      error: () => {},
    });

    this.api.get<UploadSummary[]>(`/projects/${pid}/uploads`).subscribe({
      next: (data) => this.uploads.set(data),
      error: () => {},
    });

    this.api.getPage<SmtpConnectionSummary>(`/projects/${pid}/smtp?page=1&limit=100&sortBy=createdAt&sortDir=desc`).subscribe({
      next: (page) => this.smtpConnections.set(page.data),
      error: () => {},
    });
  }

  onTemplateChange(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    this.selectedTemplateId.set(id);
    this.checkMappingIfExists();
  }

  onUploadChange(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    this.selectedUploadId.set(id);
    const found = this.uploads().find((u) => u.id === id);
    const cols = found?.columns ?? [];
    this.availableColumns.set(cols);

    // Auto-select 'email' column if it exists in columns
    const autoEmail = cols.find((c) => c.toLowerCase() === 'email' || c.toLowerCase().includes('email'));
    if (autoEmail) {
      this.selectedEmailColumn.set(autoEmail);
    } else if (cols.length > 0) {
      this.selectedEmailColumn.set(cols[0]);
    } else {
      this.selectedEmailColumn.set('');
    }

    this.checkMappingIfExists();
  }

  onEmailColumnChange(event: Event): void {
    this.selectedEmailColumn.set((event.target as HTMLSelectElement).value);
  }

  onSmtpChange(event: Event): void {
    this.selectedSmtpId.set((event.target as HTMLSelectElement).value);
  }

  onPdfTemplateChange(event: Event): void {
    this.selectedPdfTemplateId.set((event.target as HTMLSelectElement).value);
  }

  checkMappingIfExists(): void {
    const tplId = this.selectedTemplateId();
    const upId = this.selectedUploadId();
    const pid = this.projectId();
    if (!tplId || !upId || !pid) {
      this.hasMapping.set(false);
      return;
    }

    this.checkingMapping.set(true);
    this.api
      .get<FieldMappingSummary>(`/projects/${pid}/mappings?templateId=${encodeURIComponent(tplId)}&uploadId=${encodeURIComponent(upId)}`)
      .subscribe({
        next: () => {
          this.hasMapping.set(true);
          this.checkingMapping.set(false);
        },
        error: () => {
          this.hasMapping.set(false);
          this.checkingMapping.set(false);
        },
      });
  }

  isFormValid(): boolean {
    return (
      !!this.selectedTemplateId() &&
      !!this.selectedUploadId() &&
      !!this.selectedEmailColumn() &&
      !!this.selectedSmtpId()
    );
  }

  submitForm(): void {
    if (!this.isFormValid() || this.isSubmitting()) return;

    this.isSubmitting.set(true);
    this.actionError.set(null);
    this.invalidRows.set([]);

    const payload: CreateCampaignPayload = {
      emailTemplateId: this.selectedTemplateId(),
      uploadId: this.selectedUploadId(),
      emailColumn: this.selectedEmailColumn(),
      smtpConnectionId: this.selectedSmtpId(),
      ...(this.selectedPdfTemplateId() ? { pdfTemplateId: this.selectedPdfTemplateId() } : {}),
    };

    this.campaignsService.createCampaign(this.projectId(), payload).subscribe({
      next: (campaign) => {
        this.isSubmitting.set(false);
        this.router.navigate(['/projects', this.projectId(), 'campaigns', campaign.id]);
      },
      error: (error: unknown) => {
        this.isSubmitting.set(false);
        if (error instanceof ApiError) {
          if (error.code === 'INVALID_RECIPIENT_EMAIL') {
            this.actionError.set('Invalid recipient email format detected in upload file.');
          } else if (error.code === 'MAPPING_MISSING') {
            this.actionError.set('Field mapping is missing for this template and upload.');
          } else if (error.code === 'MAPPING_INVALID') {
            this.actionError.set('Field mapping does not resolve all required placeholders.');
          } else if (error.code === 'INVALID_EMAIL_COLUMN') {
            this.actionError.set(`Selected email column is not present in the upload file.`);
          } else {
            this.actionError.set(error.message || 'Failed to create campaign.');
          }
        } else {
          this.actionError.set('Failed to create campaign. Check your connection.');
        }
      },
    });
  }

  navigateToSection(event: Event, section: string): void {
    event.preventDefault();
    this.router.navigate(['/projects', this.projectId(), section]);
  }

  navigateBack(): void {
    this.router.navigate(['/projects', this.projectId(), 'campaigns']);
  }
}
