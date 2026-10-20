// Shared icon keys keep the supplied artwork consistent across town and battle panels.
import { CLASS_ABILITY_RULES, abilityAllowed } from '../data/replacementAbilities.js';
import { addCategoryIcon } from './CategoryIcons.js';

const classes = Object.keys(CLASS_ABILITY_RULES);
const slug = name => name.toLowerCase().replaceAll(' ', '_');

// Load 128-pixel sources once. Logical display sizes scale with the landscape canvas.
export function preloadIdentityIcons(scene) {
  for (const name of classes) {
    const file = slug(name);
    const artwork = name === 'Runedancer'
      ? new URL('../assets/effects/runedancer/fluorite-rune.png', import.meta.url).href
      : new URL(`../assets/icons/classes/128px/${file}.png`, import.meta.url).href;
    scene.load.image(`class-icon-${file}`, artwork);
  }
  for (const category of ['assault', 'protect', 'restore', 'prepare']) {
    scene.load.image(`category-icon-${category}`, new URL(`../assets/icons/categories/${category}.png`, import.meta.url).href);
  }
}

// Return an ordinary image so its caller's existing modal or scroll cleanup owns it.
export function classIcon(scene, name, x, y, size = 52, depth = 0) {
  return scene.add.image(x, y, `class-icon-${slug(name)}`).setDisplaySize(size, size).setDepth(depth);
}

// Reserve space beside the measured item name for its allowed classes. Keeping icons
// inside the caller's row means its existing scrolling, clipping and cleanup still apply.
export function itemNameClasses(scene, title, names, right, size = 44) {
  if (!names?.length) return [];
  const allowed = [...new Set(names)];
  const gap = 12, step = size + 6;
  const left = title.getBounds().left;
  if (allowed.includes('All')) {
    title.setWordWrapWidth(Math.max(180, right - left - 155));
    const bounds = title.getBounds();
    return [scene.add.text(bounds.right + gap, bounds.top + 5, 'All classes',
      { fontFamily: 'Arial', fontSize: '26px', color: '#ddd5c7' }).setDepth(title.depth).setName('item-all-classes')];
  }
  title.setWordWrapWidth(Math.max(180, right - left - allowed.length * step - gap));
  const bounds = title.getBounds();
  return allowed.map((name, index) => classIcon(scene, name,
    bounds.right + gap + size / 2 + index * step, bounds.top + size / 2, size, title.depth)
    .setName(`item-class-${slug(name)}`));
}

// Learned and Generic dividers use existing role artwork rather than inventing a category.
export function categoryIcon(scene, category, x, y, size = 52, depth = 0) {
  const key = `category-icon-${category?.toLowerCase()}`;
  return scene.textures.exists(key) ? scene.add.image(x, y, key).setDisplaySize(size, size).setDepth(depth)
    : addCategoryIcon(scene, category === 'Learned' ? 'tactics' : 'rune', x, y, 0xe6bd70).setScale(size / 64).setDepth(depth);
}

// Place a title's icon beside its measured text, including wrapped centered headings.
export function titleIcon(scene, title, details, size = 52, depth = 0) {
  if (!title || (!details.className && !details.category)) return null;
  const left = title.x - title.width * title.originX;
  return details.className ? classIcon(scene, details.className, left - size / 2 - 12, title.y, size, depth)
    : categoryIcon(scene, details.category, left - size / 2 - 12, title.y, size, depth);
}

// Class permissions remain independent of learning and the four equipped ability slots.
export function abilityClasses(ability) {
  return classes.filter(name => abilityAllowed(name, ability));
}

// Build a wrapping icon row at the bottom of scrollable details. All includes every class.
export function usableByIcons(scene, names, x, y, width, depth, color = '#fff1d2') {
  if (!names?.length) return { objects: [], height: 0 };
  const allowed = names.includes('All') ? classes : names;
  const labelWidth = 190, step = 68, size = 56;
  const columns = Math.max(1, Math.floor((width - labelWidth) / step));
  const objects = [scene.add.text(x, y, 'Usable By:', { fontFamily: 'Arial', fontSize: '34px', color })
    .setOrigin(0, 0.5).setDepth(depth)];
  allowed.forEach((name, index) => {
    objects.push(classIcon(scene, name, x + labelWidth + index % columns * step + size / 2,
      y + Math.floor(index / columns) * step, size, depth).setName(`usable-by-${slug(name)}`));
  });
  return { objects, height: Math.ceil(allowed.length / columns) * step + 20 };
}
