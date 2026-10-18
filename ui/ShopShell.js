// Reusable shop shell and controls inherit the Town Hub's illustrated gold framing.
import GameState from '../game/GameState.js';
import { serviceFrame, serviceText, serviceIcon, serviceButton, SERVICE_ICONS } from './TownServiceTheme.js';
import { UI_SAFE_LEFT, UI_SAFE_RIGHT, UI_SAFE_BOTTOM } from './Layout.js';
import { createTownAnimations } from './TownAssets.js';

export function shopLayout(scene) {
  const { width, height } = scene.scale;
  const left = UI_SAFE_LEFT, right = width - UI_SAFE_RIGHT;
  const available = right - left, gap = 28;
  const catalogWidth = Math.round((available - gap) * 0.60);
  const top = scene.scene.key === 'MarketScene' ? 284 : 272, bottom = height - UI_SAFE_BOTTOM - 84;
  return {
    left, right, width: available, gap, top, bottom,
    catalog: { x: left, y: top, width: catalogWidth, height: bottom - top },
    details: { x: left + catalogWidth + gap, y: top, width: available - catalogWidth - gap, height: bottom - top }
  };
}

export function renderShopShell(scene, facility, selected, onSelect, onReturn) {
  const { width, height } = scene.scale;
  scene.cameras.main.setBackgroundColor('#11161b');
  const background = scene.add.image(width / 2, height / 2, facility.background);
  background.setScale(Math.max(width / background.width, height / background.height));
  const layout = shopLayout(scene);
  serviceButton(scene, UI_SAFE_LEFT + 207, 65, 414, 102, 'Return to Town', onReturn,
    { icon: 'town-hub-world-map', slot: 'body36', name: 'facility-return' });
  serviceFrame(scene, width / 2, 75, Math.min(870, width - 1100), 130, 'bar');
  serviceIcon(scene, SERVICE_ICONS[facility.name], width / 2 - 310, 74, 88);
  serviceText(scene, width / 2 + 25, 74, scene.scene.key === 'MarketScene' ? 'Market' : facility.name, 'display54').setOrigin(0.5);
  serviceFrame(scene, layout.right - 170, 65, 340, 96, 'capsule');
  serviceIcon(scene, 'town-hub-gold', layout.right - 280, 65, 64);
  const gold = serviceText(scene, layout.right - 115, 65, `${GameState.gold.toLocaleString('en-US')}`, 'heading40')
    .setOrigin(0.5).setName('shop-gold');
  if (gold.width > 225) gold.setScale(225 / gold.width);
  if (scene.transactionGlow) {
    scene.transactionGlow = false;
    if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches !== true) {
      createTownAnimations(scene);
      const glint = scene.add.sprite(layout.right - 280, 65, 'town-hub-glint')
        .setDisplaySize(70, 105).setDepth(3);
      glint.play('town-hub-selection').once('animationcomplete', () => glint.destroy());
    }
  }
  if (scene.scene.key === 'MarketScene') {
    ['Blacksmith', 'Alchemist', 'Enchanter'].forEach((vendor, index) => {
      serviceButton(scene, width / 2 + (index - 1) * 300, 151, 282, 58, vendor, () => scene.selectMerchant(vendor),
        { selected: scene.vendor === vendor, compact: true, slot: 'body30' });
    });
  } else serviceText(scene, width / 2, 157, facility.subtitle, 'body30', { color: '#d6c5a3' }).setOrigin(0.5);
  const gap = 18, tabWidth = Math.min(360, (layout.width - gap * (facility.choices.length - 1)) / facility.choices.length);
  const first = width / 2 - (tabWidth + gap) * (facility.choices.length - 1) / 2;
  facility.choices.forEach((choice, index) => {
    serviceButton(scene, first + index * (tabWidth + gap), scene.scene.key === 'MarketScene' ? 236 : 221, tabWidth, scene.scene.key === 'MarketScene' ? 74 : 82,
      choice.label, () => onSelect(choice.id), { selected: selected === choice.id, name: `shop-service-${choice.id}` });
  });
  serviceFrame(scene, layout.catalog.x + layout.catalog.width / 2, layout.top + layout.catalog.height / 2,
    layout.catalog.width, layout.catalog.height, 'panel');
  serviceFrame(scene, layout.details.x + layout.details.width / 2, layout.top + layout.details.height / 2,
    layout.details.width, layout.details.height, 'panel');
  serviceText(scene, width / 2, height - UI_SAFE_BOTTOM - 35,
    scene.message || 'Tap an item for details. Drag lists to browse. Hold an item to inspect.', 'body32',
    { color: scene.message ? '#ffdda0' : '#d2c6b1', align: 'center', wordWrap: { width: layout.width - 60 } })
    .setOrigin(0.5).setName('shop-feedback');
  return layout;
}
