import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiClient, type PageMetadata } from '../../../core/api-client';
import { PageHeader, PageState } from '../../../ui';
import { Pressed } from '../../../ui/shared/pressed';

type ActivityItem = {
  id: string;
  entity: string;
  action: string;
  fieldName: string | null;
  fieldValue: string | null;
  createdAt: string;
};
type Campaign = { status: string; createdAt: string };

@Component({
  selector: 'app-project-overview-page',
  imports: [CommonModule, PageHeader, PageState, Pressed],
  template: `
    <div class="app-list-layout">
    <app-page-header
      title="Overview"
      [topLevel]="false"
      description="Project activity and delivery summary."
    />

    <app-page-state
      [state]="loading() ? 'loading' : error() ? 'error' : 'ready'"
      loadingLabel="Loading project overview"
      title="Could not load project overview"
      [message]="error() ?? ''"
      (retry)="load()"
    >
      <div class="grid gap-4">
        <section class="flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain pb-2 md:grid md:snap-none md:overflow-visible md:pb-0 [&>*]:w-[72%] [&>*]:shrink-0 [&>*]:snap-start md:[&>*]:w-auto md:grid-cols-2 xl:grid-cols-5" aria-label="Project summary">
          <article appPressed class="min-h-24 rounded-ui-lg border border-border bg-card p-card">
            <p class="text-sm text-muted-foreground">Campaigns</p>
            <p class="mt-2 text-2xl font-semibold tabular-nums">{{ counts().campaigns }}</p>
          </article>
          <article appPressed class="min-h-24 rounded-ui-lg border border-border bg-card p-card">
            <p class="text-sm text-muted-foreground">Email templates</p>
            <p class="mt-2 text-2xl font-semibold tabular-nums">{{ counts().templates }}</p>
          </article>
          <article appPressed class="min-h-24 rounded-ui-lg border border-border bg-card p-card">
            <p class="text-sm text-muted-foreground">Data files</p>
            <p class="mt-2 text-2xl font-semibold tabular-nums">{{ counts().uploads }}</p>
          </article>
          <article appPressed class="min-h-24 rounded-ui-lg border border-border bg-card p-card">
            <p class="text-sm text-muted-foreground">Unread notifications</p>
            <p class="mt-2 text-2xl font-semibold tabular-nums">{{ counts().unread }}</p>
          </article>
          <article appPressed class="min-h-24 rounded-ui-lg border border-border bg-card p-card">
            <p class="text-sm text-muted-foreground">Last send status</p>
            <p class="mt-2 text-lg font-semibold">{{ lastStatus() }}</p>
          </article>
        </section>

        <section appPressed class="rounded-ui-lg border border-border bg-card p-card" aria-labelledby="activity-heading">
          <h2 id="activity-heading" class="text-lg font-semibold">Recent changes</h2>
          @if (activity().length) {
            <ol class="mt-4 divide-y divide-border">
              @for (item of activity(); track item.id) {
                <li class="py-3">
                  <p class="text-sm font-medium">{{ item.action }} {{ item.entity }}</p>
                  <p class="mt-1 text-xs text-muted-foreground tabular-nums">
                    {{ item.fieldName ? item.fieldName + ': ' + item.fieldValue : 'Project activity' }} · {{ item.createdAt | date: 'medium' }}
                  </p>
                </li>
              }
            </ol>
          } @else {
            <p class="mt-3 text-sm text-muted-foreground">No recent changes yet.</p>
          }
        </section>
      </div>
    </app-page-state>
        </div>
  `,
})
export class ProjectOverviewPage implements OnInit {
  private readonly api = inject(ApiClient);
  private readonly route = inject(ActivatedRoute);
  readonly projectId = signal('');
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly activity = signal<ActivityItem[]>([]);
  readonly counts = signal({ campaigns: 0, templates: 0, uploads: 0, unread: 0 });
  readonly lastStatus = signal('No campaigns sent');

  ngOnInit(): void {
    this.projectId.set(
      this.route.parent?.snapshot.paramMap.get('projectId') ??
        this.route.snapshot.paramMap.get('projectId') ??
        ''
    );
    this.load();
  }

  load(): void {
    const id = this.projectId();
    if (!id) {
      this.error.set('Project could not be identified.');
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      campaigns: this.api.getPage<Campaign>(
        `/projects/${id}/campaigns?page=1&limit=100&sortBy=createdAt&sortDir=desc`
      ),
      templates: this.api.getPage<unknown>(
        `/projects/${id}/templates?page=1&limit=1&sortBy=createdAt&sortDir=desc`
      ),
      uploads: this.api.get<unknown[]>(`/projects/${id}/uploads`),
      unread: this.api.getPage<unknown>(
        `/projects/${id}/notifications?page=1&limit=1&unread=true&sortBy=createdAt&sortDir=desc`
      ),
      activity: this.api.getPage<ActivityItem>(`/projects/${id}/activity?page=1&limit=10`),
    }).subscribe({
      next: (data) => {
        this.counts.set({
          campaigns: data.campaigns.metadata.total,
          templates: data.templates.metadata.total,
          uploads: data.uploads.length,
          unread: data.unread.metadata.total,
        });
        this.lastStatus.set(data.campaigns.data[0]?.status ?? 'No campaigns sent');
        this.activity.set(data.activity.data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Check your connection and try again.');
        this.loading.set(false);
      },
    });
  }
}
