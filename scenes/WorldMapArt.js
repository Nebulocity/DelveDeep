import { TILE, AREA_COLUMNS, AREA_ROWS, areas, nodePoint, pois } from '../data/worldMap.js';
import { terrainCorners, terrainVertex, decorationPlan, roadSegments } from '../data/worldMapArt.js';
import forestMetadata from '../assets/world-map/forest.json';
import meadowMetadata from '../assets/world-map/meadow.json';
import riverMetadata from '../assets/world-map/river.json';

const METADATA = { forest: forestMetadata, meadow: meadowMetadata, river: riverMetadata };
const CORNERS = ['NW', 'NE', 'SE', 'SW'];
const SHADES = ['7e9584', 'b1b7a1', 'a3b5c2', '97b382', 'd2c395', '90b4b0', '8a9192', 'dcc199', 'a4b9b3']
  .map((hex) => [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16)));
const TILE_RECTS = Object.fromEntries(Object.entries(METADATA).map(([name, metadata]) => [name,
  Object.fromEntries(metadata.tileset_data.tiles.map((tile) => [
    CORNERS.map((corner) => Number(tile.corners[corner] === 'upper')).join(''), tile.bounding_box
  ]))]));

function paintTile(scene, context, terrain, x, y, dx, dy) {
  const rect = TILE_RECTS[terrain][terrainCorners(terrain, x, y).join('')];
  const source = scene.textures.get(`map-terrain-${terrain}`).getSourceImage();
  context.drawImage(source, rect.x, rect.y, rect.width, rect.height, dx, dy, 32, 32);
}

function regionalShade(x, y) {
  const axis = (position, size) => position < size - 4 ? [0, 0, 0]
    : position < size + 4 ? [0, 1, (position - size + 4) / 8]
      : position < size * 2 - 4 ? [1, 1, 0]
        : position < size * 2 + 4 ? [1, 2, (position - size * 2 + 4) / 8] : [2, 2, 0];
  const [c0, c1, tx] = axis(x, 40), [r0, r1, ty] = axis(y, 24);
  const color = [0, 1, 2].map((channel) => {
    const top = SHADES[r0 * 3 + c0][channel] * (1 - tx) + SHADES[r0 * 3 + c1][channel] * tx;
    const bottom = SHADES[r1 * 3 + c0][channel] * (1 - tx) + SHADES[r1 * 3 + c1][channel] * tx;
    return Math.round(top * (1 - ty) + bottom * ty);
  });
  return `rgb(${color.join(',')})`;
}

function terrainChunk(scene, area) {
  const key = `map-chunk-${area.id}`;
  if (!scene.textures.exists(key)) {
    const texture = scene.textures.createCanvas(key, AREA_COLUMNS * 32, AREA_ROWS * 32);
    const context = texture.context;
    context.imageSmoothingEnabled = false;
    context.filter = 'saturate(0.55)';
    for (let y = 0; y < AREA_ROWS; y++) for (let x = 0; x < AREA_COLUMNS; x++) {
      const gx = area.column * AREA_COLUMNS + x, gy = area.row * AREA_ROWS + y;
      const terrains = ['forest', 'meadow', 'river'];
      paintTile(scene, context, terrains[area.column], gx, gy, x * 32, y * 32);

      // Blend the same global coordinates on both sides of regional boundaries.
      const boundary = area.column === 0 ? 40 : area.column === 2 ? 80 : gx < 60 ? 40 : 80;
      if (Math.abs(gx - boundary) < 4) {
        const left = boundary === 40 ? 'forest' : 'meadow';
        const right = boundary === 40 ? 'meadow' : 'river';
        context.globalAlpha = 1;
        paintTile(scene, context, left, gx, gy, x * 32, y * 32);
        context.globalAlpha = (gx - boundary + 4) / 8;
        paintTile(scene, context, right, gx, gy, x * 32, y * 32);
        context.globalAlpha = 1;
      }
      context.filter = 'none';
      context.globalCompositeOperation = 'multiply';
      context.fillStyle = regionalShade(gx, gy);
      context.fillRect(x * 32, y * 32, 32, 32);
      context.globalCompositeOperation = 'source-over';
      context.filter = 'saturate(0.55)';
    }
    texture.refresh();
    texture.setFilter(1);
  }
  scene.add.image(area.column * AREA_COLUMNS * TILE, area.row * AREA_ROWS * TILE, key)
    .setOrigin(0).setScale(2).setDepth(-100);
}

function paintRoads(scene) {
  const key = 'map-road-network';
  if (!scene.textures.exists(key)) {
    const texture = scene.textures.createCanvas(key, 3840, 2304);
    const context = texture.context;
    const segments = roadSegments();
    context.lineCap = 'round';
    context.lineJoin = 'round';
    const stroke = (color, width) => {
      context.strokeStyle = color;
      context.lineWidth = width;
      context.beginPath();
      for (const { a, b } of segments) {
        context.moveTo(a.x / 2, a.y / 2);
        context.lineTo(b.x / 2, b.y / 2);
      }
      context.stroke();
    };
    stroke('#26382ee0', 66);
    stroke('#68573e', 56);
    stroke('#b39362', 48);
    const pattern = document.createElement('canvas');
    pattern.width = 64;
    pattern.height = 64;
    pattern.getContext('2d').drawImage(scene.textures.get('map-road-earth').getSourceImage(), 0, 0);
    stroke(context.createPattern(pattern, 'repeat'), 44);

    // Stopping plazas widen the road around each destination without hiding junctions.
    for (const poi of pois) {
      const point = nodePoint(poi.node);
      context.fillStyle = '#6b593e';
      context.beginPath(); context.arc(point.x / 2, point.y / 2, 58, 0, Math.PI * 2); context.fill();
      context.fillStyle = context.createPattern(pattern, 'repeat');
      context.beginPath(); context.arc(point.x / 2, point.y / 2, 51, 0, Math.PI * 2); context.fill();
    }
    texture.refresh();
    texture.setFilter(1);
  }
  scene.add.image(0, 0, key).setOrigin(0).setScale(2).setDepth(-20);
}

function bridges(scene) {
  const graphic = scene.add.graphics().setDepth(-15);
  const planks = [];
  for (const { a, b } of roadSegments()) {
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const nx = -(b.y - a.y) / length, ny = (b.x - a.x) / length;
    for (let t = 0.02; t < 1; t += 0.015) {
      const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
      if (x < 80 * TILE || !terrainVertex('river', x / TILE - 0.5, y / TILE - 0.5)) continue;
      graphic.lineStyle(126, 0x4a352c).lineBetween(x - (b.x - a.x) * 0.008, y - (b.y - a.y) * 0.008,
        x + (b.x - a.x) * 0.008, y + (b.y - a.y) * 0.008);
      graphic.lineStyle(100, 0xb08b59).lineBetween(x - (b.x - a.x) * 0.008, y - (b.y - a.y) * 0.008,
        x + (b.x - a.x) * 0.008, y + (b.y - a.y) * 0.008);
      planks.push({ x, y, nx, ny });
    }
  }
  graphic.lineStyle(3, 0x715337);
  for (const { x, y, nx, ny } of planks) graphic.lineBetween(x - nx * 47, y - ny * 47, x + nx * 47, y + ny * 47);
}

export function drawRegionalWorld(scene) {
  for (const area of areas) terrainChunk(scene, area);
  for (const prop of decorationPlan()) scene.add.image(prop.x, prop.y, prop.texture)
    .setDisplaySize(prop.size, prop.size).setTint(prop.tint).setDepth(-40);
  paintRoads(scene);
  bridges(scene);
}
