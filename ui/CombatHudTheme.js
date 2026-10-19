// Combat shares Town's painted trim, with midnight faces and restrained crystal accents.
import { serviceFrame } from './TownServiceTheme.js';
import { UI_FONT_FAMILIES } from '../config/uiTypography.js';

export function preloadCombatHud(scene) {
  for (const kind of ['panel', 'option', 'bar']) {
    if (!scene.textures.exists(`town-hub-${kind}`)) {
      scene.load.image(`town-hub-${kind}`, new URL(`../assets/ui/town-hub/${kind}.png`, import.meta.url).href);
    }
  }
}

export function combatText(scene, x, y, value, size = 28, depth = 4602, options = {}) {
  return scene.add.text(x, y, value, {
    fontFamily: UI_FONT_FAMILIES.serif, fontSize: size, fontStyle: 'bold', color: '#fff0d0',
    stroke: '#07111f', strokeThickness: 3, ...options
  }).setOrigin(0.5).setDepth(depth);
}

export function combatPanel(scene, x, y, width, height, depth = 4500) {
  const face = scene.add.rectangle(0, 0, width - 8, height - 8, 0x07182b, 0.96);
  const trim = serviceFrame(scene, 0, 0, width, height, height < 120 ? 'bar' : 'panel', 0.65);
  const tint = scene.add.rectangle(0, 0, width - 28, height - 24, 0x06182e, 0.36);
  return scene.add.container(x, y, [face, trim, tint]).setSize(width, height).setDepth(depth);
}

// Tint the painted pixels themselves so transparent corners stay transparent.
function tintButtonArt(object, color, strength) {
  const channels = [16, 8, 0].map(shift => Math.round(255 * (1 - strength)
    + ((color >> shift) & 255) * strength));
  const tint = (channels[0] << 16) | (channels[1] << 8) | channels[2];
  const apply = child => {
    if (child.setTint) child.setTint(tint);
    else child.list?.forEach(apply);
  };
  apply(object);
}

// Match the existing button surface API so cooldown, potion and farming rules stay owned
// by BattleScene. Only the face moves; the input rectangle remains fixed.
export function combatButton(scene, x, y, width, height, depth = 4600, color = 0x1f2937) {
  const trim = serviceFrame(scene, 0, 0, width, height, height < 120 ? 'bar' : 'panel', 0.65);
  const art = scene.add.container(x, y, [trim]).setSize(width, height).setDepth(depth);
  art.hidePressShadow = true;
  const hit = scene.add.rectangle(x, y, width, height, 0, 0).setDepth(depth + 0.2)
    .setInteractive({ useHandCursor: true });
  hit.pressVisuals = [art];
  hit.setFillStyle = fill => { tintButtonArt(art, fill, 0.15); return hit; };
  hit.setStrokeStyle = (size, stroke, alpha = 1) => { tintButtonArt(art, stroke, size > 0 ? 0.15 * alpha : 0); return hit; };
  hit.setFillStyle(color);
  hit.setVisible = visible => {
    hit.visible = visible;
    hit.pressVisuals.forEach(object => object.setVisible(visible));
    return hit;
  };
  hit.once('destroy', () => hit.pressVisuals.forEach(object => object.destroy()));
  return hit;
}

// CSS applies device safe areas before Phaser FIT scales this logical canvas. Reserving
// logical margins here avoids applying the device insets twice.
export function combatHudLayout(scene) {
  const { width, height } = scene.scale;
  const compact = scene.scale.displaySize.width < 1200;
  const rosterWidth = Math.min(360, width * 0.17);
  const encounterWidth = Math.min(310, width * 0.15);
  const left = rosterWidth + 12;
  const right = width - encounterWidth - 20;
  const span = right - left;
  return {
    width, height, compact, rosterWidth, encounterWidth, left, right,
    rosterTop: 112, cardPitch: (height - 124) / 5,
    radialY: height - 108,
    radialX: [left + 250, left + span * 0.52, right - 250],
    tacticsY: 146, tacticsHeight: 80
  };
}
