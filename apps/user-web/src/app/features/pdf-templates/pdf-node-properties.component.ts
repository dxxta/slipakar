import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SelectControl } from '../../ui/shared/select-control';
import { FormsModule } from '@angular/forms';
import { HlmButton } from '../../ui/button/src';
import { HlmBadge } from '../../ui/badge/src';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCopy, tablerTrash } from '@ng-icons/tabler-icons';
import {
  type PdfDividerNode,
  type PdfImageNode,
  type PdfNode,
  type PdfSheetNode,
  PDF_NODE_LIMITS,
  type PdfNodeValidationError,
  type PdfTableNode,
  type PdfTextNode,
} from '../pdf-builder/pdf-node.types';
import type { AttachmentItem } from './pdf-templates.service';
import { Ripple } from '../../ui/shared/ripple';
import { Pressed } from '../../ui/shared/pressed';

@Component({
  selector: 'app-pdf-node-properties',
  imports: [Ripple, Pressed,
    SelectControl,CommonModule, FormsModule, HlmButton, HlmBadge, NgIcon],
  providers: [provideIcons({ tablerCopy, tablerTrash })],
  template: `
    <div class="space-y-5 p-4 text-sm" data-testid="node-properties-panel">
      @if (!node) {
        <div class="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground" data-testid="no-node-selected">
          <p class="font-medium">No node selected</p>
          <p class="mt-1 text-xs">Click on any node in the canvas to inspect and edit its properties.</p>
        </div>
      } @else {
        <!-- Header: Node Type & Actions -->
        <div class="flex items-center justify-between gap-2 border-b border-border pb-3">
          <div class="flex min-w-0 items-center gap-2">
            <span hlmBadge variant="outline" class="shrink-0 font-mono text-xs uppercase">
              {{ node.type }}
            </span>
            <span class="truncate font-mono text-xs text-muted-foreground" [attr.title]="node.id">
              {{ node.id }}
            </span>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <button
              appPressed
              type="button"
              class="grid size-9 place-items-center rounded-ui-md bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-testid="duplicate-node-button"
              title="Duplicate node"
              aria-label="Duplicate node"
              (click)="duplicate.emit(node.id)"
            >
              <ng-icon name="tablerCopy" aria-hidden="true" class="size-5" />
            </button>
            <button
              appPressed
              type="button"
              class="grid size-9 place-items-center rounded-ui-md bg-destructive text-white hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-testid="delete-node-button"
              title="Delete node"
              aria-label="Delete node"
              (click)="delete.emit(node.id)"
            >
              <ng-icon name="tablerTrash" aria-hidden="true" class="size-5" />
            </button>
          </div>
        </div>

        <!-- Node Validation Errors -->
        @if (nodeErrors.length > 0) {
          <div
            data-testid="node-validation-errors"
            role="alert"
            class="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive space-y-1"
          >
            <p class="font-semibold">Validation issues:</p>
            <ul class="list-disc pl-4 space-y-0.5">
              @for (err of nodeErrors; track err.field + err.message) {
                <li>
                  <span class="font-mono font-medium">{{ err.field }}:</span> {{ err.message }}
                </li>
              }
            </ul>
          </div>
        }

        <!-- Geometry Form: x, y, width, height -->
        <div class="space-y-3" data-testid="geometry-section">
          <h4 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Geometry (points)</h4>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label [for]="'geom-x-' + node.id" class="mb-1 block text-xs font-medium">X</label>
              <input
                type="number"
                [id]="'geom-x-' + node.id"
                data-testid="geom-x"
                class="h-8 w-full rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="0"
                [min]="limits.coordinate.min"
                [max]="limits.coordinate.max"
                [ngModel]="node.x"
                (ngModelChange)="onPatch({ x: parseNumber($event) })"
              />
            </div>
            <div>
              <label [for]="'geom-y-' + node.id" class="mb-1 block text-xs font-medium">Y</label>
              <input
                type="number"
                [id]="'geom-y-' + node.id"
                data-testid="geom-y"
                class="h-8 w-full rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="0"
                [min]="limits.coordinate.min"
                [max]="limits.coordinate.max"
                [ngModel]="node.y"
                (ngModelChange)="onPatch({ y: parseNumber($event) })"
              />
            </div>
            <div>
              <label [for]="'geom-width-' + node.id" class="mb-1 block text-xs font-medium">Width</label>
              <input
                type="number"
                [id]="'geom-width-' + node.id"
                data-testid="geom-width"
                class="h-8 w-full rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="0"
                [min]="limits.dimension.min"
                [max]="limits.dimension.max"
                [ngModel]="node.width"
                (ngModelChange)="onPatch({ width: parseNumber($event) })"
              />
            </div>
            <div>
              <label [for]="'geom-height-' + node.id" class="mb-1 block text-xs font-medium">Height</label>
              <input
                type="number"
                [id]="'geom-height-' + node.id"
                data-testid="geom-height"
                class="h-8 w-full rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="0"
                [min]="limits.dimension.min"
                [max]="limits.dimension.max"
                [ngModel]="node.height"
                (ngModelChange)="onPatch({ height: parseNumber($event) })"
              />
            </div>
          </div>
        </div>

        <!-- Node Type Specific Controls -->

        <!-- TEXT NODE -->
        @if (node.type === 'text') {
          <div class="space-y-4 border-t border-border pt-4" data-testid="text-node-properties">
            <h4 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Text Properties</h4>

            <!-- Content textarea + Placeholder chips -->
            <div class="space-y-1.5">
              <label [for]="'text-content-' + node.id" class="block text-xs font-medium">
                Content
              </label>
              <textarea
                [id]="'text-content-' + node.id"
                data-testid="text-content"
                rows="4"
                class="w-full rounded-md border border-input bg-background p-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                [value]="asTextNode(node).content"
                (input)="onPatch({ content: $any($event.target).value })"
                placeholder="Enter text or placeholders like {{ '{{' }}first_name{{ '}}' }}..."
              ></textarea>

              @if (placeholders.length > 0) {
                <div class="pt-1">
                  <p class="mb-1 text-[11px] text-muted-foreground">Insert placeholder:</p>
                  <div class="flex flex-wrap gap-1">
                    @for (p of placeholders; track p) {
                      <button
                        type="button"
                        data-quiet-button
                        class="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground hover:bg-primary/10 hover:text-foreground transition-colors"
                        [attr.data-testid]="'insert-placeholder-' + p"
                        (click)="insertTextPlaceholder(asTextNode(node), p)"
                      >
                        + {{ '{{' }}{{ p }}{{ '}}' }}
                      </button>
                    }
                  </div>
                </div>
              }
            </div>

            <!-- Typography Controls -->
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label [for]="'text-font-size-' + node.id" class="mb-1 block text-xs font-medium">Font Size</label>
                <input
                  type="number"
                  [id]="'text-font-size-' + node.id"
                  data-testid="text-font-size"
                  class="h-8 w-full rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="12"
                  [min]="limits.text.fontSize.min"
                  [max]="limits.text.fontSize.max"
                  [ngModel]="asTextNode(node).style.fontSize"
                  (ngModelChange)="onPatchStyle({ fontSize: parseNumber($event) })"
                />
              </div>

              <div>
                <label [for]="'text-color-' + node.id" class="mb-1 block text-xs font-medium">Color</label>
                <div class="flex min-w-0 items-center gap-2">
                  <input
                    type="color"
                    data-testid="text-color-picker"
                    class="size-9 shrink-0 cursor-pointer rounded-ui-md border border-input bg-background p-0.5"
                    [ngModel]="asTextNode(node).style.color"
                    (ngModelChange)="onPatchStyle({ color: $event })"
                  />
                  <input
                    type="text"
                    [id]="'text-color-' + node.id"
                    data-testid="text-color"
                    class="h-control-9 min-w-0 flex-1 font-mono uppercase rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="#111827"
                    maxlength="7"
                    [ngModel]="asTextNode(node).style.color"
                    (ngModelChange)="onPatchStyle({ color: $event })"
                  />
                </div>
              </div>

              <div>
                <label [for]="'text-align-' + node.id" class="mb-1 block text-xs font-medium">Alignment</label>
                <select appSelect
                  [id]="'text-align-' + node.id"
                  data-testid="text-align"
                  class="h-8 w-full rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  [ngModel]="asTextNode(node).style.align"
                  (ngModelChange)="onPatchStyle({ align: $event })"
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>

              <div class="flex items-center pt-5">
                <label class="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    data-testid="text-bold"
                    class="size-4 rounded border-input"
                    [ngModel]="asTextNode(node).style.bold"
                    (ngModelChange)="onPatchStyle({ bold: !!$event })"
                  />
                  <span class="text-xs font-medium">Bold text</span>
                </label>
              </div>
            </div>
          </div>
        }

        <!-- TABLE NODE -->
        @if (node.type === 'table') {
          <div class="space-y-4 border-t border-border pt-4" data-testid="table-node-properties">
            <div class="flex items-center justify-between">
              <h4 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Table Properties</h4>
              <div class="flex items-center gap-1.5">
                <button
                  hlmBtn
                  variant="outline"
                  size="sm"
                  type="button"
                  data-testid="table-add-row"
                  (click)="addTableRow(asTableNode(node))"
                >
                  + Row
                </button>
                <button
                  hlmBtn
                  variant="outline"
                  size="sm"
                  type="button"
                  data-testid="table-add-column"
                  (click)="addTableColumn(asTableNode(node))"
                >
                  + Column
                </button>
              </div>
            </div>

            <!-- Table Rows & Columns Grid Editor -->
            <div class="space-y-2">
              <p class="text-xs font-medium">Cells & Grid ({{ asTableNode(node).rows.length }} rows × {{ asTableNode(node).rows[0]?.length || 0 }} cols)</p>
              <div class="max-h-60 overflow-auto rounded border border-border p-2 bg-muted/20">
                <table class="w-full border-collapse text-xs" data-testid="table-grid-editor">
                  <tbody>
                    @for (row of asTableNode(node).rows; track rowIndex; let rowIndex = $index) {
                      <tr>
                        @for (cell of row; track colIndex; let colIndex = $index) {
                          <td class="p-1 border border-border/50">
                            <input
                              type="text"
                              class="h-8 w-full min-w-24 rounded border border-input bg-background px-1 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
                              placeholder="Cell value"
                              [attr.data-testid]="'cell-' + rowIndex + '-' + colIndex"
                              [ngModel]="cell"
                              (ngModelChange)="updateTableCell(asTableNode(node), rowIndex, colIndex, $event)"
                            />
                          </td>
                        }
                        <td class="p-1 pl-2">
                          <button
                            type="button"
                            class="text-xs text-destructive hover:underline"
                            [attr.data-testid]="'table-remove-row-' + rowIndex"
                            [disabled]="asTableNode(node).rows.length <= limits.table.rowCount.min"
                            (click)="removeTableRow(asTableNode(node), rowIndex)"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>

              <!-- Column Alignments & Widths -->
              <div class="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
                @for (dummy of getColumnsArray(asTableNode(node)); track colIdx; let colIdx = $index) {
                  <div class="flex items-center gap-1 rounded bg-muted/40 p-1.5 text-[11px] border border-border">
                    <span class="font-mono text-muted-foreground">Col {{ colIdx + 1 }}:</span>
                    <select appSelect
                      class="h-8 w-24 rounded border border-input bg-background text-[11px] pl-2 pr-7"
                      [attr.data-testid]="'table-col-align-' + colIdx"
                      [ngModel]="getColumnAlign(asTableNode(node), colIdx)"
                      (ngModelChange)="setColumnAlign(asTableNode(node), colIdx, $event)"
                    >
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                    </select>
                    <button
                      type="button"
                      class="text-destructive px-1 hover:underline"
                      [attr.data-testid]="'table-remove-col-' + colIdx"
                      [disabled]="(asTableNode(node).rows[0]?.length || 0) <= limits.table.columnCount.min"
                      (click)="removeTableColumn(asTableNode(node), colIdx)"
                      title="Remove column"
                    >
                      ×
                    </button>
                  </div>
                }
              </div>
            </div>

            <!-- Table Style Controls -->
            <div class="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2 [&>div]:min-w-0">
              <div>
                <label [for]="'table-font-size-' + node.id" class="mb-1 block text-xs font-medium">Font Size</label>
                <input
                  type="number"
                  [id]="'table-font-size-' + node.id"
                  data-testid="table-font-size"
                  class="h-control-9 w-full min-w-0 rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="10"
                  [min]="limits.table.fontSize.min"
                  [max]="limits.table.fontSize.max"
                  [ngModel]="asTableNode(node).style.fontSize"
                  (ngModelChange)="onPatchStyle({ fontSize: parseNumber($event) })"
                />
              </div>

              <div>
                <label [for]="'table-border-color-' + node.id" class="mb-1 block text-xs font-medium">Border Color</label>
                <div class="flex min-w-0 items-center gap-2">
                  <input
                    type="color"
                    data-testid="table-border-color-picker"
                    class="size-9 shrink-0 cursor-pointer rounded-ui-md border border-input bg-background p-0.5"
                    [ngModel]="asTableNode(node).style.borderColor"
                    (ngModelChange)="onPatchStyle({ borderColor: $event })"
                  />
                  <input
                    type="text"
                    [id]="'table-border-color-' + node.id"
                    data-testid="table-border-color"
                    class="h-control-9 min-w-0 flex-1 font-mono uppercase rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="#9CA3AF"
                    maxlength="7"
                    [ngModel]="asTableNode(node).style.borderColor"
                    (ngModelChange)="onPatchStyle({ borderColor: $event })"
                  />
                </div>
              </div>

              <div>
                <label [for]="'table-header-fill-' + node.id" class="mb-1 block text-xs font-medium">Header Fill</label>
                <div class="flex min-w-0 items-center gap-2">
                  <input
                    type="color"
                    data-testid="table-header-fill-picker"
                    class="size-9 shrink-0 cursor-pointer rounded-ui-md border border-input bg-background p-0.5"
                    [ngModel]="asTableNode(node).headerFill || '#f3f4f6'"
                    (ngModelChange)="onPatch({ headerFill: $event })"
                  />
                  <input
                    type="text"
                    [id]="'table-header-fill-' + node.id"
                    data-testid="table-header-fill"
                    class="h-control-9 min-w-0 flex-1 font-mono uppercase rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    maxlength="7"
                    [ngModel]="asTableNode(node).headerFill || ''"
                    (ngModelChange)="onPatch({ headerFill: $event || undefined })"
                    placeholder="#F3F4F6"
                  />
                </div>
              </div>

              <div class="col-span-full flex flex-wrap gap-x-6 gap-y-2 pt-1">
                <label class="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    data-testid="table-header-bold"
                    class="size-4 rounded border-input"
                    [ngModel]="asTableNode(node).style.headerBold"
                    (ngModelChange)="onPatchStyle({ headerBold: !!$event })"
                  />
                  <span class="text-xs font-medium">Header bold</span>
                </label>

                <label class="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    data-testid="table-zebra"
                    class="size-4 rounded border-input"
                    [ngModel]="asTableNode(node).zebra"
                    (ngModelChange)="onPatch({ zebra: !!$event })"
                  />
                  <span class="text-xs font-medium">Zebra striping</span>
                </label>
              </div>
            </div>
          </div>
        }

        <!-- IMAGE NODE -->
        @if (node.type === 'image') {
          <div class="space-y-4 border-t border-border pt-4" data-testid="image-node-properties">
            <h4 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Image Properties</h4>
            <div>
              <label [for]="'image-attachment-' + node.id" class="mb-1 block text-xs font-medium">
                Attachment File
              </label>
              @if (attachments.length > 0) {
                <select appSelect
                  [id]="'image-attachment-' + node.id"
                  data-testid="image-attachment-select"
                  class="h-8 w-full rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  [ngModel]="asImageNode(node).attachmentId"
                  (ngModelChange)="onPatch({ attachmentId: $event })"
                >
                  <option value="" disabled>Select an attachment...</option>
                  @for (att of attachments; track att.id) {
                    <option [value]="att.id">{{ att.fileName }} ({{ att.id.slice(0, 8) }})</option>
                  }
                </select>
              } @else {
                <input
                  type="text"
                  [id]="'image-attachment-' + node.id"
                  data-testid="image-attachment-input"
                  class="h-8 w-full rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  [ngModel]="asImageNode(node).attachmentId"
                  (ngModelChange)="onPatch({ attachmentId: $event })"
                  placeholder="Enter attachment ID..."
                />
                <p class="mt-1 text-[11px] text-muted-foreground">
                  No attachments yet. Upload an image below or enter an attachment ID.
                </p>
              }
              <div class="mt-3">
                <label [for]="'image-upload-' + node.id" class="mb-1 block text-xs font-medium">Upload image</label>
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  [id]="'image-upload-' + node.id"
                  data-testid="image-upload-input"
                  class="block w-full text-xs file:mr-3 file:h-control-9 file:cursor-pointer file:rounded-ui-md file:border-0 file:bg-primary file:px-3 file:text-sm file:font-medium file:text-primary-foreground"
                  [disabled]="uploadingImage"
                  (change)="onImageFile($event)"
                />
                @if (uploadingImage) { <p class="mt-1 text-[11px] text-muted-foreground" role="status">Uploading…</p> }
                @if (uploadError) { <p class="mt-1 text-[11px] text-destructive" role="alert">{{ uploadError }}</p> }
              </div>
            </div>
          </div>
        }

        <!-- SHEET NODE -->
        @if (node.type === 'sheet') {
          <div class="space-y-4 border-t border-border pt-4" data-testid="sheet-node-properties">
            <h4 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sheet Properties</h4>
            <div>
              <label [for]="'sheet-color-' + node.id" class="mb-1 block text-xs font-medium">Fill color</label>
              <div class="flex min-w-0 items-center gap-2">
                <input
                  type="color"
                  data-testid="sheet-color-picker"
                  class="size-9 shrink-0 cursor-pointer rounded-ui-md border border-input bg-background p-0.5"
                  [ngModel]="asSheetNode(node).style.color"
                  (ngModelChange)="onPatchStyle({ color: $event })"
                />
                <input
                  type="text"
                  [id]="'sheet-color-' + node.id"
                  data-testid="sheet-color"
                  class="h-control-9 min-w-0 flex-1 font-mono uppercase rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="#E5E7EB"
                  maxlength="7"
                  [ngModel]="asSheetNode(node).style.color"
                  (ngModelChange)="onPatchStyle({ color: $event })"
                />
              </div>
            </div>
          </div>
        }

        <!-- DIVIDER NODE -->
        @if (node.type === 'divider') {
          <div class="space-y-4 border-t border-border pt-4" data-testid="divider-node-properties">
            <h4 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Divider Properties</h4>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label [for]="'divider-thickness-' + node.id" class="mb-1 block text-xs font-medium">Thickness</label>
                <input
                  type="number"
                  step="0.5"
                  [id]="'divider-thickness-' + node.id"
                  data-testid="divider-thickness"
                  class="h-8 w-full rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="1"
                  [min]="limits.divider.thickness.min"
                  [max]="limits.divider.thickness.max"
                  [ngModel]="asDividerNode(node).style.thickness"
                  (ngModelChange)="onPatchStyle({ thickness: parseNumber($event) })"
                />
              </div>

              <div>
                <label [for]="'divider-color-' + node.id" class="mb-1 block text-xs font-medium">Color</label>
                <div class="flex min-w-0 items-center gap-2">
                  <input
                    type="color"
                    data-testid="divider-color-picker"
                    class="size-9 shrink-0 cursor-pointer rounded-ui-md border border-input bg-background p-0.5"
                    [ngModel]="asDividerNode(node).style.color"
                    (ngModelChange)="onPatchStyle({ color: $event })"
                  />
                  <input
                    type="text"
                    [id]="'divider-color-' + node.id"
                    data-testid="divider-color"
                    class="h-control-9 min-w-0 flex-1 font-mono uppercase rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="#9CA3AF"
                    maxlength="7"
                    [ngModel]="asDividerNode(node).style.color"
                    (ngModelChange)="onPatchStyle({ color: $event })"
                  />
                </div>
              </div>
            </div>
          </div>
        }
      }
    </div>
  `,
})
export class PdfNodePropertiesComponent {
  @Input() node: PdfNode | null = null;
  @Input() errors: PdfNodeValidationError[] = [];
  @Input() placeholders: string[] = [];
  @Input() attachments: AttachmentItem[] = [];

