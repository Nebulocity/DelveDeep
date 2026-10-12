// Restore artwork uses 32 frames at 24 FPS, a complete loop every 1.33 seconds.
// These definitions read saved gameplay records instead of saving cosmetic timers.
export const GENERIC_RESTORE_EFFECTS = [
  { slug: 'life-anchor', type: 'magical', name: 'Life Anchor', status: 'reaction', fitTarget: true, targetSize: 1.6,
    artworkBounds: { left: -35, right: 37, top: -25, bottom: 36 }, groundAtFeet: true, ringSplitY: 69 },
  { slug: 'rejuvenation-aura', type: 'magical', name: 'Rejuvenation Aura', status: 'zone', floorAura: true, ringSplitY: 48 },
  { slug: 'first-aid', type: 'physical', name: 'First Aid', fitTarget: true, targetSize: 1.6,
    artworkBounds: { left: -22, right: 22, top: -29, bottom: 21 } },
  { slug: 'second-wind', type: 'physical', name: 'Second Wind', status: 'periodic', fitTarget: true, targetSize: 1.6,
    artworkBounds: { left: -33, right: 32, top: -9, bottom: 35 }, groundAtFeet: true }
].map(({ slug, type, name, status, ringSplitY, ...placement }) => ({
  ...placement, id: `restore-${slug}`, className: `Generic (${type === 'magical' ? 'Magical' : 'Physical'})`,
  abilityName: name, abilityId: `ability_v2_generic_${type}_${slug.replaceAll('-', '_')}`,
  restoreStatus: status, persistentStatus: Boolean(status), statusActive: genericRestoreStatusActive,
  followTarget: true, frameMs: 1000 / 24, frames: 32, groundWidth: 78, opacity: 0.8,
  holdMs: 1200, fadeMs: 400,

  // Matching crops place the far arc behind the sprite and the near arc in front,
  // using the same finished sheet, frame and fade without doubling any pixels.
  clips: (ringSplitY ? ['behind', 'front'] : ['front']).map(depth => ({ name: 'whole', key: `restore-${slug}-whole`, width: 96, height: 96,
    frames: 32, start: 0, x: -48, y: -48, depth: 'front', loop: true,
    url: new URL(`../assets/effects/generic-restore/${slug}/whole.png`, import.meta.url).href,
    ...(ringSplitY ? { depth, wrapHalf: depth, splitY: { from: ringSplitY, to: ringSplitY } } : {}) }))
}));

// Consumption removes the anchor; the aura and regeneration follow their timed
// records. Existing snapshot data makes these visuals recover naturally on reload.
export function genericRestoreStatusActive(target, definition, now, wave) {
  if (!target?.alive) return false;
  const status = target.status ?? {};
  const records = definition.restoreStatus === 'reaction' ? status.replacementReactions
    : definition.restoreStatus === 'zone' ? status.replacementZones : status.replacementPeriodic;
  return records?.some(record => record.ability?.id === definition.abilityId && record.until > now
    && (definition.restoreStatus !== 'zone' || wave === undefined || record.wave === wave)) ?? false;
}
