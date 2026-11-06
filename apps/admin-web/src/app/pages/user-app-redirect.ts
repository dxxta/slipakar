import { Component, OnInit } from '@angular/core';
import { environment } from '../../environments/environment';

@Component({ selector: 'app-user-app-redirect', template: '<p class="sr-only">Opening the user application.</p>' })
export class UserAppRedirect implements OnInit {
  ngOnInit(): void { window.location.replace(environment.userAppUrl); }
}
