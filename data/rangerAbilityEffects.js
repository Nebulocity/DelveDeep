// Ranger artwork uses finished transparent sheets with 32 frames at 20 FPS.
// Existing gameplay records own every lasting effect, so saves need no visual timers.

const PREFIX = 'ability_v2_ranger_';
const entries = [
  { slug: 'camouflage', name: 'Camouflage', suffix: 'camouflage', status: 'beneficial', targetCaster: true, targetSize: 1.7, opacity: 0.65 },
  { slug: 'crippling-shot', name: 'Crippling Shot', suffix: 'crippling_shot', status: 'harmful', targetAnchorY: 0.82, clipY: -65 },
  { slug: 'farsight', name: 'Farsight', suffix: 'farsight', status: 'beneficial', perRecipient: true, targetAnchorY: 0, clipY: -48, targetSize: 1.1 },
  { slug: 'field-dressing', name: 'Field Dressing', suffix: 'field_dressing', status: 'beneficial', targetSize: 0.9 },
  { slug: 'piercing-shot', name: 'Piercing Shot', suffix: 'piercing_shot', status: 'secondary', targetSize: 0.9, opacity: 0.65 },
  { slug: 'volley', name: 'Volley', suffix: 'volley', groundFootprint: { radius: 32, squash: 0.75, arenaRadius: 200 }, clipY: -68 },
  { slug: 'pinning-arrow', name: 'Pinning Arrow', suffix: 'pinning_arrow', status: 'root', restoreFromStatus: false, targetAnchorY: 1, clipY: -80 },
  { slug: 'exploding-arrow', name: 'Exploding Arrow', suffix: 'exploding_arrow', targetSize: 1.9, followTarget: false, opacity: 0.9 },
  { slug: 'hunters-mark', name: "Hunter's Mark", suffix: 'hunter_s_mark', status: 'harmful', targetAnchorY: 0, targetSize: 1.1, clipY: -48 },
  { slug: 'hunters-trap', name: "Hunter's Trap", suffix: 'hunter_s_trap', status: 'zone', groundZone: true, replacesZoneView: true, groundFootprint: { radius: 34, squash: 0.65 }, clipY: -75 },
  { slug: 'scouts-route', name: "Scout's Route", suffix: 'scout_s_route', status: 'beneficial', targetCaster: true, targetAnchorY: 1, clipY: -68 },
  { slug: 'covering-fire', name: 'Covering Fire', suffix: 'covering_fire', status: 'preparation', targetCaster: true, targetSize: 1.2 },

  // The spent trap fades at its ground point while poison follows its victim.
  // Both phases read the same saved ability ID, distinguished only for artwork.
  { slug: 'trap-poison', name: "Hunter's Trap", suffix: 'hunter_s_trap', status: 'periodic', vfxPhase: 'poison', opacity: 0.55 }
];

// These rectangles measure opaque artwork relative to the sheet's placement.
// Ignore empty canvas padding when sizing compact signs for a landscape phone.
const artworkBounds = {
  'farsight': { left: -34, right: 34, top: -48, bottom: -4 },
  'hunters-mark': { left: -22, right: 22, top: -45, bottom: -11 },
  'field-dressing': { left: -24, right: 26, top: -31, bottom: 23 },
  'piercing-shot': { left: -29, right: 29, top: -29, bottom: 27 }
};

export const RANGER_ABILITY_EFFECTS = entries.map(({ name, suffix, status, ...placement }) => ({
  ...placement, id: 'ranger-' + placement.slug, className: 'Ranger', abilityName: name,
  artworkBounds: artworkBounds[placement.slug],
  abilityId: PREFIX + suffix, rangerStatus: status, persistentStatus: Boolean(status),
  statusActive: rangerStatusActive, frames: 32, frameMs: 50, fadeMs: 400,
  holdMs: 1200, groundWidth: 96, fitTarget: !placement.groundFootprint,
  followTarget: placement.followTarget ?? !placement.groundFootprint,
  recipientAnchor: true, singleTargetArtwork: true,
  targetSize: placement.targetSize ?? 1.4, opacity: placement.opacity ?? 0.8,
  clips: [{ name: placement.slug, key: 'ranger-' + placement.slug,
    width: 96, height: 96, frames: 32, start: 0, x: -48, y: placement.clipY ?? -48,
    depth: placement.slug === 'camouflage' || placement.groundFootprint ? 'behind' : 'front',
    loop: Boolean(status), holdLastFrame: !status,
    url: new URL('../assets/effects/ranger/' + placement.slug + '.png', import.meta.url).href }]
}));

// A shared root deadline cannot identify its caster after reload. Pinning Arrow
// therefore starts on confirmed live contact and follows that deadline until expiry.
export function rangerStatusActive(target, definition, now, wave) {
  if (!target?.alive) return false;
  const status = target.status ?? {};
  const kind = definition.rangerStatus;
  if (kind === 'root') return status.rootedUntil > now;
  if (['beneficial', 'harmful', 'secondary'].includes(kind)) {
    const key = definition.abilityId + (kind === 'secondary' ? ':secondary:harmful' : ':' + kind);
    return status.replacementEffects?.some(record => record.key === key && record.until > now) ?? false;
  }
  const records = kind === 'zone' ? status.replacementZones
    : kind === 'periodic' ? status.replacementPeriodic : status.replacementPreparations;
  return records?.some(record => record.ability?.id === definition.abilityId && record.until > now
    && (kind !== 'zone' || wave === undefined || record.wave === wave)) ?? false;
}

// Native steel, green and ember colors distinguish arrows without recoloring them.
// The game rotates and moves these stationary clips along the flight path.
export const RANGER_FLIGHT_SHEETS = ['piercing', 'pinning', 'crippling', 'exploding'].map(name => ({
  name: 'ranger-' + name, key: 'delivery-ranger-' + name, width: 64, height: 32,
  frames: 32, fps: 20, nativeColors: true,
  url: new URL('../assets/effects/ranger/' + name + '-flight.png', import.meta.url).href
}));
