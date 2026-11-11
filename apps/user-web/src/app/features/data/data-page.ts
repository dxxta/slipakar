import { CommonModule } from '@angular/common';
import { SelectControl } from '../../ui/shared/select-control';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCloudUpload } from '@ng-icons/tabler-icons';
import { PLACEHOLDER_REGEX } from '@slipakar/shared';
import { ApiError } from '../../core/api-error';
import { EmbedSessionService } from '../../core/embed-session.service';
import { HlmAlert, HlmAlertDescription, HlmAlertTitle } from '../../ui/alert/src';
import { HlmBadge } from '../../ui/badge/src';
import { HlmButton } from '../../ui/button/src';
import { HlmCard, HlmCardContent, HlmCardDescription, HlmCardHeader, HlmCardTitle } from '../../ui/card/src';
import { Drawer } from '../../ui/shared/drawer';
import { ConfirmModal } from '../../ui/shared/confirm-modal';
import { DataTableControls } from '../../ui/shared/data-table-controls';
import { ListBody } from '../../ui/shared/list-body';
import { PageHeader } from '../../ui/shared/page-header';
import { RowActions, type RowActionItem } from '../../ui/shared/row-actions';
import { Pagination } from '../../ui/shared/pagination';
import {
  DataService,
  type EmailTemplateSummary,
  type PdfTemplateSummary,
  type UploadItem,
  type UploadPreview,
} from './data.service';
import { Ripple } from '../../ui/shared/ripple';

function extractPlaceholders(text: string): string[] {
  if (!text) return [];
  const regex = new RegExp(PLACEHOLDER_REGEX.source, PLACEHOLDER_REGEX.flags);
  return [...new Set([...text.matchAll(regex)].map((m) => m[1]))];
}

