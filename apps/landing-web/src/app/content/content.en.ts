import { LandingDictionary } from './content.types';

export const contentEn: LandingDictionary = {
  language: 'en',
  languageName: 'English',
  home: {
    metadata: {
      title: 'Slipakar — Self-hosted personalized bulk email',
      description: 'Send personalized bulk email through your own SMTP server, with optional per-recipient PDF attachments such as payslips.',
      path: '/',
    },
    nav: { how: 'How it works', features: 'Features', signIn: 'Sign in' },
    hero: {
      title: 'Personalized email, sent from your own infrastructure.',
      description: 'Slipakar helps HR, finance, and operations send bulk email through the company’s own SMTP server, with an optional personalized PDF for every recipient.',
      signIn: 'Sign in',
      selfHost: 'Self-hosting guide',
    },
    audience: {
      title: 'Built for the work that has to reach everyone personally.',
      items: ['HR teams sending employee payslips and notices', 'Finance teams distributing recipient-specific documents', 'Operations teams sending updates from a spreadsheet'],
    },
    how: {
      title: 'From a spreadsheet to a campaign in four steps.',
      steps: [
        { title: 'Upload', body: 'Bring recipient data from CSV, XLSX, or JSON.' },
        { title: 'Map', body: 'Connect file columns to the placeholders in your email and PDF templates.' },
        { title: 'Preview', body: 'Check the personalized result before the campaign is sent.' },
        { title: 'Send', body: 'Queue the campaign and follow per-recipient delivery status.' },
      ],
    },
    features: {
      title: 'The pieces for a careful bulk send.',
      items: [
        { title: 'Projects and SMTP', body: 'Keep SMTP connections and campaign resources organized per project. Credentials are encrypted at rest.' },
        { title: 'Safe email templates', body: 'Personalize messages with simple {{placeholder}} fields. Template text is substituted, never evaluated as code.' },
        { title: 'Uploads and field mapping', body: 'Use CSV, XLSX, or JSON recipient data, then map columns to the fields your templates use.' },
        { title: 'PDF template builder', body: 'Build personalized PDF layouts with text, table, image, and divider nodes.' },
        { title: 'Background campaigns', body: 'RabbitMQ queues sending work; Redis rate limits SMTP connections and transient SMTP failures are retried.' },
        { title: 'Status and notifications', body: 'Track each recipient and see campaign notifications and login activity.' },
      ],
    },
    pdf: {
      title: 'A payslip can be part of the message, not a separate task.',
      body: 'Create a reusable PDF layout and attach a version personalized for each recipient.',
      documentTitle: 'PAYSLIP · APRIL',
      rows: ['Base salary', 'Allowance', 'Tax and deductions'],
      total: 'Net pay',
    },
    security: {
      title: 'Your mail server. Your data. Your deployment.',
      items: [
        'Connect through your own SMTP server; SMTP credentials are encrypted at rest.',
        'Self-host Slipakar on infrastructure you operate.',
        'Placeholders perform simple substitution and never run template code.',
        'Disabling an account revokes its sessions immediately.',
      ],
    },
    selfHost: {
      title: 'Run it where your organization works.',
      body: 'Deploy the application with Docker and keep control of the service and its data.',
      guide: 'Read the self-hosting guide',
      codeLabel: 'Start the stack',
    },
    openSource: {
      title: 'Open source under Apache-2.0.',
      body: 'Review the source, run Slipakar yourself, and adapt your deployment to your organization.',
      license: 'Apache-2.0 license',
      repository: 'View the repository',
    },
    faq: {
      title: 'Questions, answered plainly.',
      items: [
        { question: 'What is Slipakar?', answer: 'Slipakar is an open-source, self-hostable platform for personalized bulk email sent through a company’s own SMTP server.' },
        { question: 'Can each recipient get a different PDF?', answer: 'Yes. A campaign can attach a personalized PDF, such as a payslip, for each recipient.' },
        { question: 'Which data file formats can I upload?', answer: 'Slipakar supports CSV, XLSX, and JSON files.' },
        { question: 'Do email placeholders execute code?', answer: 'No. Email templates use safe placeholder substitution; they do not evaluate expressions or code.' },
        { question: 'How are campaigns sent?', answer: 'Campaign work is queued through RabbitMQ and sent in the background, with per-recipient status and retries for transient SMTP failures.' },
        { question: 'Where are SMTP credentials stored?', answer: 'SMTP credentials are encrypted at rest with the application encryption key and are not returned in API views.' },
        { question: 'Can we host Slipakar ourselves?', answer: 'Yes. Slipakar is designed to be self-hosted and is deployed with Docker.' },
      ],
    },
    final: {
      title: 'Send personalized email on your terms.',
      body: 'Start with your own SMTP server and the recipient data you already have.',
      signIn: 'Sign in to Slipakar',
      terms: 'Terms',
      repository: 'Repository',
    },
  },
  terms: {
    metadata: { title: 'Terms of use — Slipakar', description: 'The terms for using Slipakar, the open-source platform for personalized bulk email and PDF attachments.', path: '/terms' },
    kicker: 'LEGAL',
    heading: 'Terms of use',
    intro: 'These terms explain how Slipakar, an open-source platform for personalized bulk email, may be used.',
    sections: [
      { title: 'Using Slipakar', body: ['Slipakar is self-hosted software. Each organization runs its own deployment and decides who may sign in, which SMTP server is used and how data is stored.', 'By using a Slipakar deployment you agree to follow the rules of the organization that runs it and of your email provider.'] },
      { title: 'Acceptable use', body: ['Send only messages, spreadsheets and attachments that you are authorized to process.', 'Do not use Slipakar to send unsolicited bulk email, to impersonate others, or to break the law or the rules of your SMTP provider.'] },
      { title: 'Your data and files', body: ['Recipient data, templates and generated PDFs stay on the infrastructure of the organization that runs the deployment. That organization is responsible for access controls, backups and how long data is kept.'] },
      { title: 'Software license and no warranty', body: ['Slipakar is released under the Apache License 2.0 and is provided as is, without warranties of any kind. Read the license file in the repository for the full terms.'] },
      { title: 'Changes and contact', body: ['These terms may be updated from time to time. For questions about a deployment, contact the organization that runs it. For questions about the software, use the project repository.'] },
    ],
    homeLabel: 'Back to Slipakar',
  },
  notFound: {
    kicker: '404 · NOT FOUND',
    title: 'This page isn’t here.',
    body: 'The address may be outdated or the page may have moved.',
    homeLabel: 'Return to Slipakar',
  },
};
