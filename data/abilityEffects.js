// Finished effect sheets and placement values run without an art service.
// Offsets and movement are artwork pixels relative to the effect's ground origin.

import { SUPPLIED_EFFECT_PACKS } from './suppliedAbilityEffects.js';

const sheetUrl = (name) => new URL(`../assets/effects/volley/${name}.png`, import.meta.url).href;

export const VOLLEY_EFFECT = {
  frameMs: 50,
  frames: 16,
  groundWidth: 110,

  // Enlarge the art by about two thirds for phone readability. This changes only
  // the animation; the colored zone still shows the actual gameplay radius.
  sizeMultiplier: 1.65,
  clips: [

    // This supplied arrow sheet already bakes in its travel. Its exported movement
    // list would apply the motion twice and separate the arrows from their dust.
    { name: 'part-arrows', width: 130, height: 105, frames: 16, start: 0,
      x: -72, y: -87, depth: 'behind' },
    { name: 'part-dust_kick', width: 20, height: 11, frames: 5, start: 9, x: 0, y: -22, depth: 'front' },
    { name: 'part-dust_kick2', width: 23, height: 14, frames: 4, start: 10, x: 24, y: -15, depth: 'front' },
    { name: 'part-dust_kick4', width: 24, height: 10, frames: 5, start: 10, x: 43, y: -3, depth: 'front' },
    { name: 'part-new_impacts', width: 86, height: 35, frames: 4, start: 10, x: -28, y: -17, depth: 'front' },
    { name: 'part-dust_kick3', width: 21, height: 9, frames: 3, start: 12, x: -11, y: 1, depth: 'front' },
    { name: 'part-dust_kick5', width: 22, height: 12, frames: 3, start: 12, x: 9, y: 8, depth: 'front' }
  ].map(clip => ({ ...clip, key: `volley-${clip.name}`, url: sheetUrl(clip.name) }))
};

// Class and skill names match the existing catalog, so saves need no new ability IDs.
const bindings = {
  'back-alley-cut': ['Scoundrel', 'Back Alley Cut'],
  'surprise-attack': ['Scoundrel', 'Surprise Attack'],
  'smoke-bomb': ['Scoundrel', 'Smoke Bomb'],
  'sunbrand-strike': ['Dawnwarden', 'Sunbrand Strike'],
  'sanctity-nova': ['Dawnwarden', 'Sanctity Nova'],
  'hunter-s-mark': ['Ranger', "Hunter's Mark"],
  'explodingarrow-arrow': ['Ranger', 'Exploding Arrow'],
  'explodingarrow-explosion': ['Ranger', 'Exploding Arrow'],
  nightbolt: ['Mage of the Umbral Veil', 'Nightbolt'],
  gloomburst: ['Mage of the Umbral Veil', 'Gloomburst'],
  'ground-sigil': ['Mage of the Umbral Veil', 'Eclipse Field'],
  'sunlit-ward': ['Dawnwarden', 'Sunlit Ward'],
  'morning-chorus': ['Cleric of the Everbright', 'Morning Chorus'],
  'everbright-pulse': ['Cleric of the Everbright', 'Everbright Pulse']
};

// These new packs use finished sheets. Their loop flags control
// frames; the skill's gameplay still determines whether the visual is brief or lasting.
const additionalPacks = [
  { id: 'ground-sigil', frameMs: 83, frames: 12, groundWidth: 128,
    clips: [{ name: 'whole', width: 120, height: 89, frames: 12, start: 0,
      x: -60, y: -66, depth: 'front', loop: true }] },
  { id: 'sunlit-ward', frameMs: 33, frames: 24, groundWidth: 96,
    clips: [{ name: 'whole', width: 96, height: 96, frames: 24, start: 0,
      x: -48, y: -48, depth: 'front', loop: true }] },
  { id: 'everbright-pulse', frameMs: 43, frames: 24, groundWidth: 78,
    clips: [{ name: 'whole', width: 72, height: 100, frames: 24, start: 0,
      x: -36, y: -82, depth: 'front', loop: true }] },
  { id: 'morning-chorus', frameMs: 53, frames: 24, groundWidth: 80,
    clips: [
      { name: 'part-heal_column', width: 74, height: 96, frames: 24, start: 0,
        x: -37, y: -81, depth: 'front', loop: true },
      { name: 'part-heal_plus', width: 31, height: 59, frames: 24, start: 0,
        x: -15, y: -44, depth: 'front', loop: true }
    ] }
];

// Coverage is a cosmetic choice. Areas stay anchored on the floor but draw above
// all affected units, and Nova's requested 2.5x stretch changes only artwork width.
const presentation = {
  gloomburst: { coverUnits: true },
  'ground-sigil': { coverUnits: true },
  'smoke-bomb': { coverUnits: true },
  'sanctity-nova': { widthStretch: 2.5, followTarget: true },
  'hunter-s-mark': { untilDeath: true, followTarget: true },
  'sunlit-ward': { followShield: true, followTarget: true, surroundTarget: true },
  'everbright-pulse': { healing: true, singleTargetArtwork: true, followTarget: true, holdMs: 1500, fadeMs: 400 },
  'morning-chorus': { healing: true, singleTargetArtwork: true, followTarget: true, holdMs: 1500, fadeMs: 400 }
};

// Parts preserve the supplied behind/front layering; combined sheets are only used
// for packs with no parts. Loading both would draw the same artwork twice.
export const ABILITY_EFFECTS = [
  { ...VOLLEY_EFFECT, id: 'volley', className: 'Ranger', abilityName: 'Volley' },
  ...[...SUPPLIED_EFFECT_PACKS.filter(pack => pack.id !== 'eclipse-field'), ...additionalPacks].map(pack => ({
    ...pack, className: bindings[pack.id][0], abilityName: bindings[pack.id][1],
    ...presentation[pack.id],
    projectile: ['nightbolt', 'explodingarrow-arrow'].includes(pack.id),
    clips: pack.clips.map(clip => ({
      ...clip, key: `${pack.id}-${clip.name}`,
      url: new URL(`../assets/effects/${pack.id}/${clip.name}.png`, import.meta.url).href
    }))
  }))
];

// Select a flight separately from its impact. Most skills only have an impact pack.
export function findAbilityEffect(caster, ability, projectile = false) {
  return ABILITY_EFFECTS.find(effect => effect.className === caster.className
    && effect.abilityName === ability.name && Boolean(effect.projectile) === projectile);
}

// Load once. endFrame excludes unused padding cells in the small dust sheets.
export function preloadAbilityEffects(scene) {
  for (const clip of ABILITY_EFFECTS.flatMap(effect => effect.clips)) {
    if (!scene.textures.exists(clip.key)) {
      scene.load.spritesheet(clip.key, clip.url, {
        frameWidth: clip.width, frameHeight: clip.height, endFrame: clip.frames - 1
      });
    }
  }
}
