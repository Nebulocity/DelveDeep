// Floating gemstone sigils use 64 frames at 30 FPS. The saved rune owns its
// lifetime and fixed point; the shared renderer supplies paused 400 ms fades.
import { RUNEDANCER_ABILITIES } from './runedancerAbilities.js';

// Artwork follows the skill's saved behavior, never its editable display name.
// The three basic skills in each family load the same finished gemstone atlas.
const runeGemstones = {
  runeCadence: 'garnet', runeFlourish: 'garnet', runeTraverse: 'garnet', runeFinale: 'ruby',
  runeMovement: 'aquamarine', runeSpeed: 'aquamarine', runeDamage: 'aquamarine', runeReduction: 'sapphire',
  runeMercy: 'fluorite', runeMirror: 'fluorite', runeSnare: 'fluorite', runeMana: 'amethyst'
};

// Placed and impact runes share arena sizing, independent of the recipient's body.
const runeArtworkScales = { ruby: 0.6, amethyst: 0.6, sapphire: 0.6 };

// Temporary gameplay range overlay. Disable this flag after reviewing rune coverage.
const SHOW_RUNE_RANGES = false;
const runeRangeColors = {
  garnet: 0xe34b65, ruby: 0xff3159, aquamarine: 0x58e5da,
  sapphire: 0x578bff, fluorite: 0xa3e879, amethyst: 0xc47bff
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
    shatterOnEnd: true,
    debugRangeColor: SHOW_RUNE_RANGES && !impact ? runeRangeColors[gemstone] : undefined,

    // Capture the recipient's initial position without following later movement.
    singleTargetArtwork: true, recipientAnchor: true, followTarget: false,

    // Approved rupee facets surround bright script and a quieter matching halo.
    // A 64-frame loop lasts about 2.13 seconds; combat time pauses every glow.
    fitTarget: false, opacity: impact ? 0.95 : 0.92,
    frames: 64, frameMs: 1000 / 30, holdMs: impact ? 800 : 1600, fadeMs: 400,
    groundWidth: 112, artworkScale: runeArtworkScales[gemstone] ?? 0.5,
    clips: [{ name: gemstone, key: 'runedancer-' + gemstone + '-rune', width: 112, height: 112,
      frames: 64, start: 0, x: -56, y: impact ? -70 : -135, depth: 'front',
      loop: !impact, holdLastFrame: impact, url: sheet }]
  });
  return ability.duration > 0 ? [make(false), make(true)] : [make(true)];
});

// The rare blade's echo forms locally on its victim as a Garnet Rune.
// It is a separate cosmetic phase and never launches a second gameplay attack.
const echo = RUNEDANCER_EFFECTS.find(effect => effect.abilityId === 'ability_v2_runedance_amber_cadence'
  && effect.vfxPhase === 'impact');
RUNEDANCER_EFFECTS.push({ ...echo, id: 'runic-refrain-echo', abilityId: 'runic_refrain',
  abilityName: 'Runic Refrain', opacity: 0.6, holdMs: 450 });
