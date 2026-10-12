// These transparent sheets have 32 frames at 20 FPS. Open centers leave bodies readable.
// Only finished artwork is bundled; gameplay never needs an art service connection.
export const MAGICAL_PROTECTION_EFFECTS = ['Hex', 'Nullify', 'Spellbind', 'Spellward'].map(name => {
  const id = name.toLowerCase();
  const persistentStatus = id === 'hex' || id === 'spellbind';
  return {
    id: `magical-${id}`, className: 'Generic (Magical)', abilityName: name,
    abilityId: `ability_v2_generic_magical_${id}`, persistentStatus,
    frameMs: 50, frames: 32, groundWidth: 96, fitTarget: true,
    followTarget: true, singleTargetArtwork: true, targetSize: 1.8, opacity: 0.85,

    // Brief cleanses and dispels fade during their final eight frames. Lasting
    // statuses start the same 400 ms fade when their actual gameplay record ends.
    holdMs: 1200, fadeMs: 400,
    clips: (id === 'spellward' ? ['behind', 'front'] : ['front']).map(depth => ({
      name: 'whole', key: `magical-${id}-whole`, width: 96, height: 96,
      frames: 32, start: 0, x: -48, y: -48, depth: 'front', loop: persistentStatus,
      url: new URL(`../assets/effects/magical-${id}/whole.png`, import.meta.url).href,

      // The cleansing ring rises from artwork row 72 to row 27 across 32 frames.
      // Two complementary crops share the sheet, placing its far half behind the
      // body and its near half in front without redrawing or doubling any pixels.
      ...(id === 'spellward' ? { depth, wrapHalf: depth, splitY: { from: 72, to: 27 } } : {})
    }))
  };
});

// Existing saved status records are the source of truth, including cleanse and
// immunity. No cosmetic save fields or changes to ability IDs are necessary.
export function magicalProtectionStatusActive(target, definition, now) {
  if (!target?.alive) return false;
  if (definition.abilityName === 'Spellbind') return target.status?.spellLockUntil > now;
  return target.status?.replacementEffects?.some(record =>
    record.key === `${definition.abilityId}:harmful` && record.until > now) ?? false;
}
