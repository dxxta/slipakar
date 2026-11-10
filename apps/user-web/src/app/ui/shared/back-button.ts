import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerArrowLeft } from '@ng-icons/tabler-icons';

export type BackButtonLink = string | (string | number)[];

@Component({
  selector: 'app-back-button',
  standalone: true,
  imports: [RouterLink, NgIcon],
  providers: [provideIcons({ tablerArrowLeft })],
  template: `<a [routerLink]="link()" [attr.aria-label]="label()" [attr.title]="label()" class="grid h-control-9 w-control-9 shrink-0 place-items-center rounded-ui-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ng-icon name="tablerArrowLeft" aria-hidden="true" class="size-5" /></a>`,
})
export class BackButton {
  readonly link = input<BackButtonLink>('/projects');
  readonly label = input('Go back');
}
