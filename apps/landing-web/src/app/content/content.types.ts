export interface PageMetadata {
  title: string;
  description: string;
  path: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface HomeCopy {
  metadata: PageMetadata;
  nav: { how: string; features: string; signIn: string };
  hero: {
    title: string;
    description: string;
    signIn: string;
    selfHost: string;
    connectionStatus: { connected: string; disconnected: string; checking: string };
  };
  audience: { title: string; items: string[] };
  how: { title: string; steps: Array<{ title: string; body: string }> };
  features: { title: string; items: Array<{ title: string; body: string }> };
  pdf: { title: string; body: string; documentTitle: string; rows: string[]; total: string };
  security: { title: string; items: string[] };
  selfHost: { title: string; body: string; guide: string; codeLabel: string };
  openSource: { title: string; body: string; license: string; repository: string };
  faq: { title: string; items: FaqItem[] };
  final: { title: string; body: string; signIn: string; terms: string; repository: string };
}

export interface LegalCopy {
  metadata: PageMetadata;
  kicker: string;
  heading: string;
  intro: string;
  sections: Array<{ title: string; body: string[] }>;
  homeLabel: string;
}

export interface NotFoundCopy {
  kicker: string;
  title: string;
  body: string;
  homeLabel: string;
}

export interface LandingDictionary {
  language: 'en' | 'id';
  languageName: string;
  home: HomeCopy;
  terms: LegalCopy;
  notFound: NotFoundCopy;
}
