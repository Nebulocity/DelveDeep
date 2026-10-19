// This is a browser check for the game. Playwright drives the page while the visual QA
// bridge exposes live Phaser scenes. page.evaluate runs in the browser, not in this test
// process, so values cross that boundary as plain serializable data. Wait for observable
// state before checking it; asset loading and animations take time.

import GameState from '../../game/GameState.js';
import { getDelveById } from '../../data/delves.js';

// A Set keeps each value once. has checks membership without searching a list for
// duplicate entries.

// Objects inside containers need a recursive walk. A Set prevents duplicate entries.
function collectDisplayObjects(scene) {
  const seen = new Set();
  const objects = [];

  function visit(object, parentVisible = true, parentAlpha = 1, parentPath = '') {
    if (!object || seen.has(object)) return;
    seen.add(object);

    const visible = parentVisible && object.active !== false && object.visible !== false;
    const alpha = parentAlpha * (Number.isFinite(object.alpha) ? object.alpha : 1);
    const path = `${parentPath}/${objects.length}`;
    objects.push({ object, visible, alpha, path });

    if (Array.isArray(object.list)) {
      for (const child of object.list) visit(child, visible, alpha, path);
    }
  }

  for (const object of scene.children?.list ?? []) visit(object);
  return objects;
}

function finiteBounds(object) {
  if (typeof object.getBounds !== 'function') return null;
  try {
    const rect = object.getBounds();
    const values = [rect.x, rect.y, rect.width, rect.height];
    if (!values.every(Number.isFinite)) return null;
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  } catch {
    return null;
  }
}

