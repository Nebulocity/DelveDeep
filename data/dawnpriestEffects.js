// Finished radiant artwork plays at 20 FPS. Existing gameplay records control
// lasting effects, so saved encounters need no new visual fields.
import { shieldSphereClips } from './shieldSphereEffects.js';

const PREFIX = 'ability_v2_dawnpriest_';
const entries = [
  { slug: 'holy-light', name: 'Holy Light', suffix: 'holy_light', layers: true, targetSize: 1.5 },
  { slug: 'sunlit-ward', name: 'Sunlit Ward', suffix: 'sunlit_ward', ward: true },
  { slug: 'blinding-radiance', name: 'Blinding Radiance', suffix: 'blinding_radiance', targetSize: 2 },
  { slug: 'guardian-spirit', name: 'Guardian Spirit', suffix: 'guardian_spirit', status: 'beneficial', layers: true, targetSize: 1.8 },
  { slug: 'sacred-blessing', name: 'Sacred Blessing', suffix: 'sacred_blessing', status: 'beneficial', targetAnchorY: 0, targetSize: 1.1, clipY: -28 },
  { slug: 'radiant-bolt', name: 'Radiant Bolt', suffix: 'radiant_bolt', targetSize: 1.1 },
  { slug: 'judgement-ray', name: 'Judgement Ray', suffix: 'judgement_ray', targetSize: 1.5 },
  { slug: 'cleansing-fire', name: 'Cleansing Fire', suffix: 'cleansing_fire', status: 'secondary-harmful', perRecipient: true, layers: true, targetSize: 1.6 },
  { slug: 'guided-retribution', name: 'Guided Retribution', suffix: 'guided_retribution', perRecipient: true, targetSize: 1.7 },
  { slug: 'eternal-renewal', name: 'Eternal Renewal', suffix: 'eternal_renewal', status: 'periodic', targetSize: 1.4 },
  { slug: 'blessed-restoration', name: 'Blessed Restoration', suffix: 'blessed_restoration', status: 'secondary-beneficial', targetSize: 1.1 },
  { slug: 'divine-reprisal', name: 'Divine Reprisal', suffix: 'divine_reprisal', perRecipient: true, layers: true, targetSize: 1.8 },

  // Extra phases reuse finished sheets. Healing appears only after effective
  // recovery, and the blind mark follows the enemy's saved accuracy penalty.
  { slug: 'blind-marker', name: 'Blinding Radiance', suffix: 'blinding_radiance', vfxPhase: 'blind', status: 'harmful', targetAnchorY: 0, clipY: -42, targetSize: 0.8,
    artworkBounds: { left: -23, right: 23, top: -39, bottom: 3 } },
  { slug: 'guided-heal', file: 'holy-light', name: 'Guided Retribution', suffix: 'guided_retribution', vfxPhase: 'heal', layers: true },
  { slug: 'reprisal-hit', file: 'radiant-bolt', name: 'Divine Reprisal', suffix: 'divine_reprisal', vfxPhase: 'hit', targetSize: 1.1 }
];

export const DAWNPRIEST_EFFECTS = entries.map(({ name, suffix, status, ...placement }) => ({
  ...placement, id: 'dawnpriest-' + placement.slug,
  className: 'Dawnpriest', abilityName: name, abilityId: PREFIX + suffix,
  everbrightStatus: status, persistentStatus: Boolean(status), statusActive: everbrightStatusActive,
  frames: 32, frameMs: 50, groundWidth: 96, holdMs: 1200, fadeMs: 400,
  fitTarget: !placement.ward, followTarget: true, recipientAnchor: true,
  singleTargetArtwork: true, surroundTarget: Boolean(placement.ward), followShield: Boolean(placement.ward),
  targetSize: placement.targetSize ?? 1.5, opacity: 0.75,
  clips: placement.ward ? shieldSphereClips('sunlit', 'sunlit-ward') : everbrightClips(placement, status)
}));

// Rear light and wings sit behind the body; crosses and glints sit in front.
// Both layers share a 96-pixel canvas, the same origin and the combat clock.
function everbrightClips(effect, status) {
  const file = effect.file ?? effect.slug;
  const clip = (layer = '') => ({
    name: file + layer, key: 'dawnpriest-' + file + layer,
    width: 96, height: 96, frames: 32, start: 0, x: -48, y: effect.clipY ?? -48,
    depth: layer === '-rear' ? 'behind' : 'front', loop: Boolean(status), holdLastFrame: !status,
    opacity: layer === '-rear' ? 0.65 : 1,
    url: new URL(`../assets/effects/dawnpriest/${file}${layer}.png`, import.meta.url).href
  });
  return effect.layers ? [clip('-rear'), clip('-front')] : [clip()];
}

// Primary and secondary modifiers have different saved keys. Read the exact key
// so a cleansed penalty cannot leave its artwork running until an unrelated timer.
export function everbrightStatusActive(target, definition, now) {
  if (!target?.alive) return false;
  const status = target.status ?? {};
  const kind = definition.everbrightStatus;
  if (kind === 'periodic') return status.replacementPeriodic?.some(record =>
    record.ability?.id === definition.abilityId && record.until > now) ?? false;
  const suffix = kind?.startsWith('secondary-') ? ':secondary:' + kind.slice(10) : ':' + kind;
  return status.replacementEffects?.some(record => record.key === definition.abilityId + suffix
    && record.until > now) ?? false;
}

// These stationary clips face right. The shared travel renderer moves the bolt
// and reveals the ray from its caster toward its recipient during the existing cast.
export const EVERBRIGHT_FLIGHT_SHEETS = [
  { name: 'everbright-bolt', file: 'radiant-bolt-flight', width: 64, height: 32 },
  { name: 'everbright-ray', file: 'judgement-ray-flight', width: 160, height: 48, rootX: 6, tipX: 156 }
].map(sheet => ({ ...sheet, key: 'delivery-' + sheet.name, frames: 32, fps: 20, nativeColors: true,
  url: new URL(`../assets/effects/dawnpriest/${sheet.file}.png`, import.meta.url).href }));
