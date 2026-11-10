import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { RowActions, type RowActionItem } from '../../ui/shared/row-actions';
import { PLACEHOLDER_REGEX } from '@slipakar/shared';
import { ApiError } from '../../core/api-error';
import { BackButton } from '../../ui/shared/back-button';
import { HlmButton } from '../../ui/button/src';
import { HlmAlert, HlmAlertDescription, HlmAlertTitle } from '../../ui/alert/src';
import { TemplatesService, type CreateTemplatePayload, type UpdateTemplatePayload } from './templates.service';
import { Ripple } from '../../ui/shared/ripple';

function unsafeSyntaxMessage(text: string): string | null {
  if (!text) return null;
  const regex = new RegExp(PLACEHOLDER_REGEX.source, PLACEHOLDER_REGEX.flags);
  const remainder = text.replace(regex, '');
  return remainder.includes('{{') || remainder.includes('}}')
    ? 'Only simple {{field_name}} placeholders are supported. Blocks, partials, triple braces, and malformed braces are not allowed.'
    : null;
}

@Component({
  selector: 'app-template-edit-page',
  imports: [Ripple, RowActions, BackButton, HlmButton, HlmAlert, HlmAlertTitle, HlmAlertDescription],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <header class="flex items-start gap-3">
        <div class="min-w-0 flex-1">
          <h1 class="text-3xl font-semibold tracking-tight">{{ editingId() ? 'Edit email template' : 'New email template' }}</h1>
          <p class="mt-2 text-sm text-muted-foreground">Write a subject and HTML message with simple recipient placeholders.</p>
        </div>
        <app-back-button class="ml-auto shrink-0 max-md:hidden" [link]="['/projects', projectId, 'templates']" label="Back to email templates" /><app-row-actions class="ml-auto md:hidden" [solid]="true" label="Page actions" [items]="mobileActions" (actionSelect)="goBack()" />
      </header>

      @if (error()) { <div role="alert"><div hlmAlert variant="destructive"><h2 hlmAlertTitle>Could not save template</h2><p hlmAlertDescription>{{ error() }}</p></div></div> }
      <section class="rounded-ui-lg border border-border bg-card p-card" aria-label="Email template editor">
        @if (loading()) { <p role="status">Loading template…</p> } @else {
          <form class="space-y-5" (submit)="$event.preventDefault(); save()">
            <div class="grid gap-2"><label for="template-name" class="text-sm font-medium">Template name</label><input id="template-name" data-testid="template-name-input" class="h-control-9 w-full rounded-ui-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="Monthly payslip" [value]="name()" (input)="name.set(inputValue($event))" maxlength="100" required /></div>
            <div class="grid gap-2"><label for="template-subject" class="text-sm font-medium">Subject line</label><input id="template-subject" data-testid="template-subject-input" class="h-control-9 w-full rounded-ui-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="Your payslip for {{ '{{period}}' }}" [value]="subject()" (input)="subject.set(inputValue($event))" maxlength="300" required /></div>
            <div class="grid gap-2"><div class="flex flex-wrap items-center justify-between gap-2"><label for="template-body" class="text-sm font-medium">HTML body</label><span class="text-xs text-muted-foreground">Placeholder values are HTML escaped.</span></div><textarea id="template-body" data-testid="template-body-textarea" rows="14" class="w-full rounded-ui-md border border-input bg-background p-3 font-mono text-xs leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="<p>Hello {{ '{{employee_name}}' }},</p>" [value]="bodyHtml()" (input)="bodyHtml.set(inputValue($event))" required></textarea><p class="text-xs text-muted-foreground">Use <code class="rounded bg-muted px-1 py-0.5">{{ '{{field_name}}' }}</code>. Complex logic, blocks, loops, partials, and triple braces are unsupported.</p></div>
            @if (syntaxError()) { <p data-testid="template-syntax-error" role="alert" class="text-sm text-destructive">{{ syntaxError() }}</p> }
            <div class="flex flex-wrap justify-end gap-2 border-t border-border pt-4"><button hlmBtn variant="outline" type="button" data-testid="template-cancel-button" (click)="cancel()">Cancel</button><button hlmBtn type="submit" data-testid="template-save-button" [disabled]="saving() || loading() || !name().trim() || !subject().trim() || !bodyHtml().trim() || !!syntaxError()">{{ saving() ? 'Saving…' : (editingId() ? 'Save changes' : 'Create template') }}</button></div>
          </form>
        }
      </section>
    </div>
  `,
})
export class TemplateEditPage implements OnInit {
  private readonly service = inject(TemplatesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly mobileActions: RowActionItem[] = [{ id: 'back', label: 'Back to email templates', icon: 'back' }];
  protected goBack(): void { void this.router.navigate(['/projects', this.projectId, 'templates']); }
  readonly projectId = this.resolveProjectId();
  readonly editingId = signal<string | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly name = signal('');
  readonly subject = signal('');
  readonly bodyHtml = signal('');
  readonly syntaxError = computed(() => unsafeSyntaxMessage(`${this.subject()}\n${this.bodyHtml()}`));

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('templateId');
    if (!id) return;
    this.editingId.set(id);
    this.loading.set(true);
    this.service.get(this.projectId, id).subscribe({
      next: (template) => { this.name.set(template.name); this.subject.set(template.subject); this.bodyHtml.set(template.bodyHtml); this.loading.set(false); },
      error: (error: unknown) => { this.error.set(error instanceof ApiError ? error.message : 'Could not load email template.'); this.loading.set(false); },
    });
  }

  inputValue(event: Event): string { return (event.currentTarget as HTMLInputElement | HTMLTextAreaElement).value; }

  save(): void {
    const name = this.name().trim();
    const subject = this.subject().trim();
    const bodyHtml = this.bodyHtml().trim();
    if (!name || !subject || !bodyHtml || this.syntaxError()) return;
    this.error.set(null);
    this.saving.set(true);
    const id = this.editingId();
    const request = id
      ? this.service.update(this.projectId, id, { name, subject, bodyHtml } satisfies UpdateTemplatePayload)
      : this.service.create(this.projectId, { name, subject, bodyHtml } satisfies CreateTemplatePayload);
    request.subscribe({
      next: () => { this.saving.set(false); void this.router.navigate(['/projects', this.projectId, 'templates']); },
      error: (error: unknown) => { this.saving.set(false); this.error.set(error instanceof ApiError ? error.message : 'Failed to save email template.'); },
    });
  }

  cancel(): void { void this.router.navigate(['/projects', this.projectId, 'templates']); }

  private resolveProjectId(): string {
    let current: ActivatedRoute | null = this.route;
    while (current) {
      const id = current.snapshot.paramMap.get('projectId');
      if (id) return id;
      current = current.parent;
    }
    return '';
  }
}
