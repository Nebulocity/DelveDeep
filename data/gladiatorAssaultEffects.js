// Gladiator Assault artwork uses the current replacement ability IDs.
// Saved modifier records control the lasting Relentless Assault buff artwork.

const prefix = 'ability_v2_gladiator_';
const frames = 32;
const frameMs = 1000 / 16;
const fadeMs = 400;

const effects = [
  { name: 'offensive-drill', abilityName: 'Offensive Drill', abilityId: prefix + 'offensive_drill',
    width: 50, height: 47, originX: 22, originY: 28 },
  { name: 'brutal-thrust', abilityName: 'Brutal Thrust', abilityId: prefix + 'brutal_thrust',
    width: 48, height: 30, originX: 21, originY: 14 },
  { name: 'punishing-blow', abilityName: 'Punishing Blow', abilityId: prefix + 'punishing_blow',
    width: 56, height: 44, originX: 27, originY: 29 },
  { name: 'relentless-assault', abilityName: 'Relentless Assault', abilityId: prefix + 'relentless_assault',
    width: 40, height: 45, originX: 19, originY: 32, persistentStatus: true, targetCaster: true,
    opacity: 0.62, targetSize: 1.5 }
];

export const GLADIATOR_ASSAULT_EFFECTS = effects.map(effect => ({
  ...effect,
  id: effect.name,
  className: 'Gladiator',
  frames,
  frameMs,
  fitTarget: true,
  followTarget: true,
  targetSize: 1.25,
  holdMs: 1600,
  fadeMs,
  statusActive: gladiatorAssaultStatusActive,
  clips: [{
    name: 'whole',
    key: 'gladiator-assault-' + effect.name,
    width: effect.width,
    height: effect.height,
    frames,
    start: 0,
    x: -effect.originX,
    y: -effect.originY,
    depth: effect.persistentStatus ? 'behind' : 'front',
    loop: Boolean(effect.persistentStatus),
    url: new URL(`../assets/effects/gladiator-assault/${effect.name}.png`, import.meta.url).href
  }]
}));

// Relentless Assault stores its speed modifier under a secondary ability key.
export function gladiatorAssaultStatusActive(target, definition, now) {
  if (!target?.alive || definition.abilityName !== 'Relentless Assault') return false;
  return target.status?.replacementEffects?.some(effect =>
    effect.key === definition.abilityId + ':secondary' && effect.until > now) ?? false;
}
