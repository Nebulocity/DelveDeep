import Phaser from 'phaser';
import { UI_FONT_SIZES, UI_FONT_FAMILIES, UI_FONT_WEIGHTS } from '../config/uiTypography.js';
import { bindButtonPress } from './ButtonPress.js';
import HapticsService from '../services/HapticsService.js';

export const SERVICE_STYLE = Object.freeze({ text: '#fff1d2', muted: '#c6bdac', gold: 0xd3a750, bright: 0xffdb86 });
export const SERVICE_ICONS = Object.freeze({
  Alchemist: 'shop-cauldron', Blacksmith: 'shop-anvil', Enchanter: 'town-hub-abilities',
  all: 'town-hub-items', weapon: 'town-hub-equipment', armor: 'shop-armor',
  accessory: 'shop-accessory', potion: 'shop-potion', material: 'shop-material', scroll: 'shop-scroll'
});
const ICONS = ['potion', 'mana-potion', 'armor', 'accessory', 'material', 'scroll', 'anvil', 'cauldron'];

export function preloadServiceAssets(scene) {
  for (const name of ICONS) {
    if (!scene.textures.exists(`shop-${name}`)) {
      scene.load.image(`shop-${name}`, new URL(`../assets/ui/town-services/${name}.png`, import.meta.url).href);
    }
  }
}

export function serviceText(scene, x, y, value, slot = 'body34', options = {}) {
  return scene.add.text(x, y, value, {
    fontFamily: UI_FONT_FAMILIES.serif, fontSize: UI_FONT_SIZES[slot],
    color: SERVICE_STYLE.text, stroke: '#11161b', strokeThickness: 2, ...options
  });
}

// Scale the painted corners as a unit before stretching the dark center. Compact
// controls keep smaller ornaments; large room panels retain the full gold carvings.
export function serviceFrame(scene, x, y, width, height, kind = 'panel', ornamentScale = 1) {
  const slices = { panel: [128, 128, 0.42], bar: [100, 42, 0.65],
    option: [90, 62, 0.52], selected: [50, 50, 0.62], capsule: [100, 35, 0.72] };
  const [horizontal, vertical, baseScale] = slices[kind];

  // Dense dialogs can reduce the painted ornaments without shrinking text or hit areas.
  const scale = baseScale * ornamentScale;
  if (scene.game.renderer.type === Phaser.WEBGL) {
    const frame = scene.add.nineslice(x, y, `town-hub-${kind}`, undefined,
      width / scale, height / scale, horizontal, horizontal, vertical, vertical).setScale(scale);
    frame.hidePressShadow = true;
    return frame;
  }

  // Nine ordinary images preserve the same corners on the Canvas renderer.
  const texture = scene.textures.get(`town-hub-${kind}`);
  const source = texture.getSourceImage();
  const columns = [horizontal, source.width - horizontal * 2, horizontal];
  const rows = [vertical, source.height - vertical * 2, vertical];
  const widths = [horizontal * scale, width - horizontal * scale * 2, horizontal * scale];
  const heights = [vertical * scale, height - vertical * scale * 2, vertical * scale];
  const pieces = [];
  let sy = 0, dy = -height / 2;
  for (let row = 0; row < 3; row++) {
    let sx = 0, dx = -width / 2;
    for (let col = 0; col < 3; col++) {
      const name = `service-${row}-${col}`;
      if (!texture.has(name)) texture.add(name, 0, sx, sy, columns[col], rows[row]);
      pieces.push(scene.add.image(dx, dy, texture.key, name).setOrigin(0).setDisplaySize(widths[col], heights[row]));
      sx += columns[col];
      dx += widths[col];
    }
    sy += rows[row];
    dy += heights[row];
  }
  const frame = scene.add.container(x, y, pieces).setSize(width, height);
  frame.hidePressShadow = true;
  return frame;
}