@Component({
  selector: 'app-data-page',
  imports: [Ripple, 
    SelectControl,
    CommonModule,
    HlmButton,
    HlmCard,
    HlmCardHeader,
    HlmCardTitle,
    HlmCardDescription,
    HlmCardContent,
    DataTableControls,
    ListBody,
    PageHeader,
    RowActions,
    Pagination,
    Drawer,
    ConfirmModal,
    HlmBadge,
    HlmAlert,
    HlmAlertTitle,
    HlmAlertDescription,
    NgIcon,
  ],
  providers: [provideIcons({ tablerCloudUpload })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="app-list-layout">
      <app-page-header title="Data & Mapping" description="Upload recipient data files (CSV, XLSX, JSON) and map columns to email template placeholders." [topLevel]="false" />

      @if (actionError()) {
        <div aria-live="polite" role="alert">
          <div hlmAlert variant="destructive">
            <h4 hlmAlertTitle>Error</h4>
            <p hlmAlertDescription>{{ actionError() }}</p>
          </div>
        </div>
      }

      @if (actionSuccess()) {
        <div aria-live="polite" role="status">
          <div hlmAlert class="border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200">
            <h4 hlmAlertTitle class="text-emerald-800 dark:text-emerald-200">Success</h4>
            <p hlmAlertDescription class="text-emerald-700 dark:text-emerald-300">{{ actionSuccess() }}</p>
          </div>
        </div>
      }

      <!-- STEP 1: Upload & Uploaded Files List -->
      <section class="space-y-4" aria-labelledby="step-upload-heading">
        <h3 id="step-upload-heading" class="text-lg font-medium flex items-center gap-2">
          <span class="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</span>
          Upload Recipient Data
        </h3>

        <!-- Drag & Drop / File Picker Area -->
        @if (canUpload()) {
          <div
            data-testid="file-dropzone"
            tabindex="0"
            role="button"
            aria-label="Upload recipient data file. Drop a file here or press Enter to browse"
            class="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            [class.border-primary]="isDragging()"
            [class.bg-primary/5]="isDragging()"
            (dragover)="onDragOver($event)"
            (dragleave)="onDragLeave($event)"
            (drop)="onFileDrop($event)"
            (keydown.enter)="fileInput.click()"
            (keydown.space)="$event.preventDefault(); fileInput.click()"
          >
            <ng-icon name="tablerCloudUpload" class="h-10 w-10 text-muted-foreground mb-3" aria-hidden="true" />
            <p class="text-sm font-medium">Drag and drop your data file here, or click to browse</p>
            <p class="mt-1 text-xs text-muted-foreground">Supported formats: CSV, XLSX, JSON (Max 50MB)</p>
            <input
              #fileInput
              data-testid="file-input"
              aria-label="Upload recipient data file"
              type="file"
              accept=".csv, .xlsx, .json, text/csv, application/json, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              class="hidden"
              (change)="onFileInputChange($event)"
            />
            <button
              hlmBtn
              variant="outline"
              size="sm"
              type="button"
              class="mt-4"
              [disabled]="isUploading()"
              (click)="$event.stopPropagation(); fileInput.click()"
            >
              {{ isUploading() ? 'Uploading…' : 'Choose file' }}
            </button>
          </div>
        } @else {
          <p class="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground" role="status">This embedded view is read-only. Upload permission was not granted.</p>
        }

        @if (uploadError()) {
          <div aria-live="polite" role="alert">
            <div hlmAlert variant="destructive">
              <h4 hlmAlertTitle>Upload failed</h4>
              <p hlmAlertDescription>{{ uploadError() }}</p>
            </div>
          </div>
        }

        <!-- Uploaded Files List -->
        <app-data-table-controls [query]="uploadQuery()" searchPlaceholder="Search uploaded files..." (queryChange)="setUploadQuery($event)" />
        <app-list-body [state]="loadingUploads() ? 'loading' : loadUploadsError() ? 'error' : 'ready'" [itemCount]="filteredUploads().length" [query]="uploadQuery()" errorTitle="Failed to load uploaded files" [errorMessage]="loadUploadsError() ?? ''" emptyTitle="No uploaded data files yet" emptyMessage="Upload a CSV, XLSX, or JSON file above to begin." emptyResultLabel="No uploads match" (retry)="loadUploads()" (clearQuery)="setUploadQuery('')">
          <div list-content class="overflow-x-auto rounded-lg border border-border">
            <table data-responsive class="min-w-[40rem] w-full text-left text-sm" aria-label="Uploaded data files">
              <thead class="border-b border-border bg-muted/50 text-xs font-medium text-muted-foreground">
                <tr>
                  <th scope="col" class="px-4 py-3">Select</th>
                  <th scope="col" class="px-4 py-3">File Name</th>
                  <th scope="col" class="px-4 py-3">Rows</th>
                  <th scope="col" class="px-4 py-3">Columns</th>
                  <th scope="col" class="px-4 py-3">Uploaded</th>
                  <th scope="col" class="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border">
                @for (file of pageUploads(); track file.id) {
                  <tr
                    [attr.data-testid]="'upload-row-' + file.id"
                    tabindex="0"
                    [attr.aria-selected]="selectedUploadId() === file.id"
                    class="transition-colors hover:bg-muted/30 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    [class.bg-primary/5]="selectedUploadId() === file.id"
                    (click)="selectUpload(file.id)"
                    (keydown.enter)="selectUpload(file.id)"
                    (keydown.space)="$event.preventDefault(); selectUpload(file.id)"
                  >
                    <td data-label="Select" class="align-middle px-4 py-3">
                      <input type="checkbox" [checked]="selectedUploadId() === file.id" [attr.aria-label]="'Select ' + file.fileName" class="size-4 accent-primary" (click)="$event.stopPropagation()" (change)="onUploadCheckboxChange(file.id, $event)" />
                    </td>
                    <td data-main data-label="File Name" class="align-middle px-4 py-3"><div class="flex min-h-9 items-center gap-2 font-medium"><span class="truncate">{{ file.fileName }}</span>@if (selectedUploadId() === file.id) { <span hlmBadge variant="outline" class="shrink-0 text-[10px]">Active</span> }</div></td>
                    <td data-label="Rows" class="align-middle px-4 py-3 text-muted-foreground tabular-nums">{{ file.rowCount.toLocaleString() }}</td>
                    <td data-label="Columns" class="align-middle px-4 py-3 text-muted-foreground text-xs font-mono tabular-nums">{{ file.columns.length }} cols</td>
                    <td data-label="Uploaded" class="align-middle px-4 py-3 text-muted-foreground text-xs tabular-nums">{{ file.createdAt | date: 'short' }}</td>
                    <td data-label="Actions" class="align-middle px-4 py-2 text-right" (click)="$event.stopPropagation()" (keydown)="$event.stopPropagation()">
                      <app-row-actions [attr.data-testid]="'upload-actions-' + file.id" [label]="'Actions for ' + file.fileName" [items]="uploadActions()" (actionSelect)="handleUploadAction($event, file)" />
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </app-list-body>
        <app-pagination [metadata]="uploadMetadata()" (pageChange)="uploadPage.set($event)" />
        <app-drawer [open]="detailUpload() !== null" title="Uploaded file details" (closed)="detailUpload.set(null)">
          @if (detailUpload(); as file) {
            <dl class="space-y-4">
              <div><dt class="text-xs font-medium text-muted-foreground">File name</dt><dd class="mt-1 font-medium break-all">{{ file.fileName }}</dd></div>
              <div><dt class="text-xs font-medium text-muted-foreground">Rows</dt><dd class="mt-1">{{ file.rowCount.toLocaleString() }}</dd></div>
              <div><dt class="text-xs font-medium text-muted-foreground">Columns</dt><dd class="mt-1 flex flex-wrap gap-2">@for (column of file.columns; track column) { <span hlmBadge variant="outline">{{ column }}</span> }</dd></div>
              <div><dt class="text-xs font-medium text-muted-foreground">Uploaded</dt><dd class="mt-1">{{ file.createdAt | date: 'medium' }}</dd></div>
            </dl>
          }
        </app-drawer>
      </section>

      <!-- STEP 2: Preview -->
      <section class="space-y-4" aria-labelledby="step-preview-heading">
        <div class="flex items-center justify-between">
          <h3 id="step-preview-heading" class="text-lg font-medium flex items-center gap-2">
            <span class="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">2</span>
            Data Preview
          </h3>
          @if (currentPreview()) {
            <span class="text-xs text-muted-foreground font-mono">
              Showing first {{ currentPreview()?.preview?.length }} rows of {{ currentPreview()?.rowCount }}
            </span>
          }
        </div>

        @if (!selectedUploadId()) {
          <div data-testid="preview-empty-state" class="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground" role="status">
            Select an uploaded file above to view its columns and sample rows.
          </div>
        } @else if (loadingPreview()) {
          <div data-testid="preview-loading-skeleton" class="space-y-2" role="status" aria-busy="true">
            <div class="h-10 animate-pulse rounded-lg bg-muted"></div>
            <div class="h-32 animate-pulse rounded-lg bg-muted"></div>
          </div>
        } @else if (loadPreviewError()) {
          <div data-testid="preview-error-state" class="flex flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center" role="alert" aria-live="polite">
            <p class="text-sm font-medium text-destructive mb-1">Failed to load preview</p>
            <p class="text-xs text-muted-foreground mb-3">{{ loadPreviewError() }}</p>
            <button hlmBtn variant="outline" size="sm" (click)="loadPreview(selectedUploadId()!)">Retry</button>
          </div>
        } @else if (currentPreview()) {
          <div data-testid="preview-table-container" class="relative max-h-80 overflow-auto rounded-lg border border-border">
            <table class="w-full text-left text-xs" aria-label="Data preview table">
              <thead class="sticky top-0 z-10 border-b border-border bg-muted text-muted-foreground">
                <tr>
                  <th scope="col" class="px-3 py-2 font-mono">#</th>
                  @for (col of currentPreview()!.columns; track col) {
                    <th scope="col" class="px-3 py-2 font-semibold whitespace-nowrap">{{ col }}</th>
                  }
                </tr>
              </thead>
              <tbody class="divide-y divide-border bg-background">
                @for (row of currentPreview()!.preview; track $index) {
                  <tr class="hover:bg-muted/30">
                    <td class="px-3 py-2 font-mono text-muted-foreground">{{ $index + 1 }}</td>
                    @for (col of currentPreview()!.columns; track col) {
                      <td class="px-3 py-2 whitespace-nowrap font-mono max-w-xs truncate">{{ row[col] ?? '' }}</td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>

      <!-- STEP 3: Field Mapping -->
      <section class="space-y-4" aria-labelledby="step-mapping-heading">
        <h3 id="step-mapping-heading" class="text-lg font-medium flex items-center gap-2">
          <span class="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">3</span>
          Field Mapping
        </h3>

        <div hlmCard data-testid="mapping-card">
          <div hlmCardHeader>
            <h4 hlmCardTitle class="text-base font-semibold">Map Placeholders to Data Columns</h4>
            <p hlmCardDescription>
              Select an email template (and optional PDF template), then map each placeholder to a column in your selected data file.
            </p>
          </div>
          <div hlmCardContent class="space-y-6">
            <!-- Template Selectors -->
            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <label for="template-select" class="mb-1 block text-sm font-medium">Email Template</label>
                <select appSelect
                  id="template-select"
                  data-testid="template-select"
                  class="h-control-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  [value]="selectedTemplateId()"
                  (change)="onTemplateSelect($any($event.target).value)"
                >
                  <option value="">-- Choose Email Template --</option>
                  @for (tpl of templates(); track tpl.id) {
                    <option [value]="tpl.id">{{ tpl.name }}</option>
                  }
                </select>
              </div>

              <div>
                <label for="pdf-template-select" class="mb-1 block text-sm font-medium">PDF Template (Optional)</label>
                <select appSelect
                  id="pdf-template-select"
                  data-testid="pdf-template-select"
                  class="h-control-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  [value]="selectedPdfTemplateId()"
                  (change)="selectedPdfTemplateId.set($any($event.target).value)"
                >
                  <option value="">-- None (No PDF Attachment) --</option>
                  @for (ptpl of pdfTemplates(); track ptpl.id) {
                    <option [value]="ptpl.id">{{ ptpl.name }}</option>
                  }
                </select>
              </div>
            </div>

            <!-- Recipient Email Column Selector -->
            @if (detectedColumns().length) {
              <div>
                <label for="email-column-select" class="mb-1 block text-sm font-medium">
                  Recipient Email Column <span class="text-destructive">*</span>
                </label>
                <select appSelect
                  id="email-column-select"
                  data-testid="email-column-select"
                  class="h-control-9 w-full max-w-sm rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  [value]="recipientEmailColumn()"
                  (change)="recipientEmailColumn.set($any($event.target).value)"
                  required
                >
                  <option value="">-- Select column with recipient email --</option>
                  @for (col of detectedColumns(); track col) {
                    <option [value]="col">{{ col }}</option>
                  }
                </select>
                <p class="mt-1 text-xs text-muted-foreground">This column will supply the destination email address for campaigns.</p>
              </div>
            }

            @if (!selectedUploadId() || !selectedTemplateId()) {
              <div data-testid="mapping-instructions" class="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground" role="status">
                Please select both an uploaded data file (Step 1) and an email template above to configure field mappings.
              </div>
            } @else if (templatePlaceholders().length === 0) {
              <div class="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground" role="status">
                No placeholders found in the selected email template.
              </div>
            } @else {
              <!-- Unmapped Placeholders Warning -->
              @if (unmappedPlaceholders().length > 0) {
                <div aria-live="polite" role="alert">
                  <div hlmAlert variant="destructive">
                    <h4 hlmAlertTitle>Unmapped Placeholders ({{ unmappedPlaceholders().length }})</h4>
                    <p hlmAlertDescription>
                      The following placeholders are not mapped yet:
                      <span class="font-mono font-medium">{{ unmappedPlaceholders().join(', ') }}</span>.
                      All placeholders must be mapped before saving.
                    </p>
                  </div>
                </div>
              }

              <!-- Placeholders Mapping Table -->
              <div class="space-y-3">
                <div class="flex items-center justify-between">
                  <h5 class="text-sm font-semibold">Placeholder Mappings</h5>
                  @if (canWriteMapping()) {
                    <button
                      hlmBtn
                      variant="ghost"
                      size="sm"
                      type="button"
                      data-testid="auto-suggest-button"
                      (click)="autoSuggestMappings()"
                    >
                      Auto-suggest matches
                    </button>
                  }
                </div>

                <div class="overflow-x-auto rounded-lg border border-border">
                  <table data-responsive class="min-w-[32rem] w-full text-left text-sm" aria-label="Field mappings table">
                    <thead class="border-b border-border bg-muted/50 text-xs font-medium text-muted-foreground">
                      <tr>
                        <th scope="col" class="px-4 py-2.5">Placeholder</th>
                        <th scope="col" class="px-4 py-2.5">Mapped Data Column</th>
                        <th scope="col" class="px-4 py-2.5 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-border">
                      @for (p of templatePlaceholders(); track p) {
                        <tr class="hover:bg-muted/30">
                          <td data-label="Placeholder" class="px-4 py-2.5 font-mono text-xs font-medium">
                            {{ '{{' + p + '}}' }}
                          </td>
                          <td data-label="Mapped Data Column" class="px-4 py-2.5">
                            <select appSelect
                              [attr.aria-label]="'Map placeholder ' + p"
                              [attr.data-testid]="'mapping-select-' + p"
                              class="h-8 w-full max-w-xs rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              [value]="currentMapping()[p] ?? ''"
                              [disabled]="!canWriteMapping()"
                              (change)="onMappingChange(p, $any($event.target).value)"
                            >
                              <option value="">-- Choose column --</option>
                              @for (col of detectedColumns(); track col) {
                                <option [value]="col">{{ col }}</option>
                              }
                            </select>
                          </td>
                          <td data-aside data-label="Status" class="px-4 py-2.5 text-right">
                            @if (currentMapping()[p]) {
                              <span hlmBadge variant="outline" class="text-[10px] text-emerald-700 dark:text-emerald-300 border-emerald-500/25 bg-emerald-500/10">Mapped</span>
                            } @else {
                              <span hlmBadge variant="outline" class="text-[10px] text-amber-700 dark:text-amber-300 border-amber-500/25 bg-amber-500/10">Required</span>
                            }
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- Save Mapping Action -->
              @if (canWriteMapping()) {
                <div class="flex items-center justify-between pt-4 border-t">
                  <div class="text-xs text-muted-foreground">
                    @if (!isMappingComplete()) {
                      <span class="text-destructive font-medium">
                        All placeholders and recipient email column must be assigned to save.
                      </span>
                    } @else {
                      <span class="text-green-700 dark:text-green-300 font-medium">
                        Ready to save mapping.
                      </span>
                    }
                  </div>
                  <button
                    hlmBtn
                    type="button"
                    data-testid="save-mapping-button"
                    [disabled]="!isMappingComplete() || isSavingMapping()"
                    (click)="saveMapping()"
                  >
                    {{ isSavingMapping() ? 'Saving…' : 'Save mapping' }}
                  </button>
                </div>
              }
            }
          </div>
        </div>
      </section>
    </div>
    <app-confirm-modal
      [open]="pendingDelete() !== null"
      [title]="'Delete ' + (pendingDelete()?.fileName ?? 'this item') + '?'"
      message="This uploaded file will be permanently removed."
      confirmLabel="Delete upload"
      [confirmTestId]="'confirm-delete-upload-' + (pendingDelete()?.id ?? '')"
      (cancelled)="confirmingDeleteId.set(null)"
      (confirmed)="pendingDelete() && deleteUpload(pendingDelete()!.id)"
    />
  `,
})
export class DataPage implements OnInit {
  private readonly dataService = inject(DataService);
  private readonly route = inject(ActivatedRoute);
  private readonly embed = inject(EmbedSessionService);

  readonly canUpload = computed(() => !this.embed.isEmbedMode() || this.embed.hasScope('uploads:write'));
  readonly canWriteMapping = computed(() => !this.embed.isEmbedMode() || this.embed.hasScope('mappings:write'));

  projectId = '';

  // Upload list & preview state
  readonly uploads = signal<UploadItem[]>([]);
  readonly uploadQuery = signal('');
  readonly uploadPage = signal(1);
  readonly detailUpload = signal<UploadItem | null>(null);
  readonly filteredUploads = computed(() => {
    const query = this.uploadQuery().trim().toLocaleLowerCase();
    return this.uploads().filter((upload) => upload.fileName.toLocaleLowerCase().includes(query));
  });
  readonly pageUploads = computed(() => {
    const start = (this.uploadPage() - 1) * 5;
    return this.filteredUploads().slice(start, start + 5);
  });
  readonly uploadMetadata = computed(() => ({ page: this.uploadPage(), limit: 5, total: this.filteredUploads().length }));
  readonly uploadActions = computed<RowActionItem[]>(() => [
    { id: 'detail', label: 'Detail', icon: 'eye' },
    ...(this.canUpload() ? [{ id: 'delete', label: 'Delete', icon: 'trash', destructive: true } as RowActionItem] : []),
  ]);
  readonly loadingUploads = signal(true);
  readonly loadUploadsError = signal<string | null>(null);

  readonly selectedUploadId = signal<string | null>(null);
  readonly currentPreview = signal<UploadPreview | null>(null);
  readonly loadingPreview = signal(false);
  readonly loadPreviewError = signal<string | null>(null);

  readonly isUploading = signal(false);
  readonly uploadError = signal<string | null>(null);
  readonly isDragging = signal(false);

  readonly isDeletingUploadId = signal<string | null>(null);
  readonly confirmingDeleteId = signal<string | null>(null);
  protected readonly pendingDelete = computed(() => this.uploads().find((upload) => upload.id === this.confirmingDeleteId()) ?? null);

  handleUploadAction(action: RowActionItem, upload: UploadItem): void {
    if (action.id === 'detail') this.detailUpload.set(upload);
    else if (action.id === 'delete') this.confirmingDeleteId.set(upload.id);
  }

  // Template lists & mapping state
  readonly templates = signal<EmailTemplateSummary[]>([]);
  readonly pdfTemplates = signal<PdfTemplateSummary[]>([]);
  readonly selectedTemplateId = signal('');
  readonly selectedPdfTemplateId = signal('');
  readonly recipientEmailColumn = signal('');

  readonly currentMapping = signal<Record<string, string>>({});
  readonly isSavingMapping = signal(false);

  readonly actionError = signal<string | null>(null);
  readonly actionSuccess = signal<string | null>(null);

  // Computed columns from active upload
  readonly detectedColumns = computed(() => {
    const preview = this.currentPreview();
    if (preview) return preview.columns;
    const upload = this.uploads().find((u) => u.id === this.selectedUploadId());
    return upload ? upload.columns : [];
  });

  // Computed placeholders in selected email template
  readonly templatePlaceholders = computed(() => {
    const tid = this.selectedTemplateId();
    if (!tid) return [];
    const tpl = this.templates().find((t) => t.id === tid);
    if (!tpl) return [];
    return extractPlaceholders(`${tpl.subject} ${tpl.bodyHtml}`);
  });

  // Computed unmapped placeholders
  readonly unmappedPlaceholders = computed(() => {
    const placeholders = this.templatePlaceholders();
    const map = this.currentMapping();
    return placeholders.filter((p) => !map[p]);
  });

  // Is complete condition: emailColumn set + every placeholder mapped
  readonly isMappingComplete = computed(() => {
    if (!this.selectedUploadId() || !this.selectedTemplateId()) return false;
    if (!this.recipientEmailColumn().trim()) return false;
    const unmapped = this.unmappedPlaceholders();
    return unmapped.length === 0;
  });

  ngOnInit(): void {
    this.projectId = this.resolveProjectId();
    if (this.projectId) {
      this.loadUploads();
      this.loadTemplates();
      this.loadPdfTemplates();
    }
  }

  private resolveProjectId(): string {
    let current: ActivatedRoute | null = this.route;
    while (current) {
      const pid = current.snapshot.paramMap.get('projectId');
      if (pid) return pid;
      current = current.parent;
    }
    return '';
  }

  loadUploads(): void {
    this.loadingUploads.set(true);
    this.loadUploadsError.set(null);
    this.dataService.listUploads(this.projectId).subscribe({
      next: (list) => {
        this.uploads.set(list);
        this.loadingUploads.set(false);
        if (list.length > 0 && (!this.selectedUploadId() || !list.some((item) => item.id === this.selectedUploadId()))) {
          this.selectUpload(list[0].id);
        }
      },
      error: (err: unknown) => {
        this.loadingUploads.set(false);
        this.loadUploadsError.set(err instanceof ApiError ? err.message : 'Could not load uploads');
      },
    });
  }

  loadTemplates(): void {
    this.dataService.listTemplates(this.projectId).subscribe({
      next: (list) => this.templates.set(list),
      error: () => {},
    });
  }

  loadPdfTemplates(): void {
    this.dataService.listPdfTemplates(this.projectId).subscribe({
      next: (list) => this.pdfTemplates.set(list),
      error: () => {},
    });
  }

  onUploadCheckboxChange(id: string, event: Event): void {
    if (id === this.selectedUploadId()) {
      (event.currentTarget as HTMLInputElement).checked = true;
      return;
    }
    this.selectUpload(id);
  }

  selectUpload(id: string): void {
    if (id === this.selectedUploadId()) return;
    this.selectedUploadId.set(id);
    this.loadPreview(id);
    this.checkExistingMapping();
  }

  setUploadQuery(query: string): void {
    this.uploadQuery.set(query);
    this.uploadPage.set(1);
  }

  loadPreview(id: string): void {
    this.loadingPreview.set(true);
    this.loadPreviewError.set(null);
    this.dataService.getUploadPreview(this.projectId, id).subscribe({
      next: (preview) => {
        this.currentPreview.set(preview);
        this.loadingPreview.set(false);
        // Auto-select email column if an obvious "email" column exists and none selected
        if (!this.recipientEmailColumn() && preview.columns.length) {
          const match = preview.columns.find((c) => /email/i.test(c));
          if (match) this.recipientEmailColumn.set(match);
        }
      },
      error: (err: unknown) => {
        this.loadingPreview.set(false);
        this.loadPreviewError.set(err instanceof ApiError ? err.message : 'Could not load preview');
      },
    });
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.handleFile(input.files[0]);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
  }

  onFileDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
    if (event.dataTransfer?.files && event.dataTransfer.files[0]) {
      this.handleFile(event.dataTransfer.files[0]);
    }
  }

  private handleFile(file: File): void {
    if (!this.canUpload()) return;
    this.uploadError.set(null);
    this.actionError.set(null);
    this.actionSuccess.set(null);

    // Client-side extension validation
    const validExtensions = ['.csv', '.xlsx', '.json'];
    const lowerName = file.name.toLowerCase();
    const hasValidExt = validExtensions.some((ext) => lowerName.endsWith(ext));
    if (!hasValidExt) {
      this.uploadError.set('Unsupported file format. Please upload a .csv, .xlsx, or .json file.');
      return;
    }

    // Client-side size check: 50MB
    if (file.size > 52_428_800) {
      this.uploadError.set('File exceeds maximum size of 50MB.');
      return;
    }

    this.isUploading.set(true);
    this.dataService.uploadFile(this.projectId, file).subscribe({
      next: (uploaded) => {
        this.isUploading.set(false);
        this.uploads.update((list) => [uploaded, ...list]);
        this.selectUpload(uploaded.id);
        this.actionSuccess.set(`Successfully uploaded and parsed "${file.name}"`);
      },
      error: (err: unknown) => {
        this.isUploading.set(false);
        const msg = err instanceof ApiError ? err.message : 'Upload failed';
        this.uploadError.set(msg);
      },
    });
  }

  deleteUpload(id: string): void {
    if (!this.canUpload()) return;
    this.actionError.set(null);
    this.actionSuccess.set(null);
    this.isDeletingUploadId.set(id);
    this.dataService.deleteUpload(this.projectId, id).subscribe({
      next: () => {
        this.isDeletingUploadId.set(null);
        this.confirmingDeleteId.set(null);
        this.uploads.update((list) => list.filter((u) => u.id !== id));
        if (this.selectedUploadId() === id) {
          const remaining = this.uploads();
          if (remaining.length) {
            this.selectUpload(remaining[0].id);
          } else {
            this.selectedUploadId.set(null);
            this.currentPreview.set(null);
          }
        }
        this.actionSuccess.set('Uploaded file deleted successfully');
      },
      error: (err: unknown) => {
        this.isDeletingUploadId.set(null);
        this.confirmingDeleteId.set(null);
        this.actionError.set(err instanceof ApiError ? err.message : 'Failed to delete upload');
      },
    });
  }

  onTemplateSelect(templateId: string): void {
    this.selectedTemplateId.set(templateId);
    this.checkExistingMapping();
  }

  private checkExistingMapping(): void {
    const uploadId = this.selectedUploadId();
    const templateId = this.selectedTemplateId();
    if (!uploadId || !templateId) return;

    this.dataService.getMapping(this.projectId, templateId, uploadId).subscribe({
      next: (mappingObj) => {
        if (mappingObj && mappingObj.mapping) {
          this.currentMapping.set(mappingObj.mapping);
        }
        if (mappingObj.pdfTemplateId) {
          this.selectedPdfTemplateId.set(mappingObj.pdfTemplateId);
        }
      },
      error: () => {
        // No existing mapping yet, trigger autoSuggestMappings
        this.autoSuggestMappings();
      },
    });
  }

  autoSuggestMappings(): void {
    if (!this.canWriteMapping()) return;
    const columns = this.detectedColumns();
    const placeholders = this.templatePlaceholders();
    const nextMapping: Record<string, string> = { ...this.currentMapping() };

    for (const p of placeholders) {
      if (!nextMapping[p]) {
        // Case-insensitive match or match after removing underscore/spaces
        const matchedCol = columns.find(
          (c) => c.toLowerCase() === p.toLowerCase() || c.toLowerCase().replace(/[\s_-]+/g, '') === p.toLowerCase().replace(/[\s_-]+/g, ''),
        );
        if (matchedCol) {
          nextMapping[p] = matchedCol;
        }
      }
    }
    this.currentMapping.set(nextMapping);

    // Auto-suggest recipient email column if not set
    if (!this.recipientEmailColumn() && columns.length) {
      const emailCol = columns.find((c) => /email/i.test(c));
      if (emailCol) this.recipientEmailColumn.set(emailCol);
    }
  }

  onMappingChange(placeholder: string, column: string): void {
    if (!this.canWriteMapping()) return;
    this.currentMapping.update((map) => ({
      ...map,
      [placeholder]: column,
    }));
  }

  saveMapping(): void {
    if (!this.canWriteMapping()) return;
    const uploadId = this.selectedUploadId();
    const templateId = this.selectedTemplateId();
    if (!uploadId || !templateId || !this.isMappingComplete()) return;

    this.actionError.set(null);
    this.actionSuccess.set(null);
    this.isSavingMapping.set(true);

    const payload = {
      templateId,
      uploadId,
      pdfTemplateId: this.selectedPdfTemplateId() || undefined,
      mapping: this.currentMapping(),
    };

    this.dataService.saveMapping(this.projectId, payload).subscribe({
      next: () => {
        this.isSavingMapping.set(false);
        this.actionSuccess.set('Field mapping saved successfully');
      },
      error: (err: unknown) => {
        this.isSavingMapping.set(false);
        const msg = err instanceof ApiError ? err.message : 'Failed to save mapping';
        this.actionError.set(msg);
      },
    });
  }
}
