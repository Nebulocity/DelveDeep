import { getCatalogItemDefinition, getMaterialDefinition, ITEM_RARITIES } from '../data/items.js';
import { UI_FONT_FAMILIES } from '../config/uiTypography.js';

export const RESOURCE_GAIN_COLOR = '#d4a017';

export function rewardItemColor(item) {
  const id = item.itemId ?? item.id;
  const rarity = getCatalogItemDefinition(id)?.rarity ?? getMaterialDefinition(id)?.rarity ?? item.rarity;
  return (ITEM_RARITIES[rarity] ?? ITEM_RARITIES.common).color;
}

// Separate text rows allow each gain to keep its color, including wrapped item names.
// The measured container can move, scroll and be destroyed as one display object.
export function rewardTextRows(scene, x, y, rows, style, { centered = false, gap = 0 } = {}) {
  const container = scene.add.container(x, y);
  let height = 0;
  let width = 0;
  for (const row of rows) {
    const text = scene.add.text(0, height, row.text, { ...style, color: row.color ?? style.color })
      .setOrigin(centered ? 0.5 : 0, 0);
    container.add(text);
    width = Math.max(width, text.width);
    height += text.height + gap;
  }
  height = Math.max(0, height - gap);
  if (centered) container.iterate(text => { text.y -= height / 2; });
  return container.setSize(width, height);
}

// Wave 1's banked find uses the clear HUD strip below the banner, above world labels.
// It shares the existing receipt lifetime and has no input surface or extra animation.
export function firstFindReceipt(scene, layout, rows) {
  const width = Math.min(1100, layout.right - layout.left - 96);
  const container = scene.add.container((layout.left + layout.right - width) / 2, 124);
  const background = scene.add.graphics();
  container.add(background);
  let y = 16;
  for (const row of rows) {
    const text = scene.add.text(width / 2, y, row.text, {
      fontFamily: UI_FONT_FAMILIES.serif, fontSize: row.item ? 40 : 32,
      fontStyle: 'bold', color: row.color ?? RESOURCE_GAIN_COLOR, align: 'center',
      stroke: '#080e19', strokeThickness: 2, wordWrap: { width: width - 40 }
    }).setOrigin(0.5, 0);
    container.add(text);
    y += text.height + 4;
  }
  const height = y + 12;
  background.fillStyle(0x171d24, 0.96).fillRoundedRect(0, 0, width, height, 10)
    .lineStyle(2, 0xd3a750, 0.75).strokeRoundedRect(0, 0, width, height, 10);
  return container.setSize(width, height);
}
