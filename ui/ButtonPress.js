// Bind after selection-details handlers so visual feedback is not captured as a tap action.
export function bindButtonPress(scene, target, labels = [], onClick) {
  const face = [...(target.pressVisuals ?? [target]), ...labels].map(object => ({ object, y: object.y }));
  const baseY = target.y;
  const travel = 5;
  const progress = { value: 0 };
  const shadow = scene.add.rectangle(target.x, baseY + travel, target.width, target.height, 0x080b10)
    .setOrigin(target.originX, target.originY).setDepth((target.pressVisuals?.[0]?.depth ?? target.depth) - 0.1);
  shadow.setScrollFactor(target.scrollFactorX, target.scrollFactorY);
  let tween = null;
  let pointerId = null;
  let disposed = false;
  const hitTest = target.input.hitAreaCallback;

  // Compensate for the moving face so the original touch target stays fixed.
  target.input.hitAreaCallback = (area, x, y, object) => hitTest(area, x, y + target.y - baseY, object);
  const update = () => {
    shadow.setVisible(target.visible);
    if (!target.visible || !target.input?.enabled) cancel();
  };
  const animate = (down) => {
    tween?.stop();
    tween = scene.tweens.add({
      targets: progress, value: down ? 1 : 0, duration: down ? 90 : 140, ease: 'Sine.easeOut',
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
    event?.stopPropagation?.();
    pointerId = pointer.id;
    animate(true);
  };
  const up = (pointer, x, y, event) => {
    if (pointer?.id !== pointerId || pointerId === null) return;
    event?.stopPropagation?.();
    cancel();
    onClick?.();
  };
  const released = (pointer) => {
    if (pointer?.id === pointerId) cancel();
  };
  const cleanup = () => {
    disposed = true;
    tween?.stop();
    face.forEach(({ object, y }) => { if (object.active) object.y = y; });
    shadow.destroy();
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
  target.on('pointerdown', down);
  target.on('pointerup', up);
  target.on('pointerout', cancel);
  scene.input.on('pointerup', released);
  scene.input.on('pointerupoutside', released);
  scene.input.on('gameout', cancel);
  scene.game.events.on('blur', cancel);
  scene.events.on('preupdate', update);
  scene.events.once('shutdown', cleanup);
  target.once('destroy', cleanup);
}
