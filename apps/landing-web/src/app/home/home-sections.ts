import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { HomeCopy } from '../content/content.types';
import { LANDING_CONFIG } from '../runtime-config';
import { HlmToggleGroupImports } from '@slipakar/ui/toggle-group';
import { Pressed } from '../ui/pressed';

@Component({
  selector: 'landing-language-toggle',
  standalone: true,
  imports: [...HlmToggleGroupImports],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div hlmToggleGroup role="group" type="single" [value]="language()" [nullable]="false" class="language-toggle" [attr.aria-label]="language() === 'en' ? 'Language' : 'Bahasa'">
      <button hlmToggleGroupItem class="language-option" [class.language-option-active]="language() === 'id'" [attr.aria-current]="language() === 'id' ? 'page' : null" value="id" lang="id" type="button" (click)="selectLanguage('id')">ID</button>
      <button hlmToggleGroupItem class="language-option" [class.language-option-active]="language() === 'en'" [attr.aria-current]="language() === 'en' ? 'page' : null" value="en" lang="en" type="button" (click)="selectLanguage('en')">EN</button>
    </div>
  `,
})
export class LandingLanguageToggleComponent {
  readonly language = input.required<'en' | 'id'>();
  readonly path = input.required<string>();
  private readonly document = inject(DOCUMENT);

  protected selectLanguage(targetLanguage: 'en' | 'id'): void {
    const targetPath = this.languagePathFor(targetLanguage);
    if (targetPath !== this.path()) this.document.defaultView?.location.assign(targetPath);
  }

  protected languagePathFor(targetLanguage: 'en' | 'id'): string {
    const path = this.path();
    const basePath = this.language() === 'id' ? path.replace(/^\/id/, '') || '/' : path;
    if (targetLanguage === this.language()) return path;
    return targetLanguage === 'id' ? (basePath === '/' ? '/id' : `/id${basePath}`) : basePath;
  }
}

@Component({
  selector: 'landing-header',
  standalone: true,
  imports: [LandingLanguageToggleComponent, Pressed],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="site-header" appPressed>
      <a class="wordmark" [href]="homePath()" aria-label="Slipakar home">Slipakar<span class="wordmark-dot">.</span></a>
      <nav class="header-nav" aria-label="Main navigation">
        <a [href]="homePath() + '#how-it-works'">{{ copy().nav.how }}</a>
        <a [href]="homePath() + '#features'">{{ copy().nav.features }}</a>
      </nav>
      <div class="header-actions">
        <landing-language-toggle [language]="language()" [path]="path() ?? copy().metadata.path" />
        <a appPressed class="button button-small button-dark" [href]="config.appUrl">{{ copy().nav.signIn }}</a>
      </div>
    </header>
  `,
})
export class LandingHeaderComponent {
  readonly copy = input.required<HomeCopy>();
  readonly language = input.required<'en' | 'id'>();
  readonly path = input<string>();
  protected readonly config = inject(LANDING_CONFIG);
  protected homePath(): string { return this.language() === 'id' ? '/id' : '/'; }
}

@Component({
  selector: 'landing-hero',
  standalone: true,
  imports: [Pressed],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="hero section-shell" aria-labelledby="hero-title">
      <div class="hero-copy">
        <h1 id="hero-title">{{ titleParts().lead }} <span class="accent">{{ titleParts().accent }}</span></h1>
        <p class="hero-description">{{ copy().hero.description }}</p>
        <div class="hero-actions">
          <a appPressed class="button button-primary" [href]="config.appUrl">{{ copy().hero.signIn }}<span class="arrow-mark" aria-hidden="true"></span></a>
          <a appPressed class="button button-quiet" [href]="config.docsUrl">{{ copy().hero.selfHost }}</a>
        </div>
        <p class="hero-note">Open source <span aria-hidden="true">·</span> Self-hostable <span aria-hidden="true">·</span> Your SMTP server</p>
      </div>
      <div class="hero-proof" aria-label="Illustration of a personalized campaign">
        <div class="mail-window" appPressed>
          <div class="window-top"><span class="window-mark">L</span><span>Campaign preview</span><span class="window-status">Ready to send</span></div>
          <div class="mail-content">
            <p class="mail-eyebrow">PERSONALIZED MESSAGE</p>
            <p class="mail-greeting">Hello, <span>{{ placeholderLabel }}</span></p>
            <div class="mail-line mail-line-long"></div><div class="mail-line"></div>
            <div class="attachment"><span class="attachment-file">PDF</span><span><strong> payslip-{{ placeholderLabel }}.pdf</strong><small>One file for this recipient</small></span></div>
          </div>
          <div class="window-bottom"><span>SMTP connection</span><span class="connection-dot"></span><strong>Connected</strong></div>
        </div>
        <span class="proof-caption">One campaign. A message and document for each person.</span>
      </div>
    </section>
  `,
})
export class LandingHeroComponent {
  readonly copy = input.required<HomeCopy>();
  protected readonly placeholderLabel = '{{name}}';
  protected readonly titleParts = computed(() => {
    const title = this.copy().hero.title.trim();
    const lastSpace = title.lastIndexOf(' ');
    return { lead: lastSpace < 0 ? '' : title.slice(0, lastSpace), accent: title.slice(lastSpace + 1) };
  });
  protected readonly config = inject(LANDING_CONFIG);
}

@Component({
  selector: 'landing-audience',
  standalone: true,
  imports: [Pressed],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="audience" aria-labelledby="audience-title">
      <div class="audience-inner section-shell">
        <h2 id="audience-title">{{ copy().audience.title }}</h2>
        <ul class="audience-list">
          @for (item of copy().audience.items; track item) { <li appPressed>{{ item }}</li> }
        </ul>
      </div>
    </section>
  `,
})
export class LandingAudienceComponent { readonly copy = input.required<HomeCopy>(); }

