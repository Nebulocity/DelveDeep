import { CHARACTER_SPRITES } from './characterSprites.js';
import { TUTORIAL_NPC_PORTRAITS } from './tutorialNpcPortraits.js';
import { DIALOGUE_PORTRAITS } from './dialoguePortraits.js';

// Studio can list registered artwork before the preview has loaded its textures.
// The scene catalog additionally reports whether fallback sprite sheets are loaded.
export function dialoguePortraitCatalog(scene = null) {
  const entries = [
    ...Object.entries(CHARACTER_SPRITES).map(([id, art]) => ({ id, label: id[0].toUpperCase() + id.slice(1),
      available: scene ? !!art.clips?.idle?.south?.frames?.some(frame => scene.textures.exists(frame.key))
        : !!art.clips?.idle?.south?.frames?.length, animated: true })),
    ...Object.entries(TUTORIAL_NPC_PORTRAITS).map(([id, art]) => ({ id, label: art.label,
      available: scene ? [...art.idle.frames, ...(art.talk?.frames ?? [])].every(frame => scene.textures.exists(frame.key))
        : !!art.idle.frames.length, animated: art.idle.frames.length > 1 })),
    ...Object.entries(DIALOGUE_PORTRAITS).map(([id, art]) => ({ id, label: art.label,
      available: art.available, animated: art.idle.frames.length > 1 }))
  ];
  return [...new Map(entries.map(entry => [entry.id, entry])).values()].sort((a, b) => a.label.localeCompare(b.label));
}
