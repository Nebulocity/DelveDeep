// Finished sheets use 32 frames at 20 FPS. Existing combat records own lasting
// artwork, so resumed encounters need no additional saved fields.

const PREFIX = 'ability_v2_umbral_mage_';
const entries = [
  { slug: 'dark-meditation', name: 'Dark Meditation', status: 'channel', targetCaster: true, depth: 'behind', targetSize: 1.7 },
  { slug: 'shadow-trap', name: 'Shadow Trap', status: 'reaction', targetCaster: true, depth: 'behind', targetSize: 1.6 },
  { slug: 'eclipse-field', name: 'Eclipse Field', status: 'zone', groundZone: true, replacesZoneView: true,
    groundFootprint: { radius: 35, squash: 0.6 }, clipY: -62, depth: 'behind', opacity: 0.65 },
  { slug: 'shadow-image', name: 'Shadow Image', status: 'decoy', depth: 'behind', targetSize: 1.8 },
  { slug: 'shadow-bolt', name: 'Shadow Bolt', targetSize: 1.1 },
  { slug: 'gloomburst', name: 'Gloomburst', perRecipient: true, targetSize: 1.8, opacity: 0.62 },
  { slug: 'siphon', name: 'Siphon', targetSize: 1.5 },
  { slug: 'echo-of-night', name: 'Echo of Night', perRecipient: true, targetSize: 1.5 },
  { slug: 'essence-drain', name: 'Essence Drain', targetSize: 1.3 },
  { slug: 'shadow-mending', name: 'Shadow Mending', targetCaster: true, targetSize: 1.6 },
  { slug: 'dark-rejuvenation', name: 'Dark Rejuvenation', targetSize: 1.7 },
  { slug: 'soul-reclamation', name: 'Soul Reclamation', depth: 'behind', targetSize: 1.9 },

  // Meditation's earned spell bonus is distinct from its interruptible channel.
  // Recovery cues reuse accepted sheets and appear only after actual HP or Mana gain.
  { slug: 'night-focus', suffix: 'dark_meditation', name: 'Dark Meditation', vfxPhase: 'focus', status: 'preparation',
    targetCaster: true, targetAnchorY: 0, clipY: -66, targetSize: 0.85 },
  { slug: 'siphon-heal', file: 'shadow-mending', suffix: 'siphon', name: 'Siphon', vfxPhase: 'heal', targetSize: 1.6 },
  { slug: 'echo-mana', file: 'mana-return', suffix: 'echo_of_night', name: 'Echo of Night', vfxPhase: 'mana', targetSize: 1.1 },
  { slug: 'drain-mana', file: 'mana-return', suffix: 'essence_drain', name: 'Essence Drain', vfxPhase: 'mana', targetSize: 1.1 }
];

export const UMBRAL_MAGE_EFFECTS = entries.map(({ name, suffix, status, depth, ...placement }) => {
  const file = placement.file ?? placement.slug;
  return {
    ...placement, id: 'umbral-' + placement.slug, className: 'Mage of the Umbral Veil', abilityName: name,
    abilityId: PREFIX + (suffix ?? placement.slug.replaceAll('-', '_')),
    umbralStatus: status, persistentStatus: Boolean(status), statusActive: umbralStatusActive,
    frames: 32, frameMs: 50, holdMs: 1200, fadeMs: 400, groundWidth: 96,
    fitTarget: !placement.groundFootprint, followTarget: !placement.groundFootprint,
    recipientAnchor: true, singleTargetArtwork: true, targetSize: placement.targetSize ?? 1.5,
    opacity: placement.opacity ?? 0.75,
    clips: [{ name: file, key: 'umbral-' + file, width: 96, height: 96, frames: 32,
      start: 0, x: -48, y: placement.clipY ?? -48, depth: depth ?? 'front',
      loop: Boolean(status), holdLastFrame: !status,
      url: new URL(`../assets/effects/umbral-mage/${file}.png`, import.meta.url).href }]
  };
});

// Read the saved source record instead of guessing a lifetime from the ability.
// Decoys stay outside the real party and use their existing expiry and wave identity.
export function umbralStatusActive(target, definition, now, wave) {
  if (!target?.alive) return false;
  const status = target.status ?? {};
  const kind = definition.umbralStatus;
  if (kind === 'decoy') return Boolean(target.isDecoy && !target.umbralVisualRetired && target.decoyUntil > now
    && (wave === undefined || target.decoyWave === wave));
  if (kind === 'channel') return status.replacementChannel?.ability?.id === definition.abilityId
    && status.replacementChannel.until > now;
  const records = kind === 'zone' ? status.replacementZones
    : kind === 'reaction' ? status.replacementReactions : status.replacementPreparations;
  return records?.some(record => record.ability?.id === definition.abilityId && record.until > now
    && (kind !== 'zone' || wave === undefined || record.wave === wave)) ?? false;
}

// Stationary east-facing clips are moved or revealed by the shared travel renderer.
// Connections span artwork pixels 6..154; damage keeps its existing cast timestamp.
export const UMBRAL_FLIGHT_SHEETS = [
  { name: 'umbral-bolt', file: 'shadow-bolt-flight', width: 64, height: 32 },
  { name: 'umbral-siphon', file: 'siphon-flight', width: 160, height: 48, rootX: 6, tipX: 154 },
  { name: 'umbral-drain', file: 'essence-drain-flight', width: 160, height: 48, rootX: 6, tipX: 154 }
].map(sheet => ({ ...sheet, key: 'delivery-' + sheet.name, frames: 32, fps: 20, nativeColors: true,
  url: new URL(`../assets/effects/umbral-mage/${sheet.file}.png`, import.meta.url).href }));
