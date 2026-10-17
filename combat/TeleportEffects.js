// Teleport artwork is a view of an already resolved move. Nothing in this file changes
// positions, actions, targeting, statuses, random rolls, or saved combat records.
import { TELEPORT_EFFECT_SHEETS } from '../data/teleportEffects.js';
import { visibleUnitBounds } from './AbilityEffect.js';

const sheets = new Map(TELEPORT_EFFECT_SHEETS.map(sheet => [sheet.name, sheet]));
const kinds = { damageEscapeTeleport: 'pulse', damageEnemyTeleport: 'cascade',
  decoyAllyRescue: 'light', arenaRepositionTruce: 'neutral', runeTraverse: 'garnet' };
const DURATION_MS = 2200;
const FADE_MS = 400;
const clamp = value => Math.max(0, Math.min(1, value));

// Smooth interpolation avoids a sudden start or stop in the decorative echoes.
function ease(value) {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
}

// Capture the supplied sprite's frame and local transform before its real position
// changes. Copies stay outside the combatant container and never receive input.
function spriteSnapshot(unit) {
  const image = unit.spriteVisual?.image;
  if (!image?.texture) return null;
  const scale = Math.abs(unit.container?.scaleX ?? 1);
  return { key: image.texture.key, frame: image.frame.name, x: image.x * scale,
    y: image.y * scale, scaleX: image.scaleX * scale, scaleY: image.scaleY * scale,
    originX: image.originX, originY: image.originY, flipX: image.flipX };
}

// Attach one cosmetic record only when a legal teleport actually resolves. Its floor
// points are arena units; artwork converts them to projected screen pixels when drawn.
export function startTeleportEffect(scene, unit, destination, ability, caster = unit, options = {}) {
  const kind = kinds[ability?.handler];
  if (!kind || !unit?.alive || !scene.add?.image || scene.idleSimulating
    || scene.game?.backgroundProgress?.isReplaying || scene.battleOver) return false;
  if (!scene.textures?.exists('teleport-beam')) return false;
  if (!scene.teleportEffectsCleanupInstalled) {
    scene.teleportEffectsCleanupInstalled = true;
    scene.events.once('shutdown', () => {
      clearTeleportEffects(scene);
      scene.teleportEffectsCleanupInstalled = false;
    });
  }
  
  const bounds = visibleUnitBounds(scene, unit);
  const casterBounds = caster === unit ? bounds : visibleUnitBounds(scene, caster);
  const effects = scene.teleportEffects ??= [];
  const now = scene.time.now;
  effects.push({ unit, caster, kind, startedAt: now,
    group: `${caster.id}:${ability.id}:${now}`,
    from: { x: unit.arenaX, y: unit.arenaY },
    destination: { x: destination.x, y: destination.y },
    source: { x: caster.arenaX, y: caster.arenaY },
    snapshot: spriteSnapshot(unit), height: Math.max(24, bounds.bottom - bounds.top),
    footOffset: bounds.bottom - scene.battlefield.arenaToScreen(unit.arenaX, unit.arenaY).y,
    casterHeight: Math.max(24, casterBounds.bottom - casterBounds.top),
    decoy: options.decoy, decoyGoneAt: null, images: new Map(), stoppedAt: null });
  return true;
}

// Release only our detached images. The real combatants and light decoys belong to
// their existing gameplay systems, so visual cleanup must never destroy those units.
export function clearTeleportEffects(scene) {
  for (const effect of scene.teleportEffects ?? []) {
    for (const image of effect.images.values()) image.destroy();
  }
  scene.teleportEffects = [];
}

// Reuse an image per named layer instead of creating a new Phaser object every frame.
function layer(scene, effect, id, key, frame = 0) {
  let image = effect.images.get(id);
  if (!image) {
    image = scene.add.image(0, 0, key, frame);
    effect.images.set(id, image);
  }
  return image;
}