@Component({
  selector: 'landing-how',
  standalone: true,
  imports: [Pressed],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="section-shell section-block" id="how-it-works" aria-labelledby="how-title">
      <div class="section-heading"><p class="section-kicker">A CLEAR WORKFLOW</p><h2 id="how-title">{{ copy().how.title }}</h2></div>
      <ol class="steps-list">
        @for (step of copy().how.steps; track step.title; let i = $index) {
          <li appPressed><span class="step-index" aria-hidden="true">0{{ i + 1 }}</span><h3>{{ step.title }}</h3><p>{{ step.body }}</p></li>
        }
      </ol>
    </section>
  `,
})
export class LandingHowComponent { readonly copy = input.required<HomeCopy>(); }

@Component({
  selector: 'landing-features',
  standalone: true,
  imports: [Pressed],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="feature-section" id="features" aria-labelledby="features-title">
      <div class="section-shell section-block">
        <div class="section-heading"><p class="section-kicker">MADE FOR REPEATABLE WORK</p><h2 id="features-title">{{ copy().features.title }}</h2></div>
        <div class="feature-list">
          @for (feature of copy().features.items; track feature.title; let i = $index) {
            <article class="feature-item" appPressed><span class="feature-index" aria-hidden="true">{{ i + 1 < 10 ? '0' : '' }}{{ i + 1 }}</span><div><h3>{{ feature.title }}</h3><p>{{ feature.body }}</p></div></article>
          }
        </div>
      </div>
    </section>
  `,
})
export class LandingFeaturesComponent { readonly copy = input.required<HomeCopy>(); }

@Component({
  selector: 'landing-pdf-showcase',
  standalone: true,
  imports: [Pressed],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="pdf-showcase section-shell" aria-labelledby="pdf-title">
      <div class="pdf-copy"><p class="section-kicker">A PERSONAL FILE, PER PERSON</p><h2 id="pdf-title">{{ copy().pdf.title }}</h2><p>{{ copy().pdf.body }}</p></div>
      <div class="pdf-stage" aria-label="Illustrative PDF template layout">
        <div class="paper-sheet" appPressed>
          <div class="paper-brand">Slipakar <span>{{ copy().pdf.documentTitle }}</span></div>
          <div class="paper-recipient"><strong>{{ placeholderLabel }}</strong><small>Personalized recipient field</small></div>
          <div class="paper-table-head"><span>DESCRIPTION</span><span>AMOUNT</span></div>
          @for (row of copy().pdf.rows; track row) { <div class="paper-row"><span>{{ row }}</span><span>••••••</span></div> }
          <div class="paper-total"><strong>{{ copy().pdf.total }}</strong><b>••••••</b></div>
          <div class="paper-footer">Illustrative layout · Values hidden</div>
        </div>
        <span class="pdf-stage-note">CSS illustration of a reusable PDF template</span>
      </div>
    </section>
  `,
})
export class LandingPdfShowcaseComponent {
  readonly copy = input.required<HomeCopy>();
  protected readonly placeholderLabel = '{{name}}';
}

@Component({
  selector: 'landing-security',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="security-section" aria-labelledby="security-title">
      <div class="section-shell security-layout">
        <div class="security-intro"><p class="section-kicker">CONTROL STAYS WITH YOU</p><h2 id="security-title">{{ copy().security.title }}</h2></div>
        <ul class="security-list">@for (item of copy().security.items; track item) { <li><span class="check-mark" aria-hidden="true"></span>{{ item }}</li> }</ul>
      </div>
    </section>
  `,
})
export class LandingSecurityComponent { readonly copy = input.required<HomeCopy>(); }

