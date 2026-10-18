import { sortShopRows } from '../game/ShopServices.js';
import { hallScroll } from './HallUI.js';
import { bindSelectionDetails } from './SelectionDetails.js';
import { serviceText, serviceIcon, serviceCard, serviceButton, serviceScrollSurface, SERVICE_ICONS } from './TownServiceTheme.js';
import { shopItemPresentation } from './ShopItemPresentation.js';
import { UI_FONT_FAMILIES } from '../config/uiTypography.js';
import { showShopDetails } from './ShopDetails.js';
import HapticsService from '../services/HapticsService.js';
import { bindButtonPress } from './ButtonPress.js';

const CATEGORIES = { all: 'All items', weapon: 'Weapons', armor: 'Armor', accessory: 'Accessories',
  potion: 'Potions', material: 'Materials', scroll: 'Scrolls' };

export function renderShopCatalog(scene, choice) {
  const { catalog, details } = scene.shopBounds;
  const allRows = sortShopRows(scene.rowsFor(choice));
  const categories = ['all', ...Object.keys(CATEGORIES).filter(key => key !== 'all' && allRows.some(row => row.category === key))];
  if (!categories.includes(scene.category)) scene.category = 'all';
  const rows = allRows.filter(row => scene.category === 'all' || row.category === scene.category);
  const center = catalog.x + catalog.width / 2;
  serviceText(scene, center, catalog.y + 46, choice.id === 'sell' ? 'Your Inventory' : choice.label, 'heading40').setOrigin(0.5);
  const columns = Math.min(4, categories.length);
  const filterWidth = (catalog.width - 90 - (columns - 1) * 12) / columns;
  categories.forEach((key, index) => {
    serviceButton(scene, catalog.x + 45 + filterWidth / 2 + index % columns * (filterWidth + 12),
      catalog.y + 106 + Math.floor(index / columns) * 74, filterWidth, 64, CATEGORIES[key], () => {
        scene.category = key;
        scene.itemOffset = 0;
        scene.render();
      }, { selected: scene.category === key, compact: true, slot: 'body30', name: `shop-category-${key}` });
  });
  const listTop = catalog.y + 104 + Math.ceil(categories.length / columns) * 74;
  const bounds = { x: catalog.x + 36, y: listTop, width: catalog.width - 92, height: catalog.y + catalog.height - listTop - 40 };
  const stride = 172, gap = 16, cardWidth = (bounds.width - gap) / 2;
  scene.catalogCards = new Map();
  const retained = new Set(scene.children.list);
  rows.forEach((row, index) => {
    const x = bounds.x + cardWidth / 2 + index % 2 * (cardWidth + gap);
    const y = bounds.y + 79 + Math.floor(index / 2) * stride;
    const item = shopItemPresentation(scene, row, choice);
    const active = scene.selectedItemId === row.id;
    const card = serviceCard(scene, x, y, cardWidth, 156, { selected: active, rarity: item.rarity?.color })
      .setName(`shop-card-${row.id}`);
    scene.catalogCards.set(row.id, card);
    const icon = serviceIcon(scene, item.icon, x - cardWidth / 2 + 63, y - 9, 90);
    const title = serviceText(scene, x - cardWidth / 2 + 120, y - 60, row.name, 'body32', {
      wordWrap: { width: cardWidth - 145 }, maxLines: 2
    });
    const metadata = serviceText(scene, x - cardWidth / 2 + 120, y + 15,
      `${item.rarity?.label ?? CATEGORIES[row.category]} · Owned ${item.count}`, 'support28', { color: item.rarity?.color });
    const price = serviceText(scene, x - cardWidth / 2 + 120, y + 48, row.action, 'body30', { color: row.enabled ? '#ffda8a' : '#b8b0a2' });
    const hit = scene.add.rectangle(x, y, cardWidth, 156, 0, 0).setName(`shop-item-${row.id}`);
    bindSelectionDetails(scene, hit, item.details, () => {
      HapticsService.tap();
      scene.catalogCards.get(scene.selectedItemId)?.setSelected(false);
      card.setSelected(true);
      scene.selectedItemId = row.id;
      scene.detailOffset = 0;
      rebuildDetails(scene, choice, row, details);
    });
    hit.pressVisuals = [card, icon, title, metadata, price];
    bindButtonPress(scene, hit);
  });
  scene.itemList = hallScroll(scene, bounds, scene.children.list.filter(object => !retained.has(object)),
    Math.ceil(rows.length / 2) * stride, scene.itemOffset, value => { scene.itemOffset = value; }, serviceScrollSurface);
  if (!rows.length) {
    const message = choice.id === 'sell' ? 'No owned items in this category.'
      : choice.id === 'disenchant' ? 'No gear with known enchantments.'
        : choice.id === 'enchant' ? scene.selectedScroll ? 'No compatible gear without an enchantment.' : 'Buy or inscribe a scroll to begin.' : 'Nothing available.';
    serviceText(scene, center, bounds.y + bounds.height / 2, message, 'body34', {
      align: 'center', wordWrap: { width: bounds.width - 90 }, fontFamily: UI_FONT_FAMILIES.sans
    }).setOrigin(0.5);
  }
  serviceText(scene, center, catalog.y + catalog.height - 20, `${rows.length} items`, 'support28', { color: '#c6bdac' }).setOrigin(0.5);
  const row = rows.find(entry => entry.id === scene.selectedItemId);
  rebuildDetails(scene, choice, row, details);
}

