import { Component, input } from '@angular/core';
import { PageBadge } from './page-badge';

@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [PageBadge],
  template: `
    <header class="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-2">
      <div class="col-start-1 row-start-1 min-w-0 [overflow-wrap:anywhere]">
        <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h1 class="min-w-0 text-3xl font-semibold tracking-tight text-balance [overflow-wrap:anywhere]">{{ title() }}</h1>
          @if (badge() && topLevel()) { <app-page-badge [label]="badge()" [topLevel]="true" /> }
        </div>
        @if (description()) { <p class="mt-2 min-w-0 text-sm text-muted-foreground text-pretty [overflow-wrap:anywhere]">{{ description() }}</p> }
      </div>
      <div class="col-start-2 row-span-2 row-start-1 flex shrink-0 items-start justify-end gap-2 justify-self-end"><ng-content select="[page-actions]" /></div>
    </header>
  `,
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly description = input('');
  readonly badge = input('');
  readonly topLevel = input(true);
}
