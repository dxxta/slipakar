import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { contentEn } from '../content/content.en';
import { contentId } from '../content/content.id';
import { LandingDictionary } from '../content/content.types';
import { SeoService } from '../seo/seo.service';
import { HOME_SECTION_COMPONENTS } from './home-sections';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [...HOME_SECTION_COMPONENTS],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <landing-header [copy]="content.home" [language]="content.language" />
    <main>
      <landing-hero [copy]="content.home" />
      <landing-audience [copy]="content.home" />
      <landing-how [copy]="content.home" />
      <landing-features [copy]="content.home" />
      <landing-pdf-showcase [copy]="content.home" />
      <landing-security [copy]="content.home" />
      <landing-self-host [copy]="content.home" />
      <landing-open-source [copy]="content.home" />
      <landing-faq [copy]="content.home" />
    </main>
    <landing-footer [copy]="content.home" [language]="content.language" />
  `,
})
export class HomePageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly seo = inject(SeoService);
  protected readonly content: LandingDictionary = this.route.snapshot.data['language'] === 'id' ? contentId : contentEn;

  ngOnInit(): void {
    const alternate = this.content.language === 'en' ? contentId.home.metadata : contentEn.home.metadata;
    this.seo.setPage(this.content.home.metadata, this.content.language, alternate);
    this.seo.setHomeStructuredData(this.content.home.metadata, this.content.home.faq.items);
  }
}
