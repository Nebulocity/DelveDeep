// Shared dialogs also serve Town and the map, so theme only expedition callers.
import { combatPanel, combatButton } from './CombatHudTheme.js';
import { addStonePanel, addStoneButton } from './CarvedStone.js';

export function isExpeditionScene(scene) {
  return ['DelveSelectScene', 'PartySelectScene', 'BattleScene'].includes(scene.scene?.key);
}

export function expeditionPanel(scene, ...args) {
  return (isExpeditionScene(scene) ? combatPanel : addStonePanel)(scene, ...args);
}

export function expeditionButton(scene, ...args) {
  return (isExpeditionScene(scene) ? combatButton : addStoneButton)(scene, ...args);
}