// Item selection preserves the catalog, its scroll position and the shop background.
// Only the details workspace and the two affected selection outlines change.
function rebuildDetails(scene, choice, row, bounds) {
  for (const object of scene.shopDetailObjects ?? []) {
    if (object.active) object.destroy();
  }
  const retained = new Set(scene.children.list);
  renderItemDetails(scene, choice, row, bounds);
  scene.shopDetailObjects = scene.children.list.filter(object => !retained.has(object));
}

function renderItemDetails(scene, choice, row, bounds) {
  const center = bounds.x + bounds.width / 2;
  if (choice.id === 'enchant' && scene.selectedScroll) {
    serviceButton(scene, center, bounds.y + 48, bounds.width - 110, 64, 'Back to Scrolls', () => {
      scene.selectedScroll = null;
      scene.selectedItemId = null;
      scene.category = 'all';
      scene.itemOffset = 0;
      scene.render();
    }, { compact: true, name: 'enchant-back-to-scrolls' });
  } else serviceText(scene, center, bounds.y + 46, 'Item Details', 'heading40').setOrigin(0.5);
  if (!row) {
    scene.selectedItemId = null;
    serviceIcon(scene, SERVICE_ICONS[scene.facility.name], center, bounds.y + 215, 154).setAlpha(0.65);
    serviceText(scene, center, bounds.y + 350, 'Select an item', 'heading40').setOrigin(0.5);
    serviceText(scene, center, bounds.y + 418, choice.description, 'body32', {
      align: 'center', wordWrap: { width: bounds.width - 150 }, fontFamily: UI_FONT_FAMILIES.sans, color: '#c6bdac'
    }).setOrigin(0.5);
    return;
  }
  const item = shopItemPresentation(scene, row, choice);
  serviceIcon(scene, item.icon, bounds.x + 100, bounds.y + 140, 124);
  const title = serviceText(scene, bounds.x + 184, bounds.y + 94, row.name, 'heading40', {
    wordWrap: { width: bounds.width - 250 }, maxLines: 2
  });
  serviceText(scene, bounds.x + 184, Math.max(bounds.y + 177, title.y + title.height + 6), item.rarity?.label ?? '', 'body30', { color: item.rarity?.color });
  const bodyBounds = { x: bounds.x + 52, y: bounds.y + 230, width: bounds.width - 126, height: bounds.height - 420 };
  const body = serviceText(scene, bodyBounds.x, bodyBounds.y, item.details.description, 'body32', {
    fontFamily: UI_FONT_FAMILIES.sans, wordWrap: { width: bodyBounds.width - 12 }, lineSpacing: 8
  });
  scene.detailList = hallScroll(scene, bodyBounds, [body], body.height, scene.detailOffset ?? 0,
    value => { scene.detailOffset = value; }, serviceScrollSurface);
  const reason = item.unavailable || 'Hold the item for full inspection.';
  serviceText(scene, center, bounds.y + bounds.height - 152, reason, 'body30', {
    align: 'center', color: item.unavailable ? '#e7b7a5' : '#c6bdac', wordWrap: { width: bounds.width - 110 }
  }).setOrigin(0.5);
  const actionY = bounds.y + bounds.height - 72;
  const actionWidth = row.runAll ? (bounds.width - 130) / 2 : bounds.width - 110;
  const run = action => {
    if (row.action === 'SELECT') scene.selectedItemId = null;
    scene.transact(action);
  };
  serviceButton(scene, row.runAll ? center + actionWidth / 2 + 10 : center, actionY, actionWidth, 88,
    row.action, () => run(row.run), { enabled: Boolean(row.enabled), name: `shop-action-${row.id}`, slot: 'body32', haptic: false });
  if (row.runAll) serviceButton(scene, center - actionWidth / 2 - 10, actionY, actionWidth, 88,
    row.allAction, () => run(row.runAll), { enabled: Boolean(row.enabled), name: `shop-sell-all-${row.id}`, slot: 'body30', haptic: false });
  const inspect = scene.add.rectangle(bounds.x + 104, bounds.y + 140, 144, 144, 0, 0);
  bindSelectionDetails(scene, inspect, item.details, () => showShopDetails(scene, item.details));
}
