import { Routes } from '@angular/router';
import { HomePageComponent } from './home/home-page';
import { LegalPageComponent } from './legal/legal-page';
import { NotFoundPageComponent } from './not-found/not-found-page';

export const routes: Routes = [
  { path: '', component: HomePageComponent, data: { language: 'en' } },
  { path: 'id', component: HomePageComponent, data: { language: 'id' } },
  { path: 'terms', component: LegalPageComponent, data: { language: 'en', legalType: 'terms' } },
  { path: 'id/terms', component: LegalPageComponent, data: { language: 'id', legalType: 'terms' } },
  { path: 'not-found', component: NotFoundPageComponent },
  { path: '**', component: NotFoundPageComponent },
];
