
// Finished tavern artwork has 32 frames at 20 FPS, or 50 ms per frame.
// Saved gameplay records own its lifetime; saves need no new visual fields.
const prefix = 'ability_v2_barmaid_';
const entries = [
  { slug: 'frying-pan', name: 'Frying Pan', suffix: 'frying_pan' },

  // Pan Drop forms a pan hit on each affected enemy. Reuse the finished sheets;
  // the lasting head cue follows the shared stun deadline and fades when it ends.
  { slug: 'pan-drop', file: 'frying-pan', name: 'Pan Drop!', suffix: 'pan_drop' },
  { slug: 'pan-drop-stun', file: 'last-call-dazed', name: 'Pan Drop!', suffix: 'pan_drop', status: 'stun',
    vfxPhase: 'stun', restoreFromStatus: false, targetAnchorY: 0, clipY: -76, targetSize: 0.8 },
  { slug: 'spilled-drink', name: 'Spilled Drink', suffix: 'spilled_drink', status: 'zone',
    groundZone: true, replacesZoneView: true, groundFootprint: { radius: 40, squash: 0.35 }, clipY: -58, behind: true, opacity: 0.65 },
  { slug: 'cover-the-regulars', name: 'Cover the Regulars', suffix: 'cover_the_regulars', status: 'intercept',
    restoreFromStatus: false, targetAnchorY: 0.72, targetSize: 0.8 },
  { slug: 'duck-behind-the-bar', name: 'Duck Behind the Bar', suffix: 'duck_behind_the_bar', status: 'beneficial',
    targetCaster: true, targetAnchorY: 1, clipY: -90, behind: true, targetSize: 1.2 },
  { slug: 'rowdy-distraction', name: 'Rowdy Distraction', suffix: 'rowdy_distraction', status: 'harmful',
    perRecipient: true, targetAnchorY: 0, clipY: -76, targetSize: 0.8 },
  { slug: 'keep-it-civil', name: 'Keep It Civil', suffix: 'keep_it_civil', status: 'harmful',
    perRecipient: true, targetAnchorY: 0, clipY: -76, targetSize: 0.65 },
  { slug: 'bottle-smash', name: 'Bottle Smash', suffix: 'bottle_smash' },
  { slug: 'tavern-brawl', name: 'Tavern Brawl', suffix: 'tavern_brawl', perRecipient: true },
  { slug: 'last-call', name: 'Last Call', suffix: 'last_call', perRecipient: true },
  { slug: 'restock-the-bar', name: 'Restock the Bar', suffix: 'restock_the_bar', targetCaster: true, targetSize: 1.1 },
  { slug: 'quick-pour', name: 'Quick Pour', suffix: 'quick_pour', status: 'reaction',
    targetCaster: true, targetAnchorY: 0, clipY: -76, targetSize: 0.7 },
  { slug: 'liquid-courage', name: 'Liquid Courage', suffix: 'liquid_courage', perRecipient: true, targetSize: 1.1 },

  // Contact and recovery play once. Smaller lasting cues read their existing
  // bleed and accuracy records, so cleanse and expiry end them automatically.
  { slug: 'bottle-bleed', name: 'Bottle Smash', suffix: 'bottle_smash', status: 'periodic',
    vfxPhase: 'bleed', targetSize: 0.55, opacity: 0.65 },
  { slug: 'last-call-dazed', name: 'Last Call', suffix: 'last_call', status: 'secondary',
    vfxPhase: 'dazed', targetAnchorY: 0, clipY: -76, targetSize: 0.8 },
  { slug: 'pour-heal', name: 'Quick Pour', suffix: 'quick_pour', vfxPhase: 'heal', targetSize: 1.1 },

  // Reusing the dazed sheet saves another atlas. The shared stun deadline lacks
  // its ability source, so this cue starts again on a confirmed live pan hit.
  { slug: 'pan-stun', file: 'last-call-dazed', name: 'Frying Pan', suffix: 'frying_pan', status: 'stun',
    vfxPhase: 'stun', restoreFromStatus: false, targetAnchorY: 0, clipY: -76, targetSize: 0.8 }
];


