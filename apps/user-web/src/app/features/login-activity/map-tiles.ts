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
