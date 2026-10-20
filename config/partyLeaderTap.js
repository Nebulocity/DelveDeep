// Distances are CSS screen pixels, converted to the current Phaser canvas resolution.
export const PARTY_LEADER_TAP = Object.freeze({
  basePower: 5,
  powerPerRenownLevel: 2,
  powerPerPartyLevel: 0.04,
  minimumIntervalMs: 150,
  crowdThreshold: 3,
  assistanceRadiusPx: 24,
  touchPaddingPx: 6,
  crowdGapPx: 12,
  gestureDistancePx: 12,
  maximumPressMs: 500,
  priorities: ['frontDepth', 'drawOrder', 'tapDistance', 'stableId'],
  impactDurationMs: 180
});