// Exported front/rear clips are trimmed. Their anchors and first-frame offsets align
// them with the full 32-frame timeline, played at a moderate 20 frames per second.
function sheet(scene, effect, id, name, point, elapsed, duration, scale, alpha, depth, angle = 0, stretch = 1, tint = null) {
  const spec = sheets.get(name);
  if (!spec || elapsed < 0 || elapsed >= duration || alpha <= 0) return;
  const frame = Math.floor(elapsed / duration * 32) - spec.start;
  if (frame < 0 || frame >= spec.frames) return;
  const image = layer(scene, effect, id, 'teleport-' + name);
  const fade = clamp((duration - elapsed) / Math.min(FADE_MS, duration * .3));
  image.setFrame(frame).setOrigin(spec.anchor[0] / spec.width, spec.anchor[1] / spec.height)
    .setPosition(point.x, point.y).setScale(scale * stretch, scale).setRotation(angle)
    .setDepth(depth).setAlpha(alpha * fade).setVisible(true);
  if (tint !== null) image.setTint(tint);
  else image.clearTint();
}

// Echoes reuse the real actor's supplied drawing rather than a substitute silhouette.
function echo(scene, effect, id, point, alpha, depth, tint = null) {
  const pose = effect.snapshot;
  if (!pose || alpha <= 0) return;
  const image = layer(scene, effect, id, pose.key, pose.frame);
  image.setOrigin(pose.originX, pose.originY).setPosition(point.x + pose.x, point.y + pose.y)
    .setScale(pose.scaleX, pose.scaleY).setFlipX(pose.flipX).setDepth(depth)
    .setAlpha(alpha).setVisible(true);
  if (tint !== null) image.setTintFill(tint);
  else image.clearTint();
}

// The beam's bright front grows from its actual source to the resolved destination.
// It is decorative: teleport movement and any accompanying hit have already resolved.
function beam(scene, effect, id, from, to, elapsed, duration, alpha, depth, silver = false) {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const scale = Math.max(.45, effect.height / 110);
  sheet(scene, effect, id, 'beam', from, elapsed, duration, scale, alpha, depth,
    Math.atan2(to.y - from.y, to.x - from.x), distance / (232 * scale), silver ? 0xe8f2ff : null);
}

