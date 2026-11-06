import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { initSentry } from './app/core/error-reporting';
import { environment } from './environments/environment';

initSentry(environment);

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
