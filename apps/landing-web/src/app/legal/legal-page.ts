import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { contentEn } from '../content/content.en';
import { contentId } from '../content/content.id';
import { LandingDictionary } from '../content/content.types';
import { LandingFooterComponent, LandingHeaderComponent } from '../home/home-sections';
import { SeoService } from '../seo/seo.service';

@Component({
  selector: 'app-legal-page',
  standalone: true,
  imports: [LandingHeaderComponent, LandingFooterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <landing-header [copy]="content.home" [language]="content.language" [path]="content.terms.metadata.path" />
    <main class="section-shell legal-main">
      <article class="legal-article">
        <p class="section-kicker">{{ content.terms.kicker }}</p>
        <h1>{{ content.terms.heading }}</h1>
        <p class="legal-intro">{{ content.terms.intro }}</p>
        @for (section of content.terms.sections; track section.title) {
          <section class="legal-section">
            <h2>{{ section.title }}</h2>
            @for (paragraph of section.body; track paragraph) { <p>{{ paragraph }}</p> }
          </section>
        }
      </article>
    </main>
    <landing-footer [copy]="content.home" [language]="content.language" />
  `,
})
export class LegalPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly seo = inject(SeoService);
  protected readonly content: LandingDictionary = this.route.snapshot.data['language'] === 'id' ? contentId : contentEn;
  protected readonly alternate: LandingDictionary = this.content.language === 'id' ? contentEn : contentId;

  ngOnInit(): void {
    this.seo.setPage(this.content.terms.metadata, this.content.language, this.alternate.terms.metadata);
  }
}
