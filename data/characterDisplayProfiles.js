// Edit this file to tune presentation sizes, then reload the game to see the changes.
// sizeMultiplier: 1 is current size, 1.2 is 20% larger, 0.8 is 20% smaller.
// bodyHeight is in game pixels; bodyFraction is relative to the existing UI slot.
// fitToSlot caps portraits at their slot edges. Set false to try larger artwork;
// existing panel masks still apply. These controls never change battlefield sprites.
export const CHARACTER_DISPLAY_PROFILES = Object.freeze({
  // Traveling adventurer on the illustrated World Map.
  worldMap: { bodyHeight: 140, sizeMultiplier: 1.5 },
  // Small character selectors shared by town Heroes, Abilities and Equipment.
  townRoster: { bodyFraction: 0.74, sizeMultiplier: 1, fitToSlot: true },
  // Large adventurer preview on the town Heroes screen.
  townDetails: { bodyFraction: 0.74, sizeMultiplier: 1, fitToSlot: true },
  // Large adventurer preview in Guild registry dialogs.
  guildRegistry: { bodyFraction: 0.74, sizeMultiplier: 1, fitToSlot: true },
  // Adventurer thumbnails in the party selection list.
  partySelect: { bodyFraction: 0.74, sizeMultiplier: 1, fitToSlot: true },
  // Active-party thumbnails in the Dungeon overview.
  delveParty: { bodyFraction: 0.74, sizeMultiplier: 1, fitToSlot: true },
  // Animated party cards along the combat screen's left edge.
  combatRoster: { bodyFraction: 0.74, sizeMultiplier: 1, fitToSlot: true }
});

// Enemy showcase sizes are relative to their existing fitted comparison scale.
// Boss and denizen controls are separate; denizens keep their relative native sizes.
// Values above 1 can extend beyond the reserved artwork area into nearby labels.
export const DELVE_SPRITE_DISPLAY_PROFILES = Object.freeze({
  // Bestiary on the Delve Overview / preparation screen.
  overview: { bossMultiplier: 1, denizenMultiplier: 1 },
  // Bestiary in the Delve Details dialog, including inspection from the map.
  description: { bossMultiplier: 1, denizenMultiplier: 1 }
});

// Still-image artwork beside general inspection and expedition descriptions.
// These multipliers affect the existing fitted image, including non-character art.
export const DESCRIPTION_ART_DISPLAY = Object.freeze({
  general: { sizeMultiplier: 1 },
  expedition: { sizeMultiplier: 1 }
});

// Approximate crown-to-boot height as a fraction of the stable idle artwork bounds.
// These exceptions exclude raised swords, helmet crests and high hair from body size.
// Durgrim retains a shorter body at the same artistic scale as the human adventurers.
export const CHARACTER_BODY_PROPORTIONS = Object.freeze({
  aldren: { bodyFraction: 0.90 },
  alhanna: { bodyFraction: 0.82 },
  chaska: { bodyFraction: 0.84 },
  durgrim: { bodyFraction: 0.80, stature: 0.82 },
  garrick: { bodyFraction: 0.82 },
  yasmin: { bodyFraction: 0.87 }
});
