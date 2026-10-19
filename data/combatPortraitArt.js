// Class identity, not character ID, chooses portrait atmosphere and heraldry. Reuse
// cached environment art only; the roster must not load extra full-size battlefields.
import { CLASS_CATALOG_NAMES } from './replacementAbilities.js';

export const PORTRAIT_ARCHETYPES = Object.freeze({
  keep: { backgroundKey: 'old-quarry-chamber', color: 0x1d355b, banner: 0x183c71 },
  warcamp: { backgroundKey: 'thornbriar-hollow-pixel-art', color: 0x583120, banner: 0x732d27 },
  shadow: { backgroundKey: 'old-quarry-chamber', color: 0x302347, banner: 0x3e255b },
  woodland: { backgroundKey: 'thornbriar-hollow-pixel-art', color: 0x173c30, banner: 0x244b32 },
  grove: { backgroundKey: 'thornbriar-hollow-pixel-art', color: 0x164a3f, banner: 0x17634c },
  arcane: { backgroundKey: 'slime-cave-pixel-art', color: 0x29305e, banner: 0x31316c },
  dawn: { backgroundKey: 'old-quarry-chamber', color: 0x4c452b, banner: 0x6d5730 },
  ember: { backgroundKey: 'slime-cave-pixel-art', color: 0x582c35, banner: 0x752936 },
  tavern: { backgroundKey: 'thornbriar-hollow-pixel-art', color: 0x473126, banner: 0x654429 },
  neutral: { backgroundKey: null, color: 0x13283c, banner: 0x263d5b }
});

export const CLASS_PORTRAIT_ART = Object.freeze({
  Oathwarden: { archetype: 'keep' }, Gladiator: { archetype: 'keep' },
  Dawnwarden: { archetype: 'dawn' }, Barbarian: { archetype: 'warcamp' },
  Scoundrel: { archetype: 'shadow' }, Ranger: { archetype: 'woodland' },
  Barmaid: { archetype: 'tavern' }, Runedancer: { archetype: 'arcane' },
  'Umbral Mage': { archetype: 'shadow' }, 'Crimson Mage': { archetype: 'ember' },
  'Luminous Mage': { archetype: 'arcane' }, 'Everbright Cleric': { archetype: 'dawn' },
  'Verdant Cleric': { archetype: 'grove' }, 'Sanguine Cleric': { archetype: 'ember' }
});

export function combatPortraitArt(className) {
  const identity = CLASS_CATALOG_NAMES[className] ?? className;
  const entry = CLASS_PORTRAIT_ART[identity] ?? { archetype: 'neutral' };
  return { ...PORTRAIT_ARCHETYPES[entry.archetype], ...entry,
    iconKey: `class-icon-${identity?.toLowerCase().replaceAll(' ', '_')}` };
}
