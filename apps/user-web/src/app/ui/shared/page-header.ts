import { Component, input } from '@angular/core';
import { PageBadge } from './page-badge';

@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [PageBadge],
  template: `
    <header class="flex flex-wrap items-start justify-between gap-4">
      <div class="min-w-0">
        <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <h1 class="text-3xl font-semibold tracking-tight text-balance">{{ title() }}</h1>
          @if (badge() && topLevel()) { <app-page-badge [label]="badge()" [topLevel]="true" /> }
        </div>
        @if (description()) { <p class="mt-2 text-sm text-muted-foreground text-pretty">{{ description() }}</p> }
      </div>
      <div class="ml-auto flex shrink-0 items-center gap-2"><ng-content select="[page-actions]" /></div>
    </header>
  `,
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly description = input('');
  readonly badge = input('');
  readonly topLevel = input(true);
}
