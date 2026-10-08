export const UNIT_VIEWS = ['container', 'body', 'hitZone', 'label', 'targetLabel',
  'actionLabel', 'hpGlow', 'hpBack', 'hpFill', 'castBack', 'castFill', 'spriteVisual'];

// Stand-ins retain lifecycle checks without allocating textures, text, or game objects.
class DeferredDisplay {
  constructor() { this.active = true; this.x = 0; this.y = 0; this.alpha = 1; }
  destroy() { this.active = false; }
}

for (const name of ['setStrokeStyle', 'setFillStyle', 'setAlpha', 'setVisible', 'setPosition',
  'setScale', 'setDepth', 'setOrigin', 'setText', 'setColor', 'setY', 'setName', 'setTint', 'setTintFill', 'clearTint',
  'setInteractive', 'disableInteractive', 'on', 'add', 'addAt', 'stop', 'remove']) {
  DeferredDisplay.prototype[name] = function () { return this; };
}

export function deferredDisplay() { return new DeferredDisplay(); }

export function deferredSprite(definition) {
  if (!definition) return null;
  return { definition, image: deferredDisplay(), play() {}, update() {}, reset() {}, syncHitZone() {} };
}

export function deferUnitPresentation(unit) {
  const views = Object.fromEntries(UNIT_VIEWS.map(key => [key, unit[key]]));
  const display = deferredDisplay();
  display.active = unit.container?.active !== false;
  for (const key of UNIT_VIEWS) unit[key] = key === 'spriteVisual' ? deferredSprite(views.spriteVisual?.definition) : display;
  return views;
}