function catalogTexture(scene) {
  const key = 'town-service-charcoal';
  if (!scene.textures.exists(key)) {
    const source = scene.textures.get('town-hub-panel').getSourceImage();
    const texture = scene.textures.createCanvas(key, 128, 128);
    texture.context.drawImage(source, source.width / 2 - 64, source.height / 2 - 64, 128, 128, 0, 0, 128, 128);
    texture.refresh();
  }
  return key;
}

// Catalog cards use the same illustrated charcoal texture with fine trim. Rarity
// stays on the left edge; gold marks selection independently of item quality.
export function serviceCard(scene, x, y, width, height, { selected = false, rarity, track = false } = {}) {
  const face = scene.add.tileSprite(0, 0, width, height, catalogTexture(scene));
  const edge = scene.add.graphics();
  const card = scene.add.container(x, y, [face, edge]).setSize(width, height);
  card.hidePressShadow = true;
  card.setSelected = active => {
    edge.clear().lineStyle(active ? 3 : 1.5, active ? SERVICE_STYLE.bright : SERVICE_STYLE.gold, active ? 1 : 0.48)
      .strokeRect(-width / 2 + 1, -height / 2 + 1, width - 2, height - 2);
    if (rarity) edge.fillStyle(Number.parseInt(rarity.replace('#', ''), 16), 0.95).fillRect(-width / 2 + 3, -height / 2 + 12, 4, height - 24);
    if (active || track) edge.fillStyle(SERVICE_STYLE.bright, active ? 0.07 : 0.22).fillRect(-width / 2 + 3, -height / 2 + 3, width - 6, height - 6);
    return card;
  };
  return card.setSelected(selected);
}

export function serviceScrollSurface(scene, x, y, width, height, variant) {
  return serviceCard(scene, x, y, width, height, { track: variant === 'thumb' });
}

export function serviceIcon(scene, key, x, y, size = 64) {
  return scene.add.image(x, y, key).setDisplaySize(size, size);
}

// Fixed hit areas use the project's existing release/drag/blur cancellation behavior.
export function serviceButton(scene, x, y, width, height, label, onTap, options = {}) {
  const { selected = false, enabled = true, compact = false, depth = 0, name, icon } = options;
  const face = (compact ? serviceCard(scene, x, y, width, height, { selected })
    : serviceFrame(scene, x, y, width, height, selected ? 'selected' : 'option')).setDepth(depth).setAlpha(enabled ? 1 : 0.5);
  const caption = serviceText(scene, x + (icon ? 22 : 0), y, label, options.slot ?? 'body34', {
    fontStyle: UI_FONT_WEIGHTS.bold, align: 'center', wordWrap: { width: width - (icon ? 100 : 36) },
    maxLines: options.maxLines ?? (height < 80 ? 1 : 2),
    color: enabled ? SERVICE_STYLE.text : '#99958d'
  }).setOrigin(0.5).setDepth(depth + 2);
  const visuals = [face, caption];
  if (icon) visuals.push(serviceIcon(scene, icon, x - width / 2 + 42, y, 58).setDepth(depth + 2));
  const hit = scene.add.rectangle(x, y, width - 4, height - 4, 0, 0).setDepth(depth + 1).setName(name ?? label);
  if (enabled) {
    hit.setInteractive({ useHandCursor: true });
    hit.pressVisuals = visuals;
    bindButtonPress(scene, hit, [], () => {
      if (options.haptic !== false) HapticsService.tap();
      onTap?.();
    });
    hit.on('pointerover', () => face.setAlpha(0.86)).on('pointerout', () => face.setAlpha(1));
    const cancelDrag = pointer => {
      if (pointer.isDown && Math.hypot(pointer.x - pointer.downX, pointer.y - pointer.downY) > 24) hit.emit('pointerout');
    };
    scene.input.on('pointermove', cancelDrag);
    hit.once('destroy', () => scene.input.off('pointermove', cancelDrag));
  }
  return { target: hit, face, caption, visuals };
}
