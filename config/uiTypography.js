
// Phaser sizes use logical canvas pixels before device scaling.
// The compact, support, body, heading and display groups cover every runtime text size.
// A numeric suffix records the original size. Change a slot to update its assigned text.
// Named slots below the scale isolate helper, detail, timer and inventory text.
export const UI_FONT_SIZES = Object.freeze({

  // Compact readouts include battlefield resources, timers and editor data.
  compact18: 18, compact19: 19, compact20: 20, compact22: 22,
  compact24: 24, compact25: 25, compact26: 26,

  // Supporting text includes class labels, captions, hints and list metadata.
  support27: 27, support28: 28, support29: 29,

  // Body text includes descriptions, controls and dialog copy.
  body30: 30, body31: 31, body32: 32, body33: 33,
  body34: 34, body35: 35, body36: 36, body37: 37,

  // Headings include section names, character names and large button labels.
  heading38: 38, heading39: 39, heading40: 40, heading42: 42,
  heading43: 43, heading44: 44, heading46: 46, heading48: 48, heading49: 49,

  // Display text includes screen titles, announcements, results and damage.
  display51: 51, display52: 52, display54: 54, display57: 57,
  display62: 62, display69: 69, display70: 70, display72: 72,
  display74: 74, display76: 76, display78: 78,

  // Dedicated slots isolate text that often needs a separate mobile adjustment.
  detailBody: 36,
  detailBodyCompact: 32,
  itemDescription: 28,
  itemSummary: 32,
  itemOwner: 30,
  tacticDescription: 22,
  battleTimer: 23,
  mapStatus: 25,
  mapHint: 27,
  helperMessage: 28,

  // Mobile reading sizes for the Hall and its persistent navigation.
  hallNavigation: 40, hallSection: 36, hallHint: 34,
  hallCount: 32, hallRoleCount: 30, hallRosterMeta: 29,
  hallClass: 34, hallRole: 33, hallSummary: 34, hallStat: 35,
  hallGearSummary: 36, hallGearEmpty: 36, hallSlotHint: 34,
  hallSkillCount: 32, hallSkillSlot: 34, hallSkillName: 37,
  hallSkillDetail: 32, hallTacticHeading: 46,
  hallTacticMeta: 34, hallTacticRenown: 38,
  hallTacticName: 36, hallTacticSummary: 28,

  // Shop list rows and controls.
  shopCategory: 34, shopHint: 32, shopDescription: 32,
  shopCost: 32, shopPager: 32,

  // Region map labels and the scrollable destination rail.
  mapRegion: 34, mapGold: 35, mapDestination: 35,
  mapDestinationStatus: 29, mapDestinationHint: 31, mapLabel: 46,

  // Delve preparation, party review and combat readouts.
  delveDescription: 36, delveInfoHeading: 36, delveInfoLabel: 32,
  delveInfoDifficulty: 56, delveInfoBody: 34, delveInfoNext: 38,
  delveHint: 32, partyCount: 35,
  partyClass: 31, partyLevel: 29, partyHint: 32,
  overviewName: 40, overviewDetails: 31, overviewTactic: 38,
  overviewHint: 32, battleWave: 35, battleResource: 30
});

export const UI_FONT_FAMILIES = Object.freeze({
  sans: 'Arial',
  serif: 'Georgia',
  data: 'monospace',
  splash: 'Copperplate, Papyrus, fantasy, serif'
});

export const UI_FONT_WEIGHTS = Object.freeze({
  normal: 'normal',
  bold: 'bold',
  italic: 'italic'
});

export const UI_DOM_FONTS = Object.freeze({
  loadingTitle: Object.freeze({ family: UI_FONT_FAMILIES.splash, size: '145px', weight: '900' }),
  loadingStatus: Object.freeze({ family: UI_FONT_FAMILIES.sans, size: 'clamp(18px, calc(2.2cqw + 2px), 34px)', weight: '700' })
});

export function fontPx(category) {
  const size = UI_FONT_SIZES[category];
  if (size === undefined) throw new Error(`Unknown UI font category: ${category}`);
  return `${size}px`;
}
