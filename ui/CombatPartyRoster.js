import AnimatedCombatPortrait from './AnimatedCombatPortrait.js';
import OrnateResourceBar, { CARD_SECONDARY_RESOURCES } from './OrnateResourceBar.js';
import { combatHudLayout, combatPanel, combatButton, combatText } from './CombatHudTheme.js';
import { bindSelectionDetails, characterDetails } from './SelectionDetails.js';
import { bindButtonPress } from './ButtonPress.js';

export function createCombatPartyRoster(scene) {
  const layout = combatHudLayout(scene);
  const width = layout.rosterWidth - 12;
  scene.partyHud = [];

  // Sort a copy for display only, preserving formation and order within each role group.
  const roleOrder = unit => unit.role === 'Tank' ? 0 : unit.role === 'Healer' ? 1 : 2;
  const roster = [...scene.partyUnits].sort((a, b) => roleOrder(a) - roleOrder(b));
  roster.forEach((unit, index) => {
    const top = layout.rosterTop + index * layout.cardPitch;
    const height = layout.cardPitch - 10;
    const portraitWidth = Math.min(96, width * 0.28);
    const portraitX = 17;
    const portraitCenter = portraitX + portraitWidth / 2;
    const center = 8 + width / 2;
    const panel = combatPanel(scene, center, top + height / 2, width, height, 4501);
    const cardHighlight = scene.add.rectangle(center, top + height / 2, width - 10, height - 10, 0x387bc4, 0.12)
      .setStrokeStyle(4, 0xffd57b).setDepth(4503.5).setVisible(false);
    const statusHitZone = scene.add.rectangle(center, top + height / 2, width, height, 0, 0.001).setDepth(4504);
    bindSelectionDetails(scene, statusHitZone, () => characterDetails(unit), () => {
      // Roster selection never uses battlefield ally-assist targeting.
      scene.radialHud?.close();
      scene.selectRosterUnit(unit);
    });
    const portraitHeight = height - 16;
    const portrait = new AnimatedCombatPortrait(scene, unit,
      { x: portraitX, y: top + 8, width: portraitWidth, height: portraitHeight });
    const textX = portraitX + portraitWidth + 11;
    const hudBarWidth = width - textX - 8;
    const nameText = combatText(scene, textX, top + height * 0.166, unit.name, 29, 4503).setOrigin(0, 0.5);
    const levelText = combatText(scene, width - 8, top + height * 0.326, `Lv ${unit.level}`, 24, 4503,
      { color: '#ffd57b' }).setOrigin(1, 0.5);
    if (nameText.width > hudBarWidth - 32) nameText.setScale((hudBarWidth - 32) / nameText.width);
    const resource = CARD_SECONDARY_RESOURCES.find(config => config.maximum(unit) > 0);
    const hpY = top + height * (resource ? 0.52 : 0.65);
    const barHeight = Math.min(34, height * 0.19);
    const hpBar = new OrnateResourceBar(scene, textX + hudBarWidth / 2, hpY, hudBarWidth, barHeight);
    const resourceBar = resource ? new OrnateResourceBar(scene, textX + hudBarWidth / 2,
      top + height * 0.78, hudBarWidth, barHeight - 2, resource.style) : null;
    const divider = scene.add.graphics().setDepth(4503).lineStyle(1, 0xbc944f, 0.65)
      .lineBetween(textX + 5, top + height * 0.38, width - 12, top + height * 0.38);
    divider.fillStyle(0xe5b56b).fillRect(textX + hudBarWidth / 2 - 2, top + height * 0.38 - 2, 4, 4);
    const potionButton = combatButton(scene, portraitCenter, top + height - 37, portraitWidth + 2, 62, 4505);
    const potionLabel = combatText(scene, portraitCenter, top + height - 37, '', 21, 4506);
    bindSelectionDetails(scene, potionButton, () => scene.potionDetails(unit), () => scene.usePotion(unit));
    bindButtonPress(scene, potionButton, [potionLabel]);
    const entry = { panel, cardHighlight, statusHitZone, potionButton, potionLabel, unit,
      nameText, levelText, portrait, hpBar, resourceBar, resource, portraitHeight };
    entry.updateResources = () => {
      const animate = scene.sys.settings.visible && !scene.idleSimulating
        && !scene.game.backgroundProgress?.hidden && !scene.game.backgroundProgress?.isReplaying;
      hpBar.setValue(unit.hp, unit.maxHp, unit.alive, animate);
      if (resourceBar) resourceBar.setValue(resource.current(unit), resource.maximum(unit), unit.alive, animate);
      portrait.setHeight(potionButton.visible ? Math.max(64, height - 78) : portraitHeight);
    };
    scene.partyHud.push(entry);
  });

  // A single clock listener services five portraits/bars, including countdowns and camps
  // that skip the normal HUD update. Hidden cards never accumulate animation catch-up.
  const update = () => {
    const active = scene.sys.isActive() && scene.sys.settings.visible
      && !scene.idleSimulating && !scene.game.backgroundProgress?.hidden && !scene.game.backgroundProgress?.isReplaying;
    for (const entry of scene.partyHud) {
      const visible = active && entry.panel.visible && entry.statusHitZone.visible;
      entry.portrait.update(visible);
      if (visible) {
        entry.hpBar.update();
        entry.resourceBar?.update();
      }
    }
  };
  scene.events.on('update', update);
  scene.events.once('shutdown', () => scene.events.off('update', update));
  scene.updateHud();
}
