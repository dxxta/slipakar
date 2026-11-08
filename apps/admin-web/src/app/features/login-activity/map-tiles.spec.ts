import { describe, expect, it } from 'vitest';
import { getMapTiles } from './map-tiles';

describe('getMapTiles', () => {
  it('returns a 3 by 3 zoom-9 grid centered on the supplied coordinates', () => {
    const tiles = getMapTiles(0, 0);

    expect(tiles).toHaveLength(9);
    expect(tiles.find((tile) => tile.center)).toMatchObject({ x: 256, y: 256, center: true });
    expect(tiles[0]?.url).toBe('https://tile.openstreetmap.org/9/255/255.png');
  });

  it('wraps tile columns across the antimeridian and clamps extreme latitude', () => {
    const tiles = getMapTiles(90, 180, 8);

    expect(tiles).toHaveLength(9);
    expect(tiles.some((tile) => tile.x === 0)).toBe(true);
    expect(tiles.every((tile) => tile.y >= 0 && tile.y < 256)).toBe(true);
  });
});
