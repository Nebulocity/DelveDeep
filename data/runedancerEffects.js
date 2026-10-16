// Floating gemstone sigils use 32 frames at 20 FPS. The saved rune owns its
// lifetime and fixed point; the shared renderer supplies paused 400 ms fades.
import { RUNEDANCER_ABILITIES } from './runedancerAbilities.js';

// Artwork follows the skill's saved behavior, never its editable display name.
// The three basic skills in each family load the same finished gemstone atlas.
const runeGemstones = {
  runeCadence: 'garnet', runeFlourish: 'garnet', runeTraverse: 'garnet', runeFinale: 'ruby',
  runeMovement: 'aquamarine', runeSpeed: 'aquamarine', runeDamage: 'aquamarine', runeReduction: 'sapphire',
  runeMercy: 'fluorite', runeMirror: 'fluorite', runeSnare: 'fluorite', runeMana: 'amethyst'
};

function runeActive(target, definition, now, wave) {
  return Boolean(target?.alive && target.status?.replacementZones?.some(zone =>
    zone.ability.id === definition.abilityId && zone.until > now && zone.wave === wave));
}

export const RUNEDANCER_EFFECTS = RUNEDANCER_ABILITIES.flatMap(ability => {
  const slug = ability.id.replace('ability_v2_runedance_', '').replaceAll('_', '-');
  const gemstone = runeGemstones[ability.handler];

  // Keep the folder and extension in a backtick path so Vite bundles the rune PNGs.
  const sheet = new URL(`../assets/effects/runedancer/${gemstone}-rune-sheet.png`, import.meta.url).href;
  const make = impact => ({
    id: 'runedancer-' + slug + (impact ? '-impact' : ''), className: 'Runedancer',
    abilityName: ability.name, abilityId: ability.id, vfxPhase: impact ? 'impact' : undefined,
    persistentStatus: !impact && ability.duration > 0, statusActive: runeActive,
    groundZone: !impact && ability.duration > 0, replacesZoneView: true,
    singleTargetArtwork: true, recipientAnchor: true, followTarget: impact,
    fitTarget: impact, targetSize: 1.05, opacity: impact ? 0.85 : 0.72,
    frames: 32, frameMs: 50, holdMs: impact ? 800 : 1600, fadeMs: 400,
    groundWidth: 112, artworkScale: impact ? 0.75 : 1,
    clips: [{ name: gemstone, key: 'runedancer-' + gemstone + '-rune', width: 112, height: 112,
      frames: 32, start: 0, x: -56, y: impact ? -70 : -135, depth: 'front',
      loop: !impact, holdLastFrame: impact, url: sheet }]
  });
  return ability.duration > 0 ? [make(false), make(true)] : [make(true)];
});

// The rare blade's echo forms locally on its victim as a Garnet Rune.
// It is a separate cosmetic phase and never launches a second gameplay attack.
const echo = RUNEDANCER_EFFECTS.find(effect => effect.abilityId === 'ability_v2_runedance_amber_cadence'
  && effect.vfxPhase === 'impact');
RUNEDANCER_EFFECTS.push({ ...echo, id: 'runic-refrain-echo', abilityId: 'runic_refrain',
  abilityName: 'Runic Refrain', opacity: 0.6, holdMs: 450, artworkScale: 0.7 });
