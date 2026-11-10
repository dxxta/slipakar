import { describe, expect, it } from 'vitest';
import { routes } from './app.routes';

describe('public routes', () => {
  it('keeps only the home, localized home, and terms pages before the not-found fallback', () => {
    expect(routes.map((route) => route.path)).toEqual(['', 'id', 'terms', 'id/terms', 'not-found', '**']);
  });
});
