// Oathwarden Assault artwork uses the existing replacement ability IDs.
// The active saved status records remain responsible for both gameplay and lifetime.

const prefix = 'ability_v2_oathwarden_';
const frameMs = 50;
const frames = 32;
const fadeMs = 400;

const effects = [
  { name: 'righteous-blow', abilityName: 'Righteous Blow', abilityId: prefix + 'righteous_blow',
    width: 31, height: 47, x: -4, y: -23, groundWidth: 31, opacity: 0.9 },
  { name: 'piercing-vow', abilityName: 'Piercing Vow', abilityId: prefix + 'piercing_vow',
    width: 44, height: 34, x: -16, y: -18, groundWidth: 44, opacity: 0.9 },
  { name: 'vow-of-condemnation', abilityName: 'Vow of Condemnation', abilityId: prefix + 'vow_of_condemnation',
    width: 49, height: 26, x: -24, y: -11, groundWidth: 49, opacity: 0.78, persistentStatus: true },
  { name: 'vow-of-retribution', abilityName: 'Vow of Retribution', abilityId: prefix + 'vow_of_retribution',
    width: 54, height: 28, x: -27, y: -14, groundWidth: 54, opacity: 0.8, persistentStatus: true }
];

export const OATHWARDEN_ASSAULT_EFFECTS = effects.map(effect => ({
  ...effect,
  id: effect.name,
  className: 'Oathwarden',
  frameMs,
  frames,
  fitTarget: true,
  followTarget: true,
  singleTargetArtwork: true,
  targetSize: effect.persistentStatus ? 1.15 : 1.25,
  holdMs: 1200,
  fadeMs,
  statusActive: oathwardenAssaultStatusActive,
  clips: [{
    name: 'whole',
    key: 'oathwarden-assault-' + effect.name,
    width: effect.width,
    height: effect.height,
    frames,
    start: 0,
    x: effect.x,
    y: effect.y,
    depth: 'front',
    loop: Boolean(effect.persistentStatus),
    url: new URL(`../assets/effects/oathwarden-assault/${effect.name}.png`, import.meta.url).href
  }]
}));

// Damage reduction and retaliation both use existing optional encounter records.
export function oathwardenAssaultStatusActive(target, definition, now) {
  if (!target?.alive) return false;
  if (definition.abilityName === 'Vow of Condemnation') {
    return target.status?.replacementEffects?.some(record =>
      record.key === definition.abilityId + ':harmful' && record.until > now) ?? false;
  }
  if (definition.abilityName === 'Vow of Retribution') {
    return target.status?.replacementReactions?.some(record =>
      record.ability?.id === definition.abilityId && record.until > now) ?? false;
  }
  return false;
}
