import { describe, expect, it } from 'vitest';
import { PLACEHOLDER_REGEX } from './placeholder.js';

describe('PLACEHOLDER_REGEX', () => {
  it('matches a placeholder in text and captures its identifier', () => {
    const matches = [...'Hi {{name}}'.matchAll(PLACEHOLDER_REGEX)];

    expect(matches).toHaveLength(1);
    expect(matches[0]?.[0]).toBe('{{name}}');
    expect(matches[0]?.[1]).toBe('name');
  });

  it('allows inner spaces and captures the identifier without them', () => {
    const matches = [...'{{ period }}'.matchAll(PLACEHOLDER_REGEX)];

    expect(matches).toHaveLength(1);
    expect(matches[0]?.[1]).toBe('period');
  });

  it('does not match a Handlebars block', () => {
    expect([... '{{#if x}}'.matchAll(PLACEHOLDER_REGEX)]).toHaveLength(0);
  });

  it('does not match triple braces', () => {
    expect([... '{{{raw}}}'.matchAll(PLACEHOLDER_REGEX)]).toHaveLength(0);
  });
});
