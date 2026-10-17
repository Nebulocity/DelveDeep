// Barbarian artwork uses 32 transparent PixelLab frames at 20 FPS.
// Existing combat records own lasting art, so saves need no new visual fields.

const prefix = 'ability_v2_barbarian_';
const entries = [
  { slug: 'primal-roar', name: 'Primal Roar', suffix: 'primal_roar', status: 'beneficial', targetCaster: true, behind: true },
  { slug: 'fearsome-presence', name: 'Fearsome Presence', suffix: 'fearsome_presence', status: 'harmful', perRecipient: true, targetAnchorY: 0, targetSize: 0.95, clipY: -80 },
  { slug: 'terrifying-smash', name: 'Terrifying Smash', suffix: 'terrifying_smash' },
  { slug: 'battle-trance', name: 'Battle Trance', suffix: 'battle_trance', status: 'beneficial', targetCaster: true },
  { slug: 'savage-swing', name: 'Savage Swing', suffix: 'savage_swing', perRecipient: true },
  { slug: 'skullsplitter', name: 'Skullsplitter', suffix: 'skullsplitter' },
  { slug: 'blood-frenzy', name: 'Blood Frenzy', suffix: 'blood_frenzy', perRecipient: true },
  { slug: 'intimidating-blow', name: 'Intimidating Blow', suffix: 'intimidating_blow' },
  { slug: 'battle-instinct', name: 'Battle Instinct', suffix: 'battle_instinct', status: 'preparation', targetCaster: true, targetAnchorY: 0, targetSize: 0.95, clipY: -80 },
  { slug: 'adrenaline-rush', name: 'Adrenaline Rush', suffix: 'adrenaline_rush', status: 'beneficial', targetCaster: true, behind: true },
  { slug: 'preparation', name: 'Preparation', suffix: 'preparation', status: 'preparation', targetCaster: true, targetSize: 1.4 },
  { slug: 'berserking', name: 'Berserking', suffix: 'berserking', status: 'beneficial', targetCaster: true, behind: true, opacity: 0.65 },

  // Contact artwork is separate from lasting debuffs. Reload restores only the
  // status marker, while a newly resolved strike plays its impact just once.
  { slug: 'smash-weaken', name: 'Terrifying Smash', suffix: 'terrifying_smash', status: 'harmful', vfxPhase: 'weaken', targetAnchorY: 0, targetSize: 0.85, clipY: -70 },
  { slug: 'blow-weaken', name: 'Intimidating Blow', suffix: 'intimidating_blow', status: 'secondary', vfxPhase: 'weaken', targetAnchorY: 0, targetSize: 0.85, clipY: -74 },
  { slug: 'taunt', name: 'Primal Roar', suffix: 'primal_roar', status: 'taunt', vfxPhase: 'taunt', targetAnchorY: 0, targetSize: 0.85 },
  { slug: 'preparation-refill', name: 'Preparation', suffix: 'preparation', vfxPhase: 'refill', targetCaster: true, targetSize: 0.75 }
];

// Measured opaque bounds keep compact head markers readable without enlarging
// their empty padding. Coordinates are pixels relative to each clip's origin.
const artworkBounds = {
  'fearsome-presence': { left: -31, right: 30, top: -62, bottom: -6 },
  'battle-instinct': { left: -31, right: 30, top: -62, bottom: -6 },
  'smash-weaken': { left: -18, right: 23, top: -63, bottom: -6 },
  'blow-weaken': { left: -21, right: 20, top: -46, bottom: -12 },
  'taunt': { left: -31, right: 30, top: -48, bottom: -10 }
};

export const BARBARIAN_ABILITY_EFFECTS = entries.map(({ name, suffix, status, behind, ...placement }) => ({
  ...placement, id: 'barbarian-' + placement.slug, className: 'Barbarian', abilityName: name,
  artworkBounds: artworkBounds[placement.slug],
  abilityId: prefix + suffix, barbarianStatus: status, persistentStatus: Boolean(status),
  statusActive: barbarianStatusActive, frames: 32, frameMs: 50, fadeMs: 400, holdMs: 1200,
  fitTarget: true, followTarget: true, recipientAnchor: true, singleTargetArtwork: true,
  groundWidth: 96, targetSize: placement.targetSize ?? 1.4, opacity: placement.opacity ?? 0.8,
  clips: [{ name: placement.slug, key: 'barbarian-' + placement.slug,
    width: 96, height: 96, frames: 32, start: 0, x: -48, y: placement.clipY ?? -48,
    depth: behind ? 'behind' : 'front', loop: Boolean(status), holdLastFrame: !status,
    url: new URL(`../assets/effects/barbarian/${placement.slug}.png`, import.meta.url).href }]
}));

// Modifier keys distinguish primary buffs, harmful effects and secondary debuffs.
// Adrenaline Rush follows Speed rather than the separately consumed preparation.
export function barbarianStatusActive(target, definition, now) {
  if (!target?.alive) return false;
  const status = target.status ?? {};
  const kind = definition.barbarianStatus;
  if (kind === 'preparation') return status.replacementPreparations?.some(record =>
    record.ability?.id === definition.abilityId && record.until > now) ?? false;
  if (kind === 'taunt') {

    // The source-less forced-target deadline needs its living owner's saved
    // Primal Roar modifier to identify this marker after reload or a new taunt.
    const scene = target.scene;
    const owner = scene?.partyUnits?.find(unit => unit.id === status.forcedTargetId);
    return status.forcedTargetUntil > now && Boolean(owner?.alive)
      && (owner.status?.replacementEffects?.some(record =>
        record.key === definition.abilityId + ':beneficial' && record.until > now) ?? false);
  }
  const key = definition.abilityId + (kind === 'secondary' ? ':secondary:harmful' : ':' + kind);
  return status.replacementEffects?.some(record => record.key === key && record.until > now) ?? false;
}
