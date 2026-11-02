import { Component, input } from '@angular/core';

@Component({
  selector: 'app-page-badge',
  template: `@if (topLevel()) { <span data-page-badge class="inline-flex h-6 items-center rounded-full border border-border bg-muted px-2 text-xs font-medium leading-none text-muted-foreground">{{ label() }}</span> }`,
})
export class PageBadge {
  readonly label = input.required<string>();
  readonly topLevel = input(true);
}
