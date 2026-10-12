// Finished PixelLab sheets use 32 frames at 24 FPS, about 1.33 seconds per cycle.
// Empty centers and muted colors keep persistent marks clear of faces and weapons.

// These four spells resolve directly at the recipient: Brand and Damper apply marks,
// Smite calls light from above, and Vengeance pulses from the ground. Their ranged
// targeting does not mean they launch a projectile from the caster.

export const MAGICAL_ASSAULT_EFFECTS = [
  { name: 'Brand', width: 47, height: 26, x: -23, y: -11, persistentStatus: true, opacity: 0.9 },
  { name: 'Damper', width: 47, height: 26, x: -23, y: -11, persistentStatus: true, opacity: 0.85 },
  { name: 'Smite', width: 46, height: 76, x: -23, y: -65, opacity: 0.8 },
  { name: 'Vengeance', width: 94, height: 40, x: -47, y: -20, opacity: 0.7 }
].map(art => {
  const name = art.name.toLowerCase();
  const abilityId = `ability_v2_generic_magical_${name}`;
  return {
    id: `magical-assault-${name}`, abilityId, abilityName: art.name, className: 'Generic (Magical)',
    frameMs: 1000 / 24, frames: 32, groundWidth: art.width, opacity: art.opacity,
    persistentStatus: Boolean(art.persistentStatus), statusActive: magicalAssaultStatusActive,

    // Vengeance stays at its resolved floor point. The others follow one recipient,
    // fitting the visible idle silhouette rather than transparent sprite padding.
    fitTarget: name !== 'vengeance', followTarget: name !== 'vengeance',
    singleTargetArtwork: name !== 'vengeance', groundAtFeet: true, targetSize: 1.25,

    // Brief strikes fade through their final 400 combat milliseconds. Persistent
    // marks use the same fade only after the saved gameplay status has ended.
    holdMs: 32 * 1000 / 24 - 400, fadeMs: 400,
    clips: [{ name: 'whole', key: `magical-assault-${name}`, width: art.width, height: art.height,
      frames: 32, start: 0, x: art.x, y: art.y, depth: 'front', loop: Boolean(art.persistentStatus),
      url: new URL(`../assets/effects/generic-magical/${name}.png`, import.meta.url).href }]
  };
});

// Brand and Damper are secondary harmful modifiers. Reading their existing records
// handles ranked duration, dispel, death and restored saves without new save fields.
export function magicalAssaultStatusActive(target, definition, now) {
  return Boolean(target?.alive && target.status?.replacementEffects?.some(record =>
    record.key === `${definition.abilityId}:secondary:harmful` && record.until > now));
}