// Opaque pixel bounds exclude empty padding when fitting compact head and body
// cues. Values are pixels relative to each clip's top-left placement offset.
const artworkBounds = {
  'rowdy-distraction': { left: -31, right: 32, top: -45, bottom: -6 },
  'keep-it-civil': { left: -33, right: 33, top: -53, bottom: -7 },
  'quick-pour': { left: -27, right: 27, top: -47, bottom: -6 },
  'last-call-dazed': { left: -27, right: 27, top: -44, bottom: -12 },
  'pan-stun': { left: -27, right: 27, top: -44, bottom: -12 },
  'pan-drop-stun': { left: -27, right: 27, top: -44, bottom: -12 },
  'bottle-bleed': { left: -16, right: 17, top: -18, bottom: 22 },
  'cover-the-regulars': { left: -36, right: 36, top: -30, bottom: 31 }
};

export const BARMAID_ABILITY_EFFECTS = entries.map(({ name, suffix, status, behind, file, ...placement }) => ({
  ...placement, id: 'barmaid-' + placement.slug, className: 'Barmaid', abilityName: name,
  artworkBounds: artworkBounds[placement.slug],
  abilityId: prefix + suffix, barmaidStatus: status, persistentStatus: Boolean(status),
  statusActive: barmaidStatusActive, frames: 32, frameMs: 50, holdMs: 1200, fadeMs: 400,
  groundWidth: 96, fitTarget: !placement.groundFootprint, followTarget: !placement.groundFootprint,
  recipientAnchor: true, singleTargetArtwork: true, targetSize: placement.targetSize ?? 1.3,
  opacity: placement.opacity ?? 0.8,
  clips: [{ name: placement.slug, key: 'barmaid-' + placement.slug, width: 96, height: 96,
    frames: 32, start: 0, x: -48, y: placement.clipY ?? -48, depth: behind ? 'behind' : 'front',
    loop: Boolean(status), holdLastFrame: !status,
    url: new URL('../assets/effects/barmaid/' + (file ?? placement.slug) + '.png', import.meta.url).href }]
}));

// Interception saves only owner and deadline, without the originating ability.
// WeakSet tracks the live record by identity without retaining it or changing saves.
const barmaidIntercepts = new WeakSet();
export function rememberBarmaidIntercept(record) {
  if (record) barmaidIntercepts.add(record);
}
export function isBarmaidIntercept(record) {
  return Boolean(record && barmaidIntercepts.has(record));
}

// Primary and secondary modifier keys differ. Zones stay at their saved point;
// potion readiness follows its reaction window instead of a separate visual timer.
export function barmaidStatusActive(target, definition, now, wave) {
  if (!target?.alive) return false;
  const status = target.status ?? {};
  const kind = definition.barmaidStatus;
  if (kind === 'stun') return status.stunnedUntil > now;
  if (kind === 'intercept') {
    const record = status.replacementIntercept;
    const owner = target.scene?.partyUnits?.find(unit => unit.id === record?.ownerId);
    return isBarmaidIntercept(record) && record.until > now && Boolean(owner?.alive);
  }
  if (['beneficial', 'harmful', 'secondary'].includes(kind)) {
    const key = definition.abilityId + (kind === 'secondary' ? ':secondary:harmful' : ':' + kind);
    return status.replacementEffects?.some(record => record.key === key && record.until > now) ?? false;
  }
  const records = kind === 'zone' ? status.replacementZones
    : kind === 'reaction' ? status.replacementReactions : status.replacementPeriodic;
  return records?.some(record => record.ability?.id === definition.abilityId && record.until > now
    && (kind !== 'zone' || wave === undefined || record.wave === wave)) ?? false;
}