// Reproject the landing onto the living recipient so trailing light follows ordinary
// walking. The departure point stays fixed, as do the saved rune and decoy positions.
function draw(scene, effect, elapsed, opacity, sharedMoons) {
  const project = point => scene.battlefield.arenaToScreen(point.x, point.y);
  const from = project(effect.from);
  const to = project(effect.unit.alive
    ? { x: effect.unit.arenaX, y: effect.unit.arenaY } : effect.destination);
  const height = effect.height;
  const scale = height / 110;
  const front = 103 + to.y, back = 97 + to.y;
  const chest = point => ({ x: point.x, y: point.y - height * .52 });
  const color = effect.kind === 'light' ? 0xdaf0ff : effect.kind === 'neutral' && !effect.unit.isEnemy ? 0xe8eeee : 0xe65b7e;

  // These copies are never targetable actors. The actual actor remains fully visible
  // and available at its new position while the echo trail fades around it.
  echo(scene, effect, 'departure', from, (1 - ease(elapsed / 850)) * .5 * opacity, 101 + from.y);
  for (let i = 1; i <= 3; i++) {
    const progress = ease((elapsed - i * 45) / 650);
    const q = Math.min(.94, progress * .75 + i * .06);
    const point = { x: from.x + (to.x - from.x) * q, y: from.y + (to.y - from.y) * q };
    echo(scene, effect, 'echo-' + i, point, (1 - ease((elapsed - 350) / 750)) * .23 * opacity, 100 + point.y, color);
  }

  if (effect.kind === 'pulse') {

    // Authored sprite feet can sit below the arena origin. Ground the static at the
    // visible boots instead, keeping the departure anchored where the move began.
    const departureFeet = { x: from.x, y: from.y + effect.footOffset };
    const landingFeet = { x: to.x, y: effect.unit.alive
      ? visibleUnitBounds(scene, effect.unit).bottom : to.y + effect.footOffset };
    sheet(scene, effect, 'static-out', 'static', departureFeet, elapsed + 400, 1400, scale, .42 * opacity, 102 + from.y);
    sheet(scene, effect, 'static-in', 'static', landingFeet, elapsed, 1800, scale, .68 * opacity, front);
  }
  if (effect.kind === 'cascade' || effect.kind === 'neutral') {
    const neutral = effect.kind === 'neutral';
    const moonScale = effect.casterHeight / 110 * (neutral ? 2 : 2.7);
    const source = neutral
      ? project({ x: scene.battlefield.logicalWidth / 2, y: scene.battlefield.logicalHeight / 2 })
      : { x: scene.scale.width / 2, y: scene.battlefield.bottomY * .24 };

    // Everyone in this cast shares one moon center, regardless of their own height.
    // A small slime and a tall adventurer must not create separate moons.
    // Cascade stays above the floor at the reference height, independent of the caster.
    if (neutral) source.y -= effect.casterHeight * 1.25;
    else {

      // The top banner ends at y=96. Keep the full scaled moon 12 pixels below it.
      source.y = Math.max(source.y, 96 + 12 + sheets.get('moon').anchor[1] * moonScale);
    }
    if (!sharedMoons.has(effect.group)) {
      sharedMoons.add(effect.group);
      sheet(scene, effect, 'moon', neutral ? 'neutral' : 'moon', source, elapsed, 2100,
        moonScale, (neutral ? .65 : .78) * opacity, back - 5);
    }
    if (neutral) {
      beam(scene, effect, 'moon-beam', source, chest(from), elapsed, 900, .6 * opacity, back);
      beam(scene, effect, 'relocation-beam', chest(from), chest(to), elapsed - 200, 1400, .7 * opacity,
        back + 1, !effect.unit.isEnemy);
    }
    echo(scene, effect, 'deposit', to, (1 - ease((elapsed - 500) / 850)) * (neutral ? .2 : .28) * opacity, front, color);
  }
  if (effect.kind === 'light') {
    const doorScale = height / 110;
    sheet(scene, effect, 'door-out-rear', 'portal-behind', from, elapsed + 350, 1600, doorScale, .8 * opacity, 97 + from.y);
    sheet(scene, effect, 'door-in-rear', 'portal-behind', to, elapsed, 1800, doorScale, .85 * opacity, back);
    sheet(scene, effect, 'door-out-front', 'portal-front', from, elapsed + 350, 1600, doorScale, .6 * opacity, 103 + from.y);
    sheet(scene, effect, 'door-in-front', 'portal-front', to, elapsed, 1800, doorScale, .65 * opacity, front);

    // The existing decoy retains its own lifetime, targeting, Health and save record.
    // Its silver overlay follows that lifetime and fades for 400 combat milliseconds.
    const now = scene.time.now;
    if (effect.decoyGoneAt === null && (!effect.decoy?.alive || effect.decoy.decoyUntil <= now)) effect.decoyGoneAt = now;
    const decoyAlpha = effect.decoyGoneAt === null ? 1 : 1 - clamp((now - effect.decoyGoneAt) / FADE_MS);
    echo(scene, effect, 'light-decoy', from, decoyAlpha * .52 * opacity, 102 + from.y, 0xe3f5ff);
  }
  if (effect.kind === 'garnet') {
    sheet(scene, effect, 'garnet-collapse', 'collapse', chest(from), elapsed, 1400, scale, .9 * opacity, 102 + from.y);
    sheet(scene, effect, 'garnet-rear', 'blast-behind', chest(to), elapsed - 100, 1800, scale * 1.2, .9 * opacity, back);
    sheet(scene, effect, 'garnet-front', 'blast-front', chest(to), elapsed - 100, 1800, scale * 1.2, .8 * opacity, front);
  }
}

// Combat timestamps keep sheets and fades frozen during Pause. Death or battle end
// freezes the last pose and fades it; shutdown and historical replay clear immediately.
export function updateTeleportEffects(scene, replaying = false) {
  if (replaying || scene.idleSimulating) { clearTeleportEffects(scene); return; }
  const now = scene.time.now;
  const sharedMoons = new Set();
  scene.teleportEffects = (scene.teleportEffects ?? []).filter(effect => {
    const elapsed = Math.max(0, now - effect.startedAt);
    if ((!effect.unit.alive || scene.battleOver) && effect.stoppedAt === null) effect.stoppedAt = now;
    const stopped = effect.stoppedAt !== null;
    const fading = stopped ? clamp((now - effect.stoppedAt) / FADE_MS) : clamp((elapsed - (DURATION_MS - FADE_MS)) / FADE_MS);
    const decoyActive = effect.kind === 'light' && !stopped
      && (effect.decoyGoneAt === null || now - effect.decoyGoneAt < FADE_MS);
    if (fading >= 1 && !decoyActive) {
      for (const image of effect.images.values()) image.destroy();
      return false;
    }
    for (const image of effect.images.values()) image.setVisible(false);
    draw(scene, effect, stopped ? effect.stoppedAt - effect.startedAt : elapsed,
      decoyActive ? 1 : 1 - fading, sharedMoons);
    return true;
  });
}
