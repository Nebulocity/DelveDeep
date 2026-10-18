import glint from '../assets/ui/town-hub/selection-glint.json';

const icons = ['heroes', 'abilities', 'equipment', 'tactics', 'items', 'quests', 'market', 'tavern', 'exchange', 'world-map', 'settings', 'gold'];
const frames = ['title', 'bar', 'button', 'selected', 'panel', 'capsule', 'option'];

export function preloadTownAssets(scene) {
  for (const name of [...icons, ...frames]) {
    const key = `town-hub-${name}`;
    if (!scene.textures.exists(key)) {
      scene.load.image(key, new URL(`../assets/ui/town-hub/${name}.png`, import.meta.url).href);
    }
  }
  if (!scene.textures.exists('town-hub-glint')) {
    scene.load.atlas('town-hub-glint', new URL('../assets/ui/town-hub/selection-glint.png', import.meta.url).href, glint);
  }
}

export function createTownAnimations(scene) {
  if (!scene.anims.exists('town-hub-selection')) {
    scene.anims.create({ key: 'town-hub-selection', frameRate: 24, repeat: 0,
      frames: glint.frames.map(frame => ({ key: 'town-hub-glint', frame: frame.filename })) });
  }
}

// Both layouts share actions, art and notification providers. No current destination
// exposes a notification count, so badges remain hidden until a provider is connected.
export const TOWN_NAVIGATION = Object.freeze([
  { id: 'heroes', label: 'Heroes', group: 'character', scene: 'HeroesScene' },
  { id: 'abilities', label: 'Abilities', group: 'character', scene: 'AbilitiesScene' },
  { id: 'equipment', label: 'Equipment', group: 'character', scene: 'EquipmentScene' },
  { id: 'tactics', label: 'Tactics', group: 'character', scene: 'TacticsScene' },
  { id: 'items', label: 'Items', group: 'character', scene: 'InventoryScene' },
  { id: 'quests', label: 'Quests', group: 'town', scene: 'QuestJournalScene' },
  { id: 'market', label: 'Market', group: 'town', scene: 'MarketScene' },
  { id: 'tavern', label: 'Tavern', group: 'town', scene: 'TavernScene' },
  { id: 'exchange', label: 'Exchange', group: 'town', scene: 'ExchangeScene' }
].map(destination => Object.freeze({ badge: null, effect: 'town-hub-selection', ...destination })));
