// Hall rooms share the Town Hub's illustrated charcoal and gold materials. Large
// panels carry the carvings; repeated rows and inset details use restrained trim.
import { scrollbarSurface } from './Scrollbar.js';
import { serviceFrame, serviceCard, serviceIcon } from './TownServiceTheme.js';

export const GUILD = { ink: '#fff1d2', paper: '#ebd7b4', brass: 0xd3a750, bright: 0xffdb86, oak: 0x191f26 };

export function isGuildHall(scene) {
  return ['HeroesScene', 'AbilitiesScene', 'EquipmentScene', 'InventoryScene', 'TacticsScene'].includes(scene.scene?.key);
}

export function guildSurface(scene, x, y, width, height, variant = 'panel', selected = false) {
  if (variant === 'track' || variant === 'thumb') {
    return scrollbarSurface(scene, x, y, width, height, variant).setName(`guild-${variant}`);
  }
  const plain = ['row', 'paper'].includes(variant);
  const surface = plain ? serviceCard(scene, x, y, width, height, { selected, track: variant === 'thumb' })
    : serviceFrame(scene, x, y, width, height, variant === 'beam' ? 'bar' : variant === 'button' ? selected ? 'selected' : 'option' : 'panel');
  return surface.setName(`guild-${variant}`);
}

export function guildCrest(scene, x, y, size = 54, muted = false) {
  return serviceIcon(scene, 'town-hub-heroes', x, y, size).setAlpha(muted ? 0.45 : 1);
}

export function guildRule(scene, x, y, width) {
  const art = scene.add.graphics().setPosition(x, y);
  art.lineStyle(1, GUILD.brass, 0.5).lineBetween(-width / 2, 0, -12, 0).lineBetween(12, 0, width / 2, 0);
  art.lineStyle(2, GUILD.brass, 0.8);
  art.beginPath().moveTo(0, -5).lineTo(7, 0).lineTo(0, 5).lineTo(-7, 0).closePath().strokePath();
  return art;
}
