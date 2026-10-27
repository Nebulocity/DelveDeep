import { contains } from './TutorialTargets.js';

const inputEvent = name => /^(pointer|drag|drop|wheel|gameobject)/.test(name);
const cleanupEvent = name => ['pointerout', 'pointerupoutside', 'gameout'].includes(name);

// Intercept dispatch before any existing object or scene handler runs. This covers
// raw world taps and custom controls as well as ButtonPress. No input flag is changed.
export default class TutorialInputGate {
  constructor(service) { this.service = service; this.installed = new WeakMap(); this.press = null; }

  reset() { this.press = null; this.gesture = null; }

  install(scene) {
    if (this.installed.has(scene)) return;
    const service = this.service, input = scene.input, cleanups = [], objects = new Map();
    const wrap = (owner, method, replacement) => {
      const original = owner[method];
      const wrapped = replacement(original);
      owner[method] = wrapped;
      cleanups.push(() => { if (owner[method] === wrapped) owner[method] = original; });
    };
    const attach = object => {
      if (objects.has(object)) return;
      const unregister = service.targets.register(scene, () => object.name, {
        object, receiver: object, action: () => object.name,
        camera: () => scene.cameras.cameras.find(camera => {
          if (!camera.visible) return false;
          for (let node = object; node; node = node.parentContainer) if (node.cameraFilter & camera.id) return false;
          return true;
        })
      });
      const original = object.emit;
      const gate = this;
      object.emit = function(name, ...args) {
        let clickedInteraction = null, clickedId = null;
        if (name === 'pointerout' && gate.press?.object === object && gate.press.pointerId === args[0]?.id) gate.press = null;
        if (service.ownsInput() && inputEvent(name) && !cleanupEvent(name)) {
          const pointer = args[0];
          // Object wheel events precede Phaser's scene wheel event. Deliver the scoped
          // list handler before consuming propagation, even over an interactive card.
          if (name === 'wheel' && gate.dispatchSupportingInput(scene, name, [pointer, [object], ...args.slice(1, 4)])) {
            args.at(-1)?.stopPropagation?.();
            return false;
          }
          // Moving across a card also consumes Phaser propagation. Keep an already
          // approved list gesture moving across cards, not just through their gaps.
          if (name === 'pointermove' && gate.dispatchSupportingInput(scene, name, [pointer])) {
            args.at(-1)?.stopPropagation?.();
            return false;
          }
          if (name === 'pointerdown') gate.captureGesture(scene, pointer, object);
          if (!service.allowsObject(scene, object, pointer)) return false;
          if (/^(drag|drop)/.test(name) && (!gate.gesture || gate.gesture.pointerId !== pointer.id
            || gate.gesture.downTime !== pointer.downTime || gate.gesture.revision !== service.revision)) return false;
          if (name === 'pointerdown') {
            if (gate.press && gate.press.pointerId !== pointer.id) return false;
            gate.press = { pointerId: pointer.id, downTime: pointer.downTime, object, revision: service.revision };
          }
          if (name === 'pointerup' && (!gate.press || gate.press.object !== object
            || gate.press.pointerId !== pointer.id || gate.press.downTime !== pointer.downTime
            || gate.press.revision !== service.revision)) return false;
          if (name === 'pointerup' && scene === service.storyInteraction?.scene
            && service.storyInteraction.allowed.includes(object.name)
            && !service.targets.resolve(object.name, scene)?.visualOnly
            && (pointer.button === undefined || pointer.button === 0)
            && Math.hypot(pointer.x - pointer.downX, pointer.y - pointer.downY) <= 24) {
            clickedInteraction = service.storyInteraction;
            clickedId = object.name;
          }
          if (['pointerdown', 'pointerup', 'pointermove', 'wheel'].includes(name)) args.at(-1)?.stopPropagation?.();
        }
        const result = original.call(this, name, ...args);

        // Let the real control run first, including requesting scene navigation.
        // Keep the captured line so this release cannot complete its successor too.
        if (clickedInteraction?.onTargetClick) queueMicrotask(() => clickedInteraction.onTargetClick(clickedId));
        if (service.ownsInput() && name === 'pointerup') {
          gate.dispatchSupportingInput(scene, name, [args[0]]);
          gate.reset();
        }
        return result;
      };
      const wrapped = object.emit;
      const remove = () => {
        if (object.emit === wrapped) object.emit = original;
        unregister(); objects.delete(object);
        object.off('destroy', remove);
      };
      object.once('destroy', remove);
      objects.set(object, remove);
    };
    // enable is the shared endpoint for texture, custom shape and draggable hit areas.
    wrap(input, 'enable', original => function(object, ...args) {
      const result = original.call(this, object, ...args);
      attach(object);
      return result;
    });
    wrap(input, 'hitTestPointer', original => function(pointer) {
      const hits = original.call(this, pointer);
      if (!service.ownsInput() || hits.length < 2) return hits;
      this.sortGameObjects(hits, pointer);
      return hits.slice(0, 1);
    });
    for (const object of [...(input._list ?? []), ...(input._pendingInsertion ?? [])]) attach(object);
    wrap(input, 'emit', original => function(name, ...args) {
      if (service.ownsInput() && inputEvent(name) && !cleanupEvent(name)) {
        if (name === 'pointerdown') service.gate.captureGesture(scene, args[0]);
        service.gate.dispatchSupportingInput(scene, name, args);

        // Phaser visits the overlay before the gameplay scene, even without a hit.
        // Its raw release must not revoke the underlying scene's approved press.
        if (name === 'pointerup' && scene === service.scene) service.gate.reset();
        return false;
      }
      if (service.ownsInput() && scene === service.scene && ['pointerupoutside', 'gameout'].includes(name)) service.gate.reset();
      return original.call(this, name, ...args);
    });
    if (input.keyboard) wrap(input.keyboard, 'emit', original => function(name, ...args) {
      if (service.ownsInput() && /^key/.test(name)) {
        if (name === 'keydown-ESC') service.exit();
        return false;
      }
      return original.call(this, name, ...args);
    });
    const dispose = () => {
      for (const remove of [...objects.values()]) remove();
      for (const cleanup of cleanups.reverse()) cleanup();
      scene.events.off('shutdown', dispose);
      this.installed.delete(scene);
      this.reset();
    };
    this.installed.set(scene, dispose);
    scene.events.once('shutdown', dispose);
  }

