import { worldMapParty, resolveWorldMapCharacter } from '../game/WorldMapCharacter.js';
import { CHARACTER_SPRITES } from '../data/characterSprites.js';
import { applyCharacterPose, characterDisplayMetrics } from './CharacterSpriteDisplay.js';
import { chooseWorldMapCharacter } from './WorldMapCharacterSelection.js';
import { addRegionPanel, addRegionButton } from './RegionMapTheme.js';
import { hallScroll } from './HallUI.js';
import { serviceScrollSurface } from './TownServiceTheme.js';
import { fontPx, UI_FONT_FAMILIES } from '../config/uiTypography.js';
import { playUiSound } from '../services/UiAudioService.js';

// Use the same idle clips, authored foot origins and display normalization as
// other character UI. Measure once, then change poses only on frame boundaries.
export function addMapCharacterPreview(scene, hero, x, y, size, depth) {
  const definition = CHARACTER_SPRITES[hero?.id];
  const clip = definition?.clips.idle.south;
  const first = clip?.frames[0];
  if (!first || !scene.textures.exists(first.key)) return null;
  const image = scene.add.image(0, 0, first.key, first.frame).setDepth(depth).setScrollFactor(0);
  const metrics = characterDisplayMetrics(scene, definition, 'townRoster',
    { source: clip, size, width: size, height: size });
  if (metrics) {
    const { bounds, scale } = metrics;
    image.setScale(scale).setPosition(x - (bounds.left + bounds.right) * scale / 2,
      y + size / 2 - bounds.bottom * scale);
  } else image.setPosition(x, y).setDisplaySize(size, size);
  let elapsed = 0, index = -1;
  const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  const update = (_time, delta) => {
    if (!reducedMotion?.matches) elapsed += delta;
    const next = Math.floor(elapsed / clip.frameMs) % clip.frames.length;
    if (next === index) return;
    index = next;
    applyCharacterPose(image, clip.frames[index]);
  };
  update(0, 0);
  const cleanup = () => {
    scene.events.off('update', update);
    scene.events.off('shutdown', cleanup);
    image.off('destroy', cleanup);
  };
  scene.events.on('update', update);
  scene.events.once('shutdown', cleanup);
  image.once('destroy', cleanup);
  return image;
}

export function showWorldMapCharacterGallery(scene, onBack) {
  scene.selectionDetailsClose?.();
  playUiSound(scene, 'dialogOpen');
  const { width, height } = scene.scale;
  const w = Math.min(1120, width - 104), h = Math.min(710, height - 96);
  const left = (width - w) / 2, top = (height - h) / 2, depth = 4300;
  const objects = [];
  const text = (x, y, value, slot = 'body32') => scene.add.text(x, y, value, {
    fontFamily: UI_FONT_FAMILIES.serif, fontSize: fontPx(slot), color: '#fff1d2'
  }).setOrigin(0.5).setDepth(depth + 3).setScrollFactor(0);
  let disposed = false;
  const close = () => {
    if (disposed) return;
    disposed = true;
    scene.events.off('shutdown', close);
    objects.forEach(object => object.destroy());
    if (scene.selectionDetailsClose === close) scene.selectionDetailsClose = null;
  };
  scene.selectionDetailsClose = close;
  scene.events.once('shutdown', close);
  const shade = scene.add.rectangle(width / 2, height / 2, width, height, 0, 0.72)
    .setDepth(depth).setScrollFactor(0).setInteractive();
  const panel = addRegionPanel(scene, width / 2, height / 2, w, h, depth + 1).setInteractive();
  const stop = (_pointer, _x, _y, event) => event.stopPropagation();
  shade.on('pointerdown', stop).on('pointerup', stop);
  panel.on('pointerdown', stop).on('pointerup', stop);
  objects.push(shade, panel, text(width / 2, top + 62, 'World Map Character', 'heading48'));
  objects.push(text(width / 2, top + 113, 'Choose from your current party', 'body30'));
  const back = () => { close(); onBack(); };
  const button = addRegionButton(scene, width / 2, top + h - 62, 300, 84, 'BACK', back, { depth: depth + 3 });
  button.panel.uiSound = 'dialogClose';
  objects.push(...button.objects);
  const party = worldMapParty(), selected = resolveWorldMapCharacter();
  const bounds = { x: left + 48, y: top + 158, width: w - 110, height: h - 278 };
  const cards = [], gap = 18, cardWidth = (bounds.width - gap) / 2, step = 166;
  party.forEach((hero, index) => {
    const x = bounds.x + (index % 2) * (cardWidth + gap) + cardWidth / 2;
    const y = bounds.y + Math.floor(index / 2) * step + 74;
    const current = selected?.id === hero.id;
    const card = addRegionButton(scene, x, y, cardWidth, 148, '', () => {
      if (!current) chooseWorldMapCharacter(scene, hero.id);
      back();
    }, { depth: depth + 2, haptic: current, state: current ? 'selected' : 'normal' });
    card.panel.setName(`world-map-character-${hero.id}`);
    const name = text(x + 54, y - 36, hero.name, 'body36');
    const classLabel = text(x + 54, y + 4, hero.className, 'body30');
    for (const label of [name, classLabel]) if (label.width > cardWidth - 160) label.setScale((cardWidth - 160) / label.width);
    cards.push(...card.objects, name, classLabel);
    if (current) cards.push(text(x + 54, y + 44, 'Selected', 'body30').setColor('#ffdb86'));
    const preview = addMapCharacterPreview(scene, hero, x - cardWidth / 2 + 72, y - 6, 120, depth + 3);
    if (preview) cards.push(preview);
  });
  if (!party.length) cards.push(text(width / 2, bounds.y + 60, 'Choose a party at a Delve first.'));
  const scroll = hallScroll(scene, bounds, cards, Math.max(120, Math.ceil(party.length / 2) * step), 0, () => {},
    (owner, x, y, sw, sh, variant) => serviceScrollSurface(owner, x, y, sw, sh, variant)
      .setDepth(depth + 4).setScrollFactor(0), () => scene.selectionDetailsClose !== close);
  objects.push(scroll.container.setDepth(depth + 2).setScrollFactor(0));
}
