import { describe, expect, it } from 'vitest';
import { assertSafeTemplate, extractPlaceholders, renderTemplate, UnresolvedPlaceholderError } from './template-renderer.js';

describe('extractPlaceholders', () => {
  it('returns unique names in first-seen order with spaces allowed inside braces', () => {
    expect(extractPlaceholders('{{ first }} {{second}} {{first}} {{ third }}')).toEqual(['first', 'second', 'third']);
  });
});

describe('assertSafeTemplate', () => {
  it.each(['{{{name}}}', '{{#each rows}}', '{{/each}}', '{{>part}}', '{{!comment}}', '{{&name}}', '{{^name}}', '{{ a.b }}', '{{ a b }}', '{{}}'])(
    'rejects %s', (text) => {
      expect(() => assertSafeTemplate(text)).toThrowError(expect.objectContaining({ status: 400, code: 'UNSAFE_TEMPLATE' }));
    },
  );

  it('accepts dollar-brace text as literal', () => {
    expect(() => assertSafeTemplate('Hello ${name}')).not.toThrow();
  });
});

describe('renderTemplate', () => {
  it('fills subject and escapes HTML in the body', () => {
    expect(renderTemplate({ subject: 'Hello {{name}}', bodyHtml: '<p>{{name}}</p>' }, { name: '<script>alert(1)</script>' })).toEqual({
      subject: 'Hello <script>alert(1)</script>',
      body: '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>',
    });
  });

  it('replaces CR and LF in subject values with one space', () => {
    expect(renderTemplate({ subject: 'Hi {{name}}', bodyHtml: 'ok' }, { name: 'A\r\nB' }).subject).toBe('Hi A B');
  });

  it('lists all missing names', () => {
    expect(() => renderTemplate({ subject: '{{first}}', bodyHtml: '{{second}}' }, {})).toThrowError(
      expect.objectContaining<Partial<UnresolvedPlaceholderError>>({ missingNames: ['first', 'second'] }),
    );
  });

  it.each(['constructor', '__proto__'])('does not read inherited key %s', (key) => {
    expect(() => renderTemplate({ subject: `{{${key}}}`, bodyHtml: 'ok' }, {})).toThrow(UnresolvedPlaceholderError);
  });

  it('does not re-expand replacement values', () => {
    expect(renderTemplate({ subject: '{{name}}', bodyHtml: '{{name}}' }, { name: '{{other}}', other: 'expanded' })).toEqual({
      subject: '{{other}}', body: '{{other}}',
    });
  });
});

describe('fillPlaceholders', () => {
  it('substitutes placeholders without html escaping', async () => {
    const { fillPlaceholders } = await import('./template-renderer.js');
    expect(fillPlaceholders('Hello {{name}} <tag> & "quote"', { name: '<script>alert(1)</script>' })).toBe(
      'Hello <script>alert(1)</script> <tag> & "quote"',
    );
  });

  it('throws UnresolvedPlaceholderError listing all missing names', async () => {
    const { fillPlaceholders } = await import('./template-renderer.js');
    expect(() => fillPlaceholders('{{first}} and {{second}}', {})).toThrowError(
      expect.objectContaining({ missingNames: ['first', 'second'] }),
    );
  });

  it('never re-scans substituted values', async () => {
    const { fillPlaceholders } = await import('./template-renderer.js');
    expect(fillPlaceholders('{{name}}', { name: '{{other}}', other: 'expanded' })).toBe('{{other}}');
  });

  it('ignores prototype keys using Object.hasOwn', async () => {
    const { fillPlaceholders } = await import('./template-renderer.js');
    expect(() => fillPlaceholders('{{constructor}}', {})).toThrow(UnresolvedPlaceholderError);
    expect(() => fillPlaceholders('{{__proto__}}', {})).toThrow(UnresolvedPlaceholderError);
  });
});