  captureGesture(scene, pointer, object = null) {
    if (scene !== this.service.scene || !pointer || this.gesture) return;
    const entries = this.service.allowed().map(id => ({ id, entry: this.service.targets.resolve(id, scene) }))
      .filter(({ entry }) => entry?.kinds?.some(kind => kind === 'gesture' || kind === 'drag') && contains(entry.bounds, pointer));

    // A thumb owns its drag instead of borrowing the surrounding list's gesture lease.
    const chosen = entries.find(({ entry }) => entry.object === object && entry.kinds.includes('drag')) ?? entries[0];
    if (chosen) {
      const { id, entry } = chosen;
      this.gesture = { pointerId: pointer.id, downTime: pointer.downTime,
        generation: entry.generation, id, revision: this.service.revision, authorityId: this.service.controller.progress.authorityId };
      const handlers = typeof entry.handlers === 'function' ? entry.handlers() : entry.handlers;
      handlers?.pointerdown?.(pointer);
      return;
    }
  }

  dispatchSupportingInput(scene, name, args) {
    const [pointer, receiver] = args;
    if (scene !== this.service.scene || !pointer) return;
    const dragging = name.startsWith('drag') || name === 'drop';
    const kind = dragging ? 'drag' : name === 'wheel' ? 'wheel' : 'gesture';
    if (name === 'pointerdown') return;
    for (const id of this.service.allowed()) {
      const entry = this.service.targets.resolve(id, scene);
      if (!entry?.kinds?.includes(kind)) continue;
      const handlers = typeof entry.handlers === 'function' ? entry.handlers() : entry.handlers;
      const handler = handlers?.[name];
      if (!handler || dragging && entry.object !== receiver) continue;
      if (kind !== 'wheel' && (!this.gesture || this.gesture.pointerId !== pointer.id
        || this.gesture.downTime !== pointer.downTime || this.gesture.generation !== entry.generation
        || this.gesture.revision !== this.service.revision || this.gesture.id !== id)) continue;
      if (!contains(entry.bounds, pointer) && !dragging && !(name === 'pointerup' && this.gesture?.pointerId === pointer.id)) continue;
      handler(...args);
      if (name === 'pointerup') this.gesture = null;
      return true;
    }
  }
}
