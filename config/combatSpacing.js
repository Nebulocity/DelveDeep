// Distances use logical arena coordinates, before perspective projection.
// Keep melee radii within the existing class/enemy attack ranges.
export default {
  normal: 52,
  stack: 28,
  spread: 105,
  tankRange: 52,
  meleeRange: 65,
  personalSpaceGap: 18,
  meleeReachPadding: 72,
  meleeThreshold: 120,
  rangedMin: 180,
  rangedMax: 250,
  healerMin: 220,
  healerMax: 290,
  rangeHysteresis: 18,
  meleeSlots: 6,
  slotRecheckMs: 900,
  slotLeaseMs: 1600,
  arrival: 6,
  arrivalTolerance: 12,
  separationForce: 5,
  maxSeparationSpeed: 65,
  personalSpaceCore: 0.8,
  sidestepStrength: 0.35,
  edgePadding: 38
};
