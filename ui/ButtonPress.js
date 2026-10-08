// A button has a fixed touch target and separate moving artwork. We remember the artwork's
// original y positions, ease it down while held, then restore it on release. The action
// fires on a valid release. Leaving the target, losing focus or opening held details
// cancels that tap, and cleanup removes the handlers when the target is destroyed. Bind
// after selection-details handlers so visual feedback is not captured as a tap action.
export function bindButtonPress(scene, target, labels = [], onClick) {

  // Remember each moving object and its starting y. The stored number is our return
  // position, even after repeated presses. The input area and visual face are separate so
  // the touch target can stay fixed.
  const face = [...(target.pressVisuals ?? [target]), ...labels].map(object => ({ object, y: object.y }));
  const baseY = target.y;

  // The visual depression is capped for large buttons and kept noticeable for small ones.
  // travel is in logical canvas pixels, not device pixels.
  const travel = 5;
  const progress = { value: 0 };

  // ?. only follows this link when the value exists; a missing optional value gives
  // undefined.
  const surface = target.pressVisuals?.[0];

  // The condition before ? chooses the first value when true and the value after : when
  // false.
  const regionTexture = surface?.texture?.key?.startsWith('region-surface-') ? surface.texture.key : null;

  // Origin is the anchor within the object: 0 is the left/top edge, 0.5 is the center and
  // 1 is the right/bottom edge. x/y place that anchor, not necessarily the object's
  // corner.
  const shadow = regionTexture
    ? scene.add.image(target.x, baseY + travel, regionTexture).setDisplaySize(target.width, target.height).setTint(0x080b10)
    : scene.add.rectangle(target.x, baseY + travel, target.width, target.height, 0x080b10)
      .setOrigin(target.originX, target.originY);

  // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
  // lower-depth objects.
  shadow.setDepth((surface?.depth ?? target.depth) - 0.1);

  // Scroll factor controls how much the object follows the camera. Zero keeps it fixed
  // while the world scrolls.
  shadow.setScrollFactor(target.scrollFactorX, target.scrollFactorY);
  let tween = null;
  let pointerId = null;
  let disposed = false;
  const hitTest = target.input.hitAreaCallback;

  // Compensate for the moving face so the original touch target stays fixed.
  target.input.hitAreaCallback = (area, x, y, object) => hitTest(area, x, y + target.y - baseY, object);
  const update = () => {
    shadow.setVisible(target.visible);

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    if (!target.visible || !target.input?.enabled) cancel();
  };

  const animate = (down) => {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    tween?.stop();

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    tween = scene.tweens.add({

      // Animate a fraction from 0 to 1 for press and back for release. 90/140 are
      // milliseconds. Each face's y is original y + fraction * travel, so the icon, title
      // and description all move together without changing spacing.
      targets: progress, value: down ? 1 : 0, duration: down ? 90 : 140, ease: 'Sine.easeOut',

      // Update the affected display or movement values as this tween advances.
      onUpdate: () => face.forEach(({ object, y }) => {
        if (object.active) object.y = y + progress.value * travel;
      })
    });
  };

  const cancel = () => {
    if (disposed || pointerId === null) return;
    pointerId = null;
    animate(false);
  };
  const down = (pointer, x, y, event) => {
    if (pointerId !== null || !pointer || (pointer.button !== undefined && pointer.button !== 0)) return;

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    event?.stopPropagation?.();

    // Remember which finger started the press. Another finger's release must not activate
    // or cancel this finger's button accidentally.
    pointerId = pointer.id;
    animate(true);
  };

  const up = (pointer, x, y, event) => {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    if (pointer?.id !== pointerId || pointerId === null) return;
    event?.stopPropagation?.();
    cancel();
    onClick?.();
  };

  const released = (pointer) => {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    if (pointer?.id === pointerId) cancel();
  };
  const cleanup = () => {
    disposed = true;

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    tween?.stop();
    face.forEach(({ object, y }) => { if (object.active) object.y = y; });
    shadow.destroy();

    // Remove every listener we registered, including ones on input and game emitters that
    // outlive this target. Otherwise a later screen can receive a callback holding a
    // destroyed button.
    target.off('pointerdown', down);
    target.off('pointerup', up);
    target.off('pointerout', cancel);
    scene.input.off('pointerup', released);

    scene.input.off('pointerupoutside', released);
    scene.input.off('gameout', cancel);
    scene.game.events.off('blur', cancel);
    scene.events.off('preupdate', update);
    scene.events.off('shutdown', cleanup);
    target.off('destroy', cleanup);
  };

  // on registers a callback for later events; it does not call that callback now.
  // Long-lived emitters need matching listener cleanup.
  target.on('pointerdown', down);
  target.on('pointerup', up);
  target.on('pointerout', cancel);
  scene.input.on('pointerup', released);
  scene.input.on('pointerupoutside', released);
  scene.input.on('gameout', cancel);
  scene.game.events.on('blur', cancel);

  scene.events.on('preupdate', update);

  // once registers a callback that removes itself after the first matching event.
  scene.events.once('shutdown', cleanup);
  target.once('destroy', cleanup);
}
