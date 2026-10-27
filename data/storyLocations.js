import { pois, regions } from './worldMap.js';

// The catalog is the only scene routing authority exposed to story authors.
// Story files store location IDs, never executable scene names or scene arguments.
const interiors = [
  ['heroes', 'Heroes', 'HeroesScene'], ['manage-party', 'Manage Party', 'PartySelectScene'],
  ['abilities', 'Abilities', 'AbilitiesScene'],
  ['equipment', 'Equipment', 'EquipmentScene'], ['tactics', 'Party Tactics', 'TacticsScene'],
  ['items', 'Inventory', 'InventoryScene'], ['quests', 'Quest Journal', 'QuestJournalScene'],
  ['market', 'Market', 'MarketScene'], ['tavern', 'Tavern', 'TavernScene'],
  ['exchange', 'Exchange', 'ExchangeScene'], ['alchemist', 'Alchemist', 'FacilityScene', 'Alchemist'],
  ['blacksmith', 'Blacksmith', 'BlacksmithScene', 'Blacksmith'], ['enchanter', 'Enchanter', 'FacilityScene', 'Enchanter']
];
export const STORY_LOCATIONS = regions.flatMap(region => [
  { id: region.id, label: region.name, parentId: null, regionId: region.id, kind: 'region', scene: 'TitleScene', data: {} },
  ...pois.flatMap(poi => {
    const location = { id: poi.id, label: poi.name, parentId: region.id, regionId: region.id,
      kind: poi.type === 'town' ? 'town' : 'delve', scene: poi.type === 'town' ? 'TownScene' : poi.type === 'everdeep' ? 'EverdeepScene' : 'DelveSelectScene',
      data: poi.type === 'town' ? { townId: poi.id, townName: poi.name } : {}, delveId: poi.template ?? poi.id };
    return [location, ...(poi.type === 'town' ? interiors.map(([id, label, scene, title]) => ({
      id: poi.id + '/' + id, label, parentId: poi.id, regionId: region.id, kind: 'interior', scene,
      data: scene === 'PartySelectScene' ? { origin: 'town', returnScene: 'HeroesScene' }
        : title ? { title, returnScene: 'TownScene' } : {}
    })) : [])];
  })
]);
export const storyLocation = id => STORY_LOCATIONS.find(location => location.id === id);
export const storyLocationLabel = id => {
  const location = storyLocation(id), parent = storyLocation(location?.parentId);
  return location ? (location.kind === 'interior' ? parent.label + ' / ' : '') + location.label : 'Choose location';
};
export const storyLocationMatches = (location, scene, state) => {
  if (!location || scene?.scene.key !== location.scene) return false;
  if (location.scene === 'EverdeepScene') return true;
  if (location.scene === 'PartySelectScene') return scene.townParty === true;
  if (location.data.title) return scene.facility?.name === location.data.title;
  if (location.kind === 'delve') return state.currentDelve?.id === location.delveId || state.currentDelve?.id === location.id;
  return true;
};
