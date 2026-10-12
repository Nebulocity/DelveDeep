// Gladiator Protect effects use PixelLab's editable, free VFX workbench exports.
// Status records stay the source of truth; the artwork only follows them.

const FADE_MS = 400;

const statusActive = (target, definition, now) => {
  if (!target?.alive) return false;

  // Defiant Roar records its taunt on each affected non-boss enemy.
  if (definition.abilityName === 'Defiant Roar') {
    return (target.status?.forcedTargetUntil ?? 0) > now;
  }

  const key = `${definition.abilityId}:beneficial`;
  return target.status?.replacementEffects?.some(record => record.key === key && record.until > now) ?? false;
};

const effects = [
  { slug: 'iron-guard', abilityName: 'Iron Guard', suffix: 'iron_guard', width: 77, height: 77,
    fitTarget: true, followTarget: true, targetCaster: true, targetSize: 1.25, opacity: 0.8 },
  { slug: 'defiant-roar', abilityName: 'Defiant Roar', suffix: 'defiant_roar', width: 49, height: 57,
    fitTarget: true, followTarget: true, perRecipient: true, recipientAnchor: true, targetSize: 1.25, opacity: 0.82 },
  { slug: 'shield-bash', abilityName: 'Shield Bash', suffix: 'shield_bash', width: 69, height: 52,
    fitTarget: true, targetSize: 0.8, opacity: 0.95, holdMs: 1200, persistentStatus: false },
  { slug: 'battle-formation', abilityName: 'Battle Formation', suffix: 'battle_formation', width: 53, height: 28,
    fitTarget: true, followTarget: true, groundAtFeet: true, perRecipient: true, recipientAnchor: true, targetSize: 1.15, opacity: 0.78 }
];

export const GLADIATOR_PROTECT_EFFECTS = effects.map(effect => ({
  ...effect,
  id: 'gladiator-protect-' + effect.slug,
  className: 'Gladiator',
  abilityId: 'ability_v2_gladiator_' + effect.suffix,
  frames: 32,
  frameMs: 50,
  persistentStatus: effect.persistentStatus !== false,
  fadeMs: FADE_MS,
  statusActive,
  groundWidth: effect.width,
  singleTargetArtwork: true,
  clips: [{
    name: 'whole',
    key: 'gladiator-protect-' + effect.slug,
    width: effect.width,
    height: effect.height,
    frames: 32,
    start: 0,
    x: -Math.floor(effect.width / 2),
    y: -Math.floor(effect.height / 2),
    depth: 'front',
    loop: true,
    url: new URL('../assets/effects/gladiator-protect/' + effect.slug + '.png', import.meta.url).href
  }]
}));
