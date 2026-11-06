import { Directive } from '@angular/core';

@Directive({
  selector: 'select[appSelect]',
  host: { class: 'app-select' },
})
export class SelectControl {}
