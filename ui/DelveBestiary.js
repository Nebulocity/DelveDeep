import enemies from '../data/enemies.js';
import { createEncounterWaves } from '../data/encounters.js';
import { SLIME_SPRITES } from '../data/slimeSprites.js';
import { ENEMY_SPRITES } from '../data/enemySprites.js';
import { VOID_SPRITES } from '../data/voidSprites.js';
import { QUARRY_SPRITES } from '../data/quarrySprites.js';
import { SUNKEN_WATCH_SPRITES } from '../data/sunkenWatchSprites.js';
import { UI_FONT_SIZES } from '../config/uiTypography.js';
import { combatPanel, combatText } from './CombatHudTheme.js';
import { applyCharacterPose, characterArtworkBounds } from './CharacterSpriteDisplay.js';
import { bindSelectionDetails } from './SelectionDetails.js';
import { hallScroll } from './HallUI.js';
import { DELVE_SPRITE_DISPLAY_PROFILES } from '../data/characterDisplayProfiles.js';

const sprites = { ...SLIME_SPRITES, ...ENEMY_SPRITES, ...VOID_SPRITES,
  ...QUARRY_SPRITES, ...SUNKEN_WATCH_SPRITES };

function entriesFor(delve) {
  // Read combat's actual compositions without advancing its random stream.
  const waves = createEncounterWaves(delve, 1400, () => 0);
  const types = new Set(waves.flatMap(wave => wave.enemies.map(enemy => enemy.type)));
  const finale = waves.filter(wave => wave.boss).at(-1);

  // Boss waves can contain escorts, and earlier waves can feature guardians.
  // Current authored finales put their leader first if no explicit boss flag exists.
  const bossType = finale?.enemies.find(spawn => enemies[spawn.type]?.boss)?.type
    ?? finale?.enemies[0]?.type;
  return [...types].filter(type => enemies[type]).map(type => ({
    type, enemy: enemies[type], sprite: sprites[type], featured: type === bossType
  }));
}

export function preloadDelveBestiary(scene, delve, queued = new Set()) {
  for (const { sprite } of entriesFor(delve)) {
    const keys = new Set(sprite?.clips.idle.south.frames.map(frame => frame.key) ?? []);
    for (const texture of sprite?.textures ?? []) {
      if (!keys.has(texture.key) || queued.has(texture.key) || scene.textures.exists(texture.key)) continue;
      const { key, url, frameWidth, frameHeight } = texture;
      scene.load.spritesheet(key, url, { frameWidth, frameHeight });
      queued.add(key);
    }
  }
}

function addEntry(scene, entry, bounds, featured, inspect) {
  const { x, y, width, height } = bounds;
  const objects = [];
  const cx = x + width / 2;
  if (featured) {
    objects.push(combatPanel(scene, cx, y + height / 2, width, height, 1));
  } else {
    objects.push(scene.add.rectangle(cx, y + height / 2, width, height, 0x081321, 0.48)
      .setStrokeStyle(1, 0x80683e, 0.5).setDepth(1));
  }
  const headingHeight = featured ? 46 : 0;
  if (featured) objects.push(combatText(scene, cx, y + 28, 'DELVE BOSS',
    UI_FONT_SIZES.bestiaryLabel, 3, { color: '#e8b75c' }));
  const name = combatText(scene, cx, y + height - 16, entry.enemy.name,
    featured ? UI_FONT_SIZES.bestiaryBossName : UI_FONT_SIZES.bestiaryName, 3,
    { wordWrap: { width: width - 32 }, align: 'center' }).setOrigin(0.5, 1);
  objects.push(name);
  const artArea = { x: x + 16, y: y + headingHeight + 12,
    width: width - 32, height: Math.max(1, height - headingHeight - name.height - 42) };
  const clip = entry.sprite?.clips.idle.south;
  const artwork = clip ? characterArtworkBounds(scene, clip) : null;
  let image;
  if (artwork) {
    const first = clip.frames[0];
    image = scene.add.image(0, 0, first.key, first.frame).setDepth(2);
    objects.push(image);
    for (const key of new Set(clip.frames.map(frame => frame.key))) {
      // Phaser's nearest filter preserves crisp pixels when the showcase is enlarged.
      scene.textures.get(key).setFilter(0);
    }
    applyCharacterPose(image, first);
  } else {
    objects.push(combatText(scene, cx, artArea.y + artArea.height / 2,
      'Artwork unavailable', UI_FONT_SIZES.bestiaryLabel, 3,
      { color: '#c9ba9a', wordWrap: { width: artArea.width }, align: 'center' }));
  }
  if (inspect) {
    const hit = scene.add.rectangle(cx, y + height / 2, width, height, 0, 0).setDepth(4);
    bindSelectionDetails(scene, hit, () => ({
      title: entry.enemy.name,
      sections: [{ title: 'ABILITIES', body: Object.values(entry.enemy.abilities ?? {})
        .map(ability => ability.name).filter(Boolean).join('\n') || 'Basic attacks' }]
    }));
    objects.push(hit);
  }
  return { objects, image, clip, artwork, artArea, featured, nativeScale: entry.sprite?.scale ?? 1 };
}