// Expose controlled scene activation and inspection only in a requested development QA
// session.
export function installVisualQaBridge(game) {
  // Read the actual registration so new destinations cannot silently miss discovery.
  const SCENES = new Set(Object.keys(game.scene.keys).filter(key => key !== 'BootScene'));
  window.__DELVE_DEEP_VISUAL_QA__ = {
    game,

    // We handle state here, keeping this operation in one place for its callers.
    get state() { return GameState; },
    scenes: [...SCENES],

    // Include disabled and masked controls, then ask Phaser which of five sample points
    // really hits each surface. A bounding rectangle alone cannot prove reachability.
    audit(sceneName) {
      const scene = game.scene.getScene(sceneName);
      const entries = collectDisplayObjects(scene);
      const controls = entries.filter(entry => entry.object.input);
      const canvas = game.canvas.getBoundingClientRect();
      const sx = canvas.width / game.scale.width;
      const sy = canvas.height / game.scale.height;
      const enabled = this.discover(sceneName).objects;
      const objects = controls.map(({ object, visible, alpha, path }) => {
        const camera = [...scene.cameras.cameras].reverse().find(candidate => object.willRender(candidate)) ?? scene.cameras.main;
        const bounds = finiteBounds(object);
        const found = enabled.find(item => item.id === `${sceneName}:${path}`);
        const logical = found?.logicalBounds;
        const points = logical ? [[0.5, 0.5], [0.15, 0.5], [0.85, 0.5], [0.5, 0.15], [0.5, 0.85]].map(([x, y]) => {
          const pointer = { x: logical.x + logical.width * x, y: logical.y + logical.height * y };
          const hits = scene.input.manager.hitTest(pointer, scene.input._list, camera, []);
          scene.input.sortGameObjects(hits, { camera });
          return { x: canvas.x + pointer.x * sx, y: canvas.y + pointer.y * sy,
            hitsSelf: hits.includes(object), topmost: hits[0] === object };
        }) : [];
        return { ...found, id: `${sceneName}:${path}`, name: object.name, type: object.type,
          label: found?.label ?? object.name ?? object.text ?? object.type,
          visible, effectiveAlpha: alpha, enabled: object.input.enabled, worldBounds: bounds,
          registeredForInput: scene.input._list.includes(object),
          events: object.eventNames().filter(name => String(name).startsWith('pointer')),
          hitArea: object.input.hitArea ? { x: object.input.hitArea.x, y: object.input.hitArea.y,
            width: object.input.hitArea.width, height: object.input.hitArea.height, radius: object.input.hitArea.radius } : null,
          probes: points };
      });
      return { scene: sceneName, active: scene.sys.isActive(), objects,
        texts: entries.filter(e => e.visible && e.alpha > 0 && e.object.type === 'Text')
          .map(e => ({ text: e.object.text, bounds: finiteBounds(e.object), masked: !!(e.object.mask || e.object.parentContainer?.mask) })),
        lifecycle: { objects: entries.length, tweens: scene.tweens.getTweens().length,
          inputListeners: Object.fromEntries(scene.input.eventNames().map(name => [name, scene.input.listenerCount(name)])) },
        inspection: this.inspect(sceneName), canvas: { x: canvas.x, y: canvas.y, width: canvas.width, height: canvas.height },
        viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
        domOverflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight };
    },

    // We handle activate here, keeping this operation in one place for its callers.
    activate(sceneName, options = {}) {
      if (!SCENES.has(sceneName)) throw new Error(`Unsupported visual QA scene: ${sceneName}`);
      const current = game.scene.getScenes(true)[0];
      if (!current || current.scene.key === 'BootScene') throw new Error('BootScene has not finished');

      // ?? uses the fallback only for null or undefined. A real zero or false stays
      // intact.
      const delve = getDelveById(options.delve ?? (sceneName === 'RewardScene' ? 'murmuring-abyss' : 'slime-cave'));
      GameState.currentDelve = delve;
      if (sceneName === 'BattleScene' || sceneName === 'DungeonScene') {

        // map builds one output entry for each input entry, in the same order. The
        // callback's return value becomes that output entry.
        // Match Party Select's role limits and include a healer in representative HUDs.
        const party = [GameState.roster.find(hero => hero.role === 'Tank'),
          GameState.roster.find(hero => hero.role === 'Healer'),
          ...GameState.roster.filter(hero => ['Melee DPS', 'Ranged DPS'].includes(hero.role)).slice(0, 3)].filter(Boolean);
        if (party.length !== 5) throw new Error('QA requires a tank, healer and three damage dealers');
        GameState.activeParty = party.map(member => ({ ...member }));
      }

      // Give the outcome capture a representative retreat instead of an empty fallback.
      if (sceneName === 'EncounterSummaryScene') {
        const defeated = options.result === 'defeat';
        GameState.run.summary = {
          result: defeated ? 'defeat' : 'fled', title: defeated ? 'DEFEAT' : 'PARTY FLED', elapsedMs: 65000,
          message: defeated
            ? 'The party was driven back. Cleared wave rewards and the camp checkpoint remain saved.'
            : 'Cleared wave rewards remain banked.'
        };
      }

      // Capture the new equipment line with a representative final-boss reward.
      // These are display fixtures only; opening the screen does not grant inventory.
      if (sceneName === 'RewardScene') {
        GameState.rewards = [{ type: 'gold', amount: 25 },
          { type: 'equipment', itemId: 'R1AP01', name: 'The Last Muster', count: 1, rarity: 'rare' }];
        GameState.run.summary = { result: 'victory', elapsedMs: 135000, isNewBest: true,
          leaderResult: { renownPointsEarned: 1 }, adventurers: GameState.roster.slice(0, 5).map(hero => ({
            name: hero.name, xpGained: 35, level: hero.level, levelsGained: 0, happiness: hero.happiness
          })) };
      }

      GameState.run.entry = 'progress';

      // The condition before ? chooses the first value when true and the value after :
      // when false.
      const data = sceneName === 'TownScene'
        ? { townId: 'pineshire', townName: 'Pineshire' }
        : sceneName === 'FacilityScene'
          ? { title: options.facility ?? 'Alchemist' }
          : undefined;

      // ?. only follows this link when the value exists; a missing optional value gives
      // undefined.
      current.selectionDetailsClose?.();
      if (sceneName === 'TitleScene') current.selectionDetailsClose ??= null;

      current.scene.start(sceneName, options.data ?? data);
    },

    // Discover rendered interactive objects without clicking or changing game state.
    // The output is JSON-safe so Playwright can save it directly into a report.
    discover(sceneName) {
      const scene = game.scene.getScene(sceneName);
      const active = scene.sys.isActive();
      const canvas = game.canvas;
      const canvasRect = canvas.getBoundingClientRect();
      const logicalWidth = game.scale.gameSize.width;
      const logicalHeight = game.scale.gameSize.height;
      const scaleX = canvasRect.width / logicalWidth;
      const scaleY = canvasRect.height / logicalHeight;

      if (!active) return { scene: sceneName, active, objects: [], count: 0 };

      const all = collectDisplayObjects(scene);
      const labels = all.filter(({ object, visible, alpha }) =>
        visible && alpha > 0 && object.type === 'Text' && typeof object.text === 'string');

      const objects = all.filter(({ object, visible, alpha }) =>
        visible && alpha > 0 && object.input?.enabled).map(({ object, path }) => {
        const camera = [...scene.cameras.cameras].reverse().find(candidate => object.willRender(candidate)) ?? scene.cameras.main;
        const world = finiteBounds(object);
        const fixed = object.scrollFactorX === 0 && object.scrollFactorY === 0;
        const scrollFactorX = Number.isFinite(object.scrollFactorX) ? object.scrollFactorX : 1;
        const scrollFactorY = Number.isFinite(object.scrollFactorY) ? object.scrollFactorY : 1;

        // For unrotated cameras this converts Phaser world bounds into screen pixels.
        // Rotated cameras, custom transforms, and unusual hit areas need review.
        const corners = world ? [[world.x, world.y], [world.x + world.width, world.y],
          [world.x, world.y + world.height], [world.x + world.width, world.y + world.height]]
          .map(([x, y]) => camera.matrix.transformPoint(x - camera.scrollX * scrollFactorX, y - camera.scrollY * scrollFactorY)) : [];
        const logical = world ? {
          x: Math.min(...corners.map(point => point.x)), y: Math.min(...corners.map(point => point.y)),
          width: Math.max(...corners.map(point => point.x)) - Math.min(...corners.map(point => point.x)),
          height: Math.max(...corners.map(point => point.y)) - Math.min(...corners.map(point => point.y))
        } : null;
        const viewport = logical ? {
          x: canvasRect.x + logical.x * scaleX,
          y: canvasRect.y + logical.y * scaleY,
          width: logical.width * scaleX,
          height: logical.height * scaleY
        } : null;

        const semanticName = ['carved-stone-button', 'region-map-panel'].includes(object.name) ? '' : object.name?.trim();
        let label = object.regionButtonText?.text?.trim() || semanticName || '';
        if (!label && object.type === 'Text' && typeof object.text === 'string') label = object.text.trim();
        if (!label && world) {
          const centerX = world.x + world.width / 2;
          const centerY = world.y + world.height / 2;
          const nearby = labels.filter(({ object: text }) => {
            const bounds = finiteBounds(text);
            return bounds && centerX >= bounds.x - 4 && centerX <= bounds.x + bounds.width + 4
              && centerY >= bounds.y - 4 && centerY <= bounds.y + bounds.height + 4;
          }).sort((a, b) => b.object.depth - a.object.depth)[0];
          if (nearby) label = nearby.object.text.trim();
        }
        if (!label) label = object.texture?.key || object.type || 'Unnamed control';

        const center = viewport ? {
          x: viewport.x + viewport.width / 2,
          y: viewport.y + viewport.height / 2
        } : null;
        const inViewport = center !== null && center.x >= canvasRect.left
          && center.x <= canvasRect.right && center.y >= canvasRect.top
          && center.y <= canvasRect.bottom;

        return {
          id: `${sceneName}:${path}`,
          label: String(label).slice(0, 160),
          type: object.type ?? 'unknown',
          name: object.name ?? '',
          depth: Number.isFinite(object.depth) ? object.depth : 0,
          alpha: Number.isFinite(object.alpha) ? object.alpha : 1,
          worldBounds: world,
          logicalBounds: logical,
          browserBounds: viewport,
          browserCenter: center,
          inViewport,
          fixedToCamera: fixed,
          hitAreaType: object.input?.hitArea?.type ?? null
        };
      });

      return {
        scene: sceneName,
        active,
        count: objects.length,
        canvasBounds: { x: canvasRect.x, y: canvasRect.y, width: canvasRect.width, height: canvasRect.height },
        notes: [
          'Read-only discovery: controls have not been clicked.',
          'Labels inferred from names, text, or texture; verify ambiguous labels.',
          'Bounds are approximate for rotated cameras, scaled containers, and custom hit areas.',
          'Only enabled interactive display-list objects are included; DOM overlays and custom input handlers may need separate discovery.'
        ],
        objects
      };
    },

    // We handle inspect here, keeping this operation in one place for its callers.
    inspect(sceneName) {
      const scene = game.scene.getScene(sceneName);
      const active = scene.sys.isActive();
      const camera = scene.cameras.main;
      const width = game.scale.gameSize.width;
      const height = game.scale.gameSize.height;
      const warnings = [];

      if (!active) return { active, warnings: ['Scene is not active'] };

      // filter keeps entries whose callback returns true; an empty list gives true.
      const entries = scene.children.list.filter((object) =>
        object.active && object.visible && object.alpha > 0 && object.getBounds &&
        (object.type === 'Text' || object.input?.enabled));
      const bounds = (object) => {
        const rect = object.getBounds();
        const fixed = object.scrollFactorX === 0 && object.scrollFactorY === 0;

        // The condition before ? chooses the first value when true and the value after :
        // when false.
        return {
          x: rect.x - (fixed ? 0 : camera.scrollX),
          y: rect.y - (fixed ? 0 : camera.scrollY),
          right: rect.right - (fixed ? 0 : camera.scrollX),
          bottom: rect.bottom - (fixed ? 0 : camera.scrollY)
        };
      };

      const nearDuplicate = (a, b) => {
        // Math.max chooses the largest value; pairing it with Math.min can keep a result
        // inside both a lower and an upper bound.
        const sharedWidth = Math.max(0, Math.min(a.right, b.right) - Math.max(a.x, b.x));
        const sharedHeight = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y));
        const areaA = (a.right - a.x) * (a.bottom - a.y);
        const areaB = (b.right - b.x) * (b.bottom - b.y);

        return Math.min(areaA, areaB) > 2500 && sharedWidth * sharedHeight > 0.8 * Math.max(areaA, areaB);
      };

      for (const object of entries) {
        const rect = bounds(object);

        // every requires all entries to pass the check; an empty list gives true.
        if (!Object.values(rect).every(Number.isFinite)) continue;
        const isWorldMap = sceneName === 'TitleScene' && object.scrollFactorX !== 0;
        if (!isWorldMap && (rect.x < -2 || rect.y < -2 || rect.right > width + 2 || rect.bottom > height + 2)) {
          // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
          warnings.push(`${object.type} ${object.text ?? ''} extends outside the logical viewport`);
        }

        if (object.type !== 'Text') continue;
        const centerX = (rect.x + rect.right) / 2;
        const centerY = (rect.y + rect.bottom) / 2;

        // sort rearranges this array in place. A negative comparator result puts a before
        // b; positive puts a after b; zero keeps them tied.
        const backgrounds = entries.filter((candidate) => candidate !== object && candidate.input?.enabled
          && candidate.type === 'Rectangle')
          .map(bounds)
          .filter((candidate) => centerX >= candidate.x && centerX <= candidate.right
            && centerY >= candidate.y && centerY <= candidate.bottom)
          .sort((a, b) => (a.right - a.x) * (a.bottom - a.y)
            - (b.right - b.x) * (b.bottom - b.y));

        if (backgrounds[0] && (rect.x < backgrounds[0].x - 2 || rect.right > backgrounds[0].right + 2
          || rect.y < backgrounds[0].y - 2 || rect.bottom > backgrounds[0].bottom + 2)) {
          warnings.push(`Text ${object.text} exceeds its interactive rectangle`);
        }
      }

      const buttons = entries.filter((object) => object.input?.enabled && object.type === 'Rectangle');
      for (let i = 0; i < buttons.length; i++) {
        for (let j = i + 1; j < buttons.length; j++) {
          if (nearDuplicate(bounds(buttons[i]), bounds(buttons[j]))) {
            warnings.push(`Interactive rectangles ${i} and ${j} nearly coincide`);
          }
        }
      }

      return { active, logicalViewport: { width, height }, warnings };
    }
  };
}
