// These Oathwarden effects use PixelLab's finished 32-frame sheets at 20 FPS.
// Existing saved protection records decide when each drawing starts and fades.

const PREFIX = 'ability_v2_oathwarden_';
const FRAMES = 32;
const FADE_MS = 400;

const effects = [
  { name: 'sacred-oath', abilityName: 'Sacred Oath', abilitySuffix: 'sacred_oath', width: 54, height: 27,
    targetSize: 1.3, groundAtFeet: true, opacity: 0.9 },
  { name: 'guardians-vow', abilityName: "Guardian's Vow", abilitySuffix: 'guardian_s_vow', width: 42, height: 57,
    targetSize: 1.35, opacity: 0.8 },
  { name: 'judgement', abilityName: 'Judgement', abilitySuffix: 'judgement', width: 35, height: 38,
    targetSize: 0.95, opacity: 0.9 },
  { name: 'vigilance', abilityName: 'Vigilance', abilitySuffix: 'vigilance', width: 96, height: 96,
    targetSize: 1.35, opacity: 0.78 }
];

export const OATHWARDEN_PROTECT_EFFECTS = effects.map(effect => ({
  ...effect,
  id: 'oathwarden-' + effect.name,
  className: 'Oathwarden',
  abilityId: PREFIX + effect.abilitySuffix,
  persistentStatus: true,
  perRecipient: effect.name === 'sacred-oath' || effect.name === 'guardians-vow',
  frameMs: 50,
  frames: FRAMES,
  groundWidth: effect.width,
  fitTarget: true,
  followTarget: true,
  singleTargetArtwork: true,
  holdMs: 1200,
  fadeMs: FADE_MS,
  statusActive: oathwardenProtectStatusActive,
  clips: [{
    name: 'whole',
    key: 'oathwarden-protect-' + effect.name,
    width: effect.width,
    height: effect.height,
    frames: FRAMES,
    start: 0,
    x: -effect.width / 2,
    y: -effect.height / 2,
    depth: 'front',
    loop: true,
    url: new URL('../assets/effects/oathwarden-protect/' + effect.name + '.png', import.meta.url).href
  }]
}));

// Reuse the exact saved stat modifier or reaction that runs the ability.
export function oathwardenProtectStatusActive(target, definition, now) {
  if (!target?.alive) return false;
  if (definition.abilityName === 'Vigilance') {
    return target.status?.replacementReactions?.some(record =>
      record.ability?.id === definition.abilityId && record.until > now) ?? false;
  }
  const harmful = definition.abilityName === 'Judgement';
  return target.status?.replacementEffects?.some(record =>
    record.key === `${definition.abilityId}:${harmful ? 'harmful' : 'beneficial'}` && record.until > now) ?? false;
}
