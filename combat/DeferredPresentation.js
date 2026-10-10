// These lightweight stand-ins let gameplay keep calling its usual display methods while
// background catch-up avoids creating all the missed graphics. They keep enough state for
// lifecycle checks and feet placement. They are temporary views, not a second combat
// model.

export const UNIT_VIEWS = ['container', 'body', 'hitZone', 'label', 'targetLabel',
  'actionLabel', 'hpGlow', 'hpBack', 'hpFill', 'castBack', 'castFill', 'spriteVisual'];

// Stand-ins retain lifecycle checks without allocating textures, text, or game objects.
class DeferredDisplay {

  // We set up this instance's starting state. Values stored on this belong to this
  // instance and can be reused by its other methods.
  constructor() {
    this.active = true;
    this.x = 0;
    this.y = 0;
    this.alpha = 1;
  }

  // We release the objects and handlers owned here. Scene changes can happen more than
  // once, so cleanup must not leave a listener or timer operating on a screen that has
  // already gone away.
  destroy() { this.active = false; }
}

for (const name of ['setStrokeStyle', 'setFillStyle', 'setAlpha', 'setVisible', 'setPosition',
  'setScale', 'setDepth', 'setOrigin', 'setText', 'setColor', 'setY', 'setName', 'setTint', 'setTintFill', 'clearTint',
  'setInteractive', 'disableInteractive', 'on', 'add', 'addAt', 'stop', 'remove']) {
  DeferredDisplay.prototype[name] = function () { return this; };
}

// Make a lightweight display stand-in for temporary background catch-up.
export function deferredDisplay() { return new DeferredDisplay(); }

// Make the sprite stand-in that preserves the metadata gameplay needs while drawing is
// deferred.
export function deferredSprite(definition) {
  if (!definition) return null;
  return { definition, image: deferredDisplay(), play() {}, update() {}, reset() {}, syncHitZone() {} };
}

// Remember the real unit views and install temporary display stand-ins for catch-up.
export function deferUnitPresentation(unit) {

  // Object.fromEntries turns [key, value] pairs back into an object. A later pair with the
  // same key replaces the earlier value. map builds one output entry for each input entry,
  // in the same order. The callback's return value becomes that output entry.
  const views = Object.fromEntries(UNIT_VIEWS.map(key => [key, unit[key]]));
  const display = deferredDisplay();

  // ?. only follows this link when the value exists; a missing optional value gives
  // undefined.
  display.active = unit.container?.active !== false;
  for (const key of UNIT_VIEWS) unit[key] = key === 'spriteVisual' ? deferredSprite(views.spriteVisual?.definition) : display;
  return views;
}
