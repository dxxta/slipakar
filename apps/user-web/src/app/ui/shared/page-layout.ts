import { Directive } from '@angular/core';

@Directive({
  selector: 'main[appPageLayout]',
  host: {
    class: 'w-full space-y-section px-page py-page md:px-page-lg',
    'data-page-layout': '',
  },
})
export class PageLayout {}
