export type MapZoom = 8 | 9 | 10;
export type LoginMapTile = {
  key: string;
  x: number;
  y: number;
  url: string;
  center: boolean;
  markerLeft: number;
  markerTop: number;
};

const latitudeLimit = 85.05112878;
const displayedTileSize = 112;

export function getMapTiles(latitude: number, longitude: number, zoom: MapZoom = 9): LoginMapTile[] {
  const tileCount = 2 ** zoom;
  const boundedLatitude = Math.max(-latitudeLimit, Math.min(latitudeLimit, latitude));
  const latitudeRadians = (boundedLatitude * Math.PI) / 180;
  const worldX = ((longitude + 180) / 360) * tileCount;
  const worldY =
    ((1 - Math.log(Math.tan(latitudeRadians) + 1 / Math.cos(latitudeRadians)) / Math.PI) / 2) * tileCount;
  const centerX = Math.floor(worldX);
  const centerY = Math.floor(worldY);
  const markerLeft = (worldX - centerX) * displayedTileSize;
  const markerTop = (worldY - centerY) * displayedTileSize;
  const tiles: LoginMapTile[] = [];

  for (let row = -1; row <= 1; row += 1) {
    for (let column = -1; column <= 1; column += 1) {
      const x = ((centerX + column) % tileCount + tileCount) % tileCount;
      const y = Math.max(0, Math.min(tileCount - 1, centerY + row));
      const center = row === 0 && column === 0;
      tiles.push({
        key: `${zoom}-${x}-${y}`,
        x,
        y,
        url: `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`,
        center,
        markerLeft: center ? markerLeft : 0,
        markerTop: center ? markerTop : 0,
      });
    }
  }

  return tiles;
}

export type MapViewTile = { key: string; url: string; left: number; top: number };
export type MapView = { tiles: MapViewTile[]; markerLeft: number; markerTop: number };
export const MAP_MIN_ZOOM = 3;
export const MAP_MAX_ZOOM = 17;
const viewTileSize = 256;
const viewSpan = 3;

/** Tiles around the point at full 256px size; markerLeft/markerTop is the point's pixel position inside the tile grid. */
export function getMapView(latitude: number, longitude: number, zoom: number): MapView {
  const z = Math.max(MAP_MIN_ZOOM, Math.min(MAP_MAX_ZOOM, Math.round(zoom)));
  const tileCount = 2 ** z;
  const lat = Math.max(-latitudeLimit, Math.min(latitudeLimit, latitude));
  const rad = (lat * Math.PI) / 180;
  const worldX = ((longitude + 180) / 360) * tileCount;
  const worldY = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * tileCount;
  const centerX = Math.floor(worldX);
  const centerY = Math.floor(worldY);
  const tiles: MapViewTile[] = [];
  for (let row = -viewSpan; row <= viewSpan; row += 1) {
    const y = centerY + row;
    if (y < 0 || y >= tileCount) continue;
    for (let column = -viewSpan; column <= viewSpan; column += 1) {
      const x = (((centerX + column) % tileCount) + tileCount) % tileCount;
      tiles.push({ key: `${z}-${column}-${row}`, url: `https://tile.openstreetmap.org/${z}/${x}/${y}.png`, left: (column + viewSpan) * viewTileSize, top: (row + viewSpan) * viewTileSize });
    }
  }
  return { tiles, markerLeft: (viewSpan + (worldX - centerX)) * viewTileSize, markerTop: (viewSpan + (worldY - centerY)) * viewTileSize };
}
