import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  imports: [RouterLink],
  selector: 'app-forbidden-page',
  template: `<main class="grid min-h-dvh place-items-center px-6 text-center"><section><p class="text-sm font-medium text-muted-foreground">403 · Access denied</p><h1 class="mt-3 text-3xl font-semibold tracking-tight">This area is for administrators</h1><p class="mt-3 text-muted-foreground">Your account does not have permission to view this workspace.</p><a routerLink="/login" class="mt-6 inline-flex min-h-11 items-center rounded-md px-3 py-2 text-sm font-medium underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Use another account</a></section></main>`,
})
export class ForbiddenPage {}
