// Finished nature sheets have 32 frames at 20 FPS. Their open centers keep bodies
// readable, and existing saved gameplay records decide when looping art fades.

const PREFIX = 'ability_v2_verdant_cleric_';

// The shared root deadline has no source ID. Keep live Roots art until it expires,
// but do not guess its origin after reload and label another class's root as ours.
const effects = [
  { slug: 'ironwood-armor', name: 'Ironwood Armor', suffix: 'ironwood_armor', status: 'modifier',
    bodyCenter: true, targetAnchorY: 0.5, targetSize: 0.9, opacity: 0.6 },
  { slug: 'entangling-roots', name: 'Entangling Roots', suffix: 'entangling_roots', status: 'root',
    restoreFromStatus: false, targetAnchorY: 1, targetSize: 1.8, wrapFeet: true },
  { slug: 'brambles', name: 'Brambles', suffix: 'brambles', status: 'zone', groundZone: true,
    groundFootprint: { radius: 37, squash: 0.45 }, opacity: 0.55 },
  { slug: 'natures-embrace', name: "Nature's Embrace", suffix: 'nature_s_embrace', status: 'modifier',
    perRecipient: true, bodyCenter: true, targetAnchorY: 0.58, targetSize: 1.8, layers: true },
  { slug: 'wrath', name: 'Wrath', suffix: 'wrath', bodyCenter: true },
  { slug: 'leeching-vines', name: 'Leeching Vines', suffix: 'leeching_vines', perRecipient: true, targetAnchorY: 1 },
  { slug: 'thorn-barrier', name: 'Thorn Barrier', suffix: 'thorn_barrier', status: 'shield', bodyCenter: true },
  { slug: 'lifequake', name: 'Lifequake', suffix: 'lifequake',
    groundFootprint: { radius: 39, squash: 0.4, arenaRadius: 200 }, opacity: 0.85, frames: 64, holdMs: 2800 },
  { slug: 'natures-touch', name: "Nature's Touch", suffix: 'nature_s_touch', targetAnchorY: 1, layers: true },
  { slug: 'regrowth', name: 'Regrowth', suffix: 'regrowth', status: 'periodic', targetAnchorY: 1 },
  { slug: 'spring-canopy', name: 'Spring Canopy', suffix: 'spring_canopy', status: 'periodic',
    perRecipient: true, bodyCenter: true, targetAnchorY: 0.05, clipY: -28, targetSize: 1.8 },
  { slug: 'briarweave', name: 'Briarweave', suffix: 'briarweave', status: 'reaction' }
];

export const VERDANT_CLERIC_EFFECTS = effects.map(({ name, suffix, status, bodyCenter, ...placement }) => ({
  ...placement,
  id: 'verdant-cleric-' + placement.slug,
  className: 'Cleric of the Verdant Covenant',
  abilityName: name,
  abilityId: PREFIX + suffix,
  verdantStatus: status,
  persistentStatus: Boolean(status),
  statusActive: verdantClericStatusActive,
  frames: placement.frames ?? 32,
  frameMs: 50,
  groundWidth: 96,
  fitTarget: !placement.groundFootprint,
  followTarget: !placement.groundFootprint,
  recipientAnchor: true,
  singleTargetArtwork: true,
  groundAtFeet: !bodyCenter,
  targetSize: placement.targetSize ?? 1.5,
  opacity: placement.opacity ?? 0.75,
  holdMs: placement.holdMs ?? 1200,
  fadeMs: 400,
  clips: verdantClips(placement, status, bodyCenter)
}));

// Each layer has the same native 96-pixel canvas. Matching offsets and frames let
// the body hide the rear leaves while the nearer leaves cross in front of it.
function verdantClips(effect, status, bodyCenter) {
  const clip = (slug, depth = 'front', extra = {}) => ({
    name: slug, key: 'verdant-cleric-' + slug,
    width: 96, height: 96, frames: 32, start: 0, x: -48,
    y: effect.clipY ?? (bodyCenter ? -48 : -72), depth, loop: Boolean(status),
    url: new URL('../assets/effects/verdant-cleric/' + slug + '.png', import.meta.url).href,
    ...extra
  });
  if (effect.layers) return [
    clip(effect.slug + '-rear', 'behind', { opacity: effect.slug === 'natures-touch' ? 0.5 : 1 }),
    clip(effect.slug + '-front')
  ];
  if (effect.wrapFeet) return ['behind', 'front'].map(depth => clip(effect.slug, depth, {
    wrapHalf: depth, splitY: { from: 72, to: 72 }
  }));
  if (effect.slug === 'lifequake') return [

    // Cracks spread for 1.6 seconds, then hold their last frame beneath the new
    // upright light. All three layers fade together in the last 400 combat ms.
    clip('lifequake', 'behind', { holdLastFrame: true }),
    clip('lifequake-eruption-rear', 'behind', { start: 32, upright: true, opacity: 0.55 }),
    clip('lifequake-eruption-front', 'front', { start: 32, upright: true, opacity: 0.65 })
  ];
  return [clip(effect.slug)];
}

// No visual timers are added to saves. Roots use the combat control deadline;
// armor, regeneration, reflection and ground fields read their existing records.
export function verdantClericStatusActive(target, definition, now, wave) {
  if (!target?.alive) return false;
  const status = target.status ?? {};
  if (definition.verdantStatus === 'root') return status.rootedUntil > now;
  if (definition.verdantStatus === 'modifier') return status.replacementEffects?.some(record =>
    record.key === definition.abilityId + ':beneficial' && record.until > now) ?? false;
  if (definition.verdantStatus === 'shield' && !(status.temporaryHp > 0 && status.temporaryHpUntil > now)) return false;
  const records = definition.verdantStatus === 'zone' ? status.replacementZones
    : definition.verdantStatus === 'periodic' ? status.replacementPeriodic : status.replacementReactions;
  return records?.some(record => record.ability?.id === definition.abilityId && record.until > now
    && (definition.verdantStatus !== 'zone' || wave === undefined || record.wave === wave)) ?? false;
}