  @Input() uploadingImage = false;
  @Input() uploadError: string | null = null;
  protected onImageFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.imageUpload.emit(file);
    input.value = '';
  }

  @Output() imageUpload = new EventEmitter<File>();
  @Output() patch = new EventEmitter<Partial<PdfNode>>();
  @Output() delete = new EventEmitter<string>();
  @Output() duplicate = new EventEmitter<string>();

  readonly limits = PDF_NODE_LIMITS;

  get nodeErrors(): PdfNodeValidationError[] {
    if (!this.node) return [];
    return this.errors.filter((e) => e.nodeId === this.node?.id);
  }

  asTextNode(node: PdfNode): PdfTextNode {
    return node as PdfTextNode;
  }

  asTableNode(node: PdfNode): PdfTableNode {
    return node as PdfTableNode;
  }

  asImageNode(node: PdfNode): PdfImageNode {
    return node as PdfImageNode;
  }

  asSheetNode(node: PdfNode): PdfSheetNode {
    return node as PdfSheetNode;
  }

  asDividerNode(node: PdfNode): PdfDividerNode {
    return node as PdfDividerNode;
  }

  parseNumber(val: unknown): number {
    const num = Number(val);
    return Number.isFinite(num) ? num : 0;
  }

  onPatch(changes: Record<string, unknown>): void {
    this.patch.emit(changes as Partial<PdfNode>);
  }

  onPatchStyle(styleChanges: Record<string, unknown>): void {
    if (!this.node || !('style' in this.node)) return;
    const currentStyle = (this.node as { style: Record<string, unknown> }).style;
    this.patch.emit({
      style: {
        ...currentStyle,
        ...styleChanges,
      },
    } as unknown as Partial<PdfNode>);
  }

  insertTextPlaceholder(node: PdfTextNode, placeholder: string): void {
    const addition = `{{${placeholder}}}`;
    const newContent = node.content ? `${node.content} ${addition}` : addition;
    this.patch.emit({ content: newContent } as unknown as Partial<PdfNode>);
  }

  // --- Table Operations keeping equal row & column lengths ---

  addTableRow(table: PdfTableNode): void {
    const colCount = table.rows[0]?.length || 1;
    const newRow = new Array(colCount).fill('');
    const newRows = [...table.rows, newRow];
    this.patch.emit({ rows: newRows } as unknown as Partial<PdfNode>);
  }

  removeTableRow(table: PdfTableNode, index: number): void {
    if (table.rows.length <= PDF_NODE_LIMITS.table.rowCount.min) return;
    const newRows = table.rows.filter((_, i) => i !== index);
    this.patch.emit({ rows: newRows } as unknown as Partial<PdfNode>);
  }

  addTableColumn(table: PdfTableNode): void {
    const currentCols = table.rows[0]?.length || 0;
    if (currentCols >= PDF_NODE_LIMITS.table.columnCount.max) return;

    // Every row gets one new cell
    const newRows = table.rows.map((row) => [...row, '']);

    // Keep columnAligns aligned if present
    let newAligns = table.columnAligns ? [...table.columnAligns, 'left' as const] : undefined;
    // Keep columnWidths aligned if present
    let newWidths = table.columnWidths ? [...table.columnWidths, 1] : undefined;

    this.patch.emit({
      rows: newRows,
      ...(newAligns ? { columnAligns: newAligns } : {}),
      ...(newWidths ? { columnWidths: newWidths } : {}),
    } as unknown as Partial<PdfNode>);
  }

  removeTableColumn(table: PdfTableNode, index: number): void {
    const currentCols = table.rows[0]?.length || 0;
    if (currentCols <= PDF_NODE_LIMITS.table.columnCount.min) return;

    const newRows = table.rows.map((row) => row.filter((_, i) => i !== index));
    const newAligns = table.columnAligns ? table.columnAligns.filter((_, i) => i !== index) : undefined;
    const newWidths = table.columnWidths ? table.columnWidths.filter((_, i) => i !== index) : undefined;

    this.patch.emit({
      rows: newRows,
      ...(newAligns ? { columnAligns: newAligns } : {}),
      ...(newWidths ? { columnWidths: newWidths } : {}),
    } as unknown as Partial<PdfNode>);
  }

  updateTableCell(table: PdfTableNode, rowIndex: number, colIndex: number, value: string): void {
    const newRows = table.rows.map((row, rIdx) => {
      if (rIdx !== rowIndex) return row;
      return row.map((cell, cIdx) => (cIdx === colIndex ? value : cell));
    });
    this.patch.emit({ rows: newRows } as unknown as Partial<PdfNode>);
  }

  getColumnsArray(table: PdfTableNode): unknown[] {
    const count = table.rows[0]?.length || 0;
    return new Array(count);
  }

  getColumnAlign(table: PdfTableNode, colIndex: number): 'left' | 'center' | 'right' {
    return table.columnAligns?.[colIndex] ?? 'left';
  }

  setColumnAlign(table: PdfTableNode, colIndex: number, align: 'left' | 'center' | 'right'): void {
    const colCount = table.rows[0]?.length || 0;
    const currentAligns = table.columnAligns ? [...table.columnAligns] : new Array(colCount).fill('left');
    currentAligns[colIndex] = align;
    this.patch.emit({ columnAligns: currentAligns } as unknown as Partial<PdfNode>);
  }
}
