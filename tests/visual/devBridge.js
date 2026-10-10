// This is a browser check for the game. Playwright drives the page while the visual QA
// bridge exposes live Phaser scenes. page.evaluate runs in the browser, not in this test
// process, so values cross that boundary as plain serializable data. Wait for observable
// state before checking it; asset loading and animations take time.

import GameState from '../../game/GameState.js';
import { getDelveById } from '../../data/delves.js';

// A Set keeps each value once. has checks membership without searching a list for
// duplicate entries.
const SCENES = new Set([
  'TitleScene', 'TownScene', 'AdventurersHallScene', 'BlacksmithScene',
  'FacilityScene', 'ItemsScene', 'RosterScene', 'PartyLeaderScene',
  'DelveSelectScene', 'PartySelectScene', 'DungeonScene',
  'BattleScene', 'EncounterSummaryScene'
]);

// Expose controlled scene activation and inspection only in a requested development QA
// session.
export function installVisualQaBridge(game) {

  // ... expands these entries into the new list or call. It does not deep-copy the objects
  // inside.
  window.__DELVE_DEEP_VISUAL_QA__ = {
    game,

    // We handle state here, keeping this operation in one place for its callers.
    get state() { return GameState; },
    scenes: [...SCENES],

    // We handle activate here, keeping this operation in one place for its callers.
    activate(sceneName, options = {}) {
      if (!SCENES.has(sceneName)) throw new Error(`Unsupported visual QA scene: ${sceneName}`);
      const current = game.scene.getScenes(true)[0];
      if (!current || current.scene.key === 'BootScene') throw new Error('BootScene has not finished');

      // ?? uses the fallback only for null or undefined. A real zero or false stays
      // intact.
      const delve = getDelveById(options.delve ?? 'slime-cave');
      GameState.currentDelve = delve;
      if (sceneName === 'BattleScene' || sceneName === 'DungeonScene') {

        // map builds one output entry for each input entry, in the same order. The
        // callback's return value becomes that output entry.
        GameState.activeParty = GameState.roster.slice(0, 5).map((member) => ({ ...member }));
      }

      // Give the outcome capture a representative retreat instead of an empty fallback.
      if (sceneName === 'EncounterSummaryScene') {
        const defeated = options.result === 'defeat';
        GameState.run.summary = {
          result: defeated ? 'defeat' : 'fled', title: defeated ? 'DEFEAT' : 'PARTY FLED', elapsedMs: 65000,
          message: defeated
            ? 'The party was driven back. Cleared wave rewards and the camp checkpoint remain saved.'
            : 'Cleared wave rewards remain banked. Tactics Points was reduced.'
        };
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
      current.scene.start(sceneName, data);
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

      // filter keeps entries whose callback returns true. It builds a new list and leaves
      // the original list in place.
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

          // ?? uses the fallback only for null or undefined. A real zero or false stays
          // intact.
          warnings.push(`${object.type} ${object.text ?? ''} extends outside the logical viewport`);
        }

        if (object.type !== 'Text') continue;
        const centerX = (rect.x + rect.right) / 2;
        const centerY = (rect.y + rect.bottom) / 2;

        // sort rearranges this array in place. A negative comparator result puts a before
        // b; positive puts it after; zero keeps them tied. map builds one output entry for
        // each input entry, in the same order. The callback's return value becomes that
        // output entry.
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
