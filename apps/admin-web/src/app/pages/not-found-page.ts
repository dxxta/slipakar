import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  imports: [RouterLink],
  selector: 'app-not-found-page',
  template: `<main class="grid min-h-screen place-items-center px-6 text-center"><section><p class="text-sm font-medium text-muted-foreground">404 · Page not found</p><h1 class="mt-3 text-3xl font-semibold tracking-tight">We couldn’t find that page</h1><a routerLink="/" class="mt-6 inline-flex rounded-md px-3 py-2 text-sm font-medium underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Return to dashboard</a></section></main>`,
})
export class NotFoundPage {}