function fitComparison(entries, settings) {
  // Denizens retain one comparison scale. The boss fills its own showcase independently
  // so short grid rows cannot shrink it. Both axes always use the same scale.
  const fit = entry => {
    const { artwork, artArea, nativeScale } = entry;
    return Math.min(artArea.width / ((artwork.right - artwork.left) * nativeScale),
      artArea.height / ((artwork.bottom - artwork.top) * nativeScale));
  };
  const multiplier = Math.min(...entries.filter(entry => entry.artwork).map(fit));
  for (const entry of entries) {
    if (!entry.image) continue;
    const { artwork, artArea } = entry;
    const scale = entry.nativeScale * (entry.featured
      ? fit(entry) * settings.bossMultiplier : multiplier * settings.denizenMultiplier);

    // Bounds cover every idle frame in foot-relative coordinates. Keep this anchor
    // fixed during playback so neither breathing nor transparent padding causes jitter.
    entry.image.setScale(scale).setPosition(
      artArea.x + artArea.width / 2 - (artwork.left + artwork.right) * scale / 2,
      artArea.y + artArea.height - artwork.bottom * scale);
  }
}

export function addDelveBestiary(scene, delve, x, y, width, height, options = {}) {
  const owned = [];
  const inspect = options.inspect !== false;
  const top = y - height / 2;
  owned.push(combatText(scene, x, top + 45, 'BESTIARY', UI_FONT_SIZES.heading38, 3));
  const entries = entriesFor(delve);
  if (!entries.length) {
    owned.push(combatText(scene, x, y, 'No enemies recorded.', UI_FONT_SIZES.body30, 3));
  }
  const bounds = { x: x - width / 2 + 30, y: top + 88,
    width: width - 60, height: height - 112 };
  const boss = entries.find(entry => entry.featured);
  const mobs = entries.filter(entry => !entry.featured);
  const gap = 24;
  const bossWidth = boss ? (mobs.length ? bounds.width * 0.44 : bounds.width) : 0;
  const displays = [];
  if (boss) displays.push(addEntry(scene, boss,
    { ...bounds, width: bossWidth }, true, inspect));
  if (boss) owned.push(...displays[0].objects);

  if (mobs.length) {
    const right = { x: bounds.x + (boss ? bossWidth + gap : 0), y: bounds.y + 42,
      width: bounds.width - (boss ? bossWidth + gap : 0) - 32, height: bounds.height - 42 };
    owned.push(combatText(scene, right.x + right.width / 2, bounds.y + 15, 'DENIZENS',
      UI_FONT_SIZES.bestiaryLabel, 3, { color: '#c9ba9a' }));
    const columns = mobs.length <= 2 || right.width < 480 ? 1 : 2;
    const rows = Math.ceil(mobs.length / columns);
    const visibleRows = Math.min(rows, 2);
    const cellWidth = (right.width - gap * (columns - 1)) / columns;
    const rowHeight = (right.height - gap * (visibleRows - 1)) / visibleRows;
    const objects = [];
    mobs.forEach((entry, index) => {
      const display = addEntry(scene, entry, {
        x: right.x + (index % columns) * (cellWidth + gap),
        y: right.y + Math.floor(index / columns) * (rowHeight + gap),
        width: cellWidth, height: rowHeight
      }, false, inspect);
      displays.push(display);
      objects.push(...display.objects);
    });
    const scroll = hallScroll(scene, right, objects, rows * (rowHeight + gap) - gap,
      0, () => {}, (owner, px, py, w, h) => {
        const surface = combatPanel(owner, px, py, w, h, (options.depth ?? 0) + 4);
        if (options.fixed) surface.setScrollFactor(0);
        return surface;
      },
      options.isBlocked ?? (() => Boolean(scene.selectionDetailsClose || scene.equipmentModalClose)));
    scroll.container.setDepth(3);
    owned.push(scroll.container);
  }
  fitComparison(displays, DELVE_SPRITE_DISPLAY_PROFILES[options.displayProfile ?? 'overview']);

  let elapsed = 0;
  const animate = (time, delta) => {
    elapsed += delta;
    for (const { image, clip } of displays) {
      if (!image?.active || !clip?.frames.length) continue;
      const frame = clip.frames[Math.floor(elapsed / clip.frameMs) % clip.frames.length];
      applyCharacterPose(image, frame);
    }
  };
  scene.events.on('update', animate);
  for (const object of owned) {
    object.setDepth((options.depth ?? 0) + object.depth);
    if (options.fixed) object.setScrollFactor(0);
  }
  // Closing a modal also releases idle playback, scroll listeners, tracks and masks.
  const destroy = () => {
    scene.events.off('update', animate);
    scene.events.off('shutdown', destroy);
    owned.forEach(object => { if (object.scene) object.destroy(); });
  };
  scene.events.once('shutdown', destroy);
  return { destroy };
}
