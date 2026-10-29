import { PLACEHOLDER_REGEX } from '@lokaslip/shared';
import { AppError } from '../../../lib/app-error.js';

function placeholderRegex(): RegExp {
  return new RegExp(PLACEHOLDER_REGEX.source, PLACEHOLDER_REGEX.flags);
}

export function extractPlaceholders(text: string): string[] {
  return [...new Set([...text.matchAll(placeholderRegex())].map((match) => match[1]))];
}

export function assertSafeTemplate(text: string): void {
  const remainder = text.replace(placeholderRegex(), '');
  if (remainder.includes('{{') || remainder.includes('}}')) {
    throw new AppError(400, 'UNSAFE_TEMPLATE', 'Template contains unsafe placeholder syntax');
  }
}

export class UnresolvedPlaceholderError extends Error {
  constructor(public readonly missingNames: string[]) {
    super(`Unresolved placeholders: ${missingNames.join(', ')}`);
    this.name = 'UnresolvedPlaceholderError';
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const escaped: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return escaped[character];
  });
}

export function renderTemplate(
  template: { subject: string; bodyHtml: string },
  row: Record<string, string>,
): { subject: string; body: string } {
  assertSafeTemplate(template.subject);
  assertSafeTemplate(template.bodyHtml);
  const names = [...new Set([...extractPlaceholders(template.subject), ...extractPlaceholders(template.bodyHtml)])];
  const missingNames = names.filter((name) => !Object.hasOwn(row, name) || row[name] === undefined);
  if (missingNames.length > 0) throw new UnresolvedPlaceholderError(missingNames);

  return {
    subject: template.subject.replace(placeholderRegex(), (_match, name: string) => row[name].replace(/[\r\n]+/g, ' ')),
    body: template.bodyHtml.replace(placeholderRegex(), (_match, name: string) => escapeHtml(row[name])),
  };
}

export function fillPlaceholders(text: string, row: Record<string, string>): string {
  assertSafeTemplate(text);
  const names = extractPlaceholders(text);
  const missingNames = names.filter((name) => !Object.hasOwn(row, name) || row[name] === undefined);
  if (missingNames.length > 0) throw new UnresolvedPlaceholderError(missingNames);

  return text.replace(placeholderRegex(), (_match, name: string) => row[name]);
}
