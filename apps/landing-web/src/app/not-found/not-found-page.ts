import { ChangeDetectionStrategy, Component, OnInit, RESPONSE_INIT, inject } from '@angular/core';
import { Router } from '@angular/router';
import { contentEn } from '../content/content.en';
import { contentId } from '../content/content.id';
import { LandingDictionary } from '../content/content.types';
import { LandingFooterComponent, LandingHeaderComponent } from '../home/home-sections';
import { SeoService } from '../seo/seo.service';
import { Pressed } from '../ui/pressed';

@Component({
  selector: 'app-not-found-page',
  standalone: true,
  imports: [LandingHeaderComponent, LandingFooterComponent, Pressed],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <landing-header [copy]="content.home" [language]="content.language" />
    <main class="section-shell not-found">
      <p class="section-kicker">{{ content.notFound.kicker }}</p>
      <h1>{{ content.notFound.title }}</h1>
      <p>{{ content.notFound.body }}</p>
      <a appPressed class="button button-primary" [href]="homePath()">{{ content.notFound.homeLabel }}</a>
    </main>
    <landing-footer [copy]="content.home" [language]="content.language" />
  `,
})
export class NotFoundPageComponent implements OnInit {
  private readonly seo = inject(SeoService);
  private readonly response = inject(RESPONSE_INIT, { optional: true });
  private readonly router = inject(Router);
  protected readonly content: LandingDictionary = /^\/id(\/|\?|#|$)/.test(this.router.url) ? contentId : contentEn;

  ngOnInit(): void {
    this.seo.setNotFound();
    if (this.response) this.response.status = 404;
  }

  protected homePath(): string { return this.content.language === 'id' ? '/id' : '/'; }
}