@Component({
  selector: 'landing-self-host',
  standalone: true,
  imports: [Pressed],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="self-host section-shell" id="self-host" aria-labelledby="self-host-title">
      <div class="self-host-copy"><p class="section-kicker">SELF-HOSTED BY DESIGN</p><h2 id="self-host-title">{{ copy().selfHost.title }}</h2><p>{{ copy().selfHost.body }}</p><a class="text-link" [href]="config.docsUrl">{{ copy().selfHost.guide }} <span class="arrow-mark" aria-hidden="true"></span></a></div>
      <div class="command-panel" appPressed><div class="command-top"><span>{{ copy().selfHost.codeLabel }}</span><span>Docker</span></div><pre><code>docker compose up -d --build</code></pre><p>Configure your own SMTP server and deployment environment.</p></div>
    </section>
  `,
})
export class LandingSelfHostComponent {
  readonly copy = input.required<HomeCopy>();
  protected readonly config = inject(LANDING_CONFIG);
}

@Component({
  selector: 'landing-open-source',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="open-source section-shell" id="open-source" aria-labelledby="open-source-title">
      <p class="section-kicker">BUILT IN THE OPEN</p><h2 id="open-source-title">{{ copy().openSource.title }}</h2><p>{{ copy().openSource.body }}</p>
      <div class="source-links"><a class="text-link" [href]="config.repoUrl" target="_blank" rel="noopener noreferrer">{{ copy().openSource.repository }} <span class="arrow-mark" aria-hidden="true"></span></a><span>{{ copy().openSource.license }}</span></div>
    </section>
  `,
})
export class LandingOpenSourceComponent {
  readonly copy = input.required<HomeCopy>();
  protected readonly config = inject(LANDING_CONFIG);
}

@Component({
  selector: 'landing-faq',
  standalone: true,
  imports: [Pressed],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="faq-section" aria-labelledby="faq-title">
      <div class="section-shell faq-layout"><div class="section-heading"><p class="section-kicker">GOOD TO KNOW</p><h2 id="faq-title">{{ copy().faq.title }}</h2></div>
        <div class="faq-list">@for (item of copy().faq.items; track item.question) { <details appPressed><summary>{{ item.question }}</summary><p>{{ item.answer }}</p></details> }</div>
      </div>
    </section>
  `,
})
export class LandingFaqComponent { readonly copy = input.required<HomeCopy>(); }

@Component({
  selector: 'landing-footer',
  standalone: true,
  imports: [Pressed],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <footer class="site-footer" id="get-started"><div class="section-shell footer-main"><div><p class="section-kicker">SLIPAKAR</p><h2>{{ copy().final.title }}</h2><p>{{ copy().final.body }}</p><a appPressed class="button button-primary" [href]="config.appUrl">{{ copy().final.signIn }} <span class="arrow-mark" aria-hidden="true"></span></a></div>
      <div class="footer-links"><a appPressed [href]="termsPath()">{{ copy().final.terms }}</a><a appPressed [href]="config.repoUrl" target="_blank" rel="noopener noreferrer">{{ copy().final.repository }}</a></div>
    </div><div class="section-shell footer-bottom"><span>© Slipakar</span><span>Open source · Apache-2.0</span></div></footer>
  `,
})
export class LandingFooterComponent {
  readonly copy = input.required<HomeCopy>();
  readonly language = input.required<'en' | 'id'>();
  protected readonly config = inject(LANDING_CONFIG);
  protected termsPath(): string { return this.language() === 'en' ? '/terms' : '/id/terms'; }
}

export const HOME_SECTION_COMPONENTS = [
  LandingHeaderComponent,
  LandingHeroComponent,
  LandingAudienceComponent,
  LandingHowComponent,
  LandingFeaturesComponent,
  LandingPdfShowcaseComponent,
  LandingSecurityComponent,
  LandingSelfHostComponent,
  LandingOpenSourceComponent,
  LandingFaqComponent,
  LandingFooterComponent,
] as const;
