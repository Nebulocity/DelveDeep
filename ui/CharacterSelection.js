import GameState from '../game/GameState.js';
import { getEquippedAdventurer } from '../game/Equipment.js';
import { selectionCharacterPortrait } from './SelectedCharacterIdle.js';
import { characterDetails, bindSelectionDetails } from './SelectionDetails.js';
import { serviceText, serviceCard } from './TownServiceTheme.js';
import { featureList, featurePanel } from './TownFeatureUI.js';
import HapticsService from '../services/HapticsService.js';

// Only an ID is shared between screens; every display reads the live roster record.
let selectedId = null;
export function selectedCharacter() {
  return GameState.roster.find(hero => hero.id === selectedId)
    ?? GameState.roster.find(hero => hero.role === 'Tank') ?? GameState.roster[0];
}
export function selectCharacter(id) {
  if (GameState.roster.some(hero => hero.id === id)) selectedId = id;
}

export function characterSelector(scene, bounds, onSelect, { roleOrder } = {}) {
  featurePanel(scene, bounds);
  serviceText(scene, bounds.x + 28, bounds.y + 30, 'Adventurers', 'heading38');
  const entries = [...GameState.roster].sort((a, b) => (roleOrder
    ? (roleOrder.indexOf(a.role) < 0 ? roleOrder.length : roleOrder.indexOf(a.role))
      - (roleOrder.indexOf(b.role) < 0 ? roleOrder.length : roleOrder.indexOf(b.role))
    : a.role.localeCompare(b.role)) || a.name.localeCompare(b.name));
  return featureList(scene, { x: bounds.x + 22, y: bounds.y + 90, width: bounds.width - 66, height: bounds.height - 122 }, entries,
    (hero, x, y, width) => {
      serviceCard(scene, x + width / 2, y + 80, width, 154, { selected: hero.id === selectedCharacter()?.id });
      selectionCharacterPortrait(scene, hero, x + 55, y + 79, 86, 'townRoster', hero.id === selectedCharacter()?.id);
      serviceText(scene, x + 108, y + 14, hero.name, 'body32', { wordWrap: { width: width - 130 }, maxLines: 2 });
      serviceText(scene, x + 108, y + 112, `Lv ${hero.level} · ${hero.shortName ?? hero.className}`, 'support28',
        { wordWrap: { width: width - 130 }, maxLines: 1, color: '#c6bdac' });
      const hit = scene.add.rectangle(x + width / 2, y + 80, width, 154, 0, 0).setName(`character-${hero.id}`);
      bindSelectionDetails(scene, hit, () => characterDetails(getEquippedAdventurer(hero)), () => {
        HapticsService.tap();
        selectCharacter(hero.id);
        scene.characterOffset ??= 0;
        onSelect(hero);
      });
    }, { stride: 172, offset: scene.characterOffset ?? 0, onScroll: value => { scene.characterOffset = value; } });
}
