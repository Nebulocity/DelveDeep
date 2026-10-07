import GameState from '../../game/GameState.js';
import { getDelveById } from '../../data/delves.js';

const SCENES = new Set([
  'TitleScene', 'TownScene', 'AdventurersHallScene', 'BlacksmithScene',
  'FacilityScene', 'ItemsScene', 'RosterScene', 'RaidLeaderScene',
  'ShopScene', 'DelveSelectScene', 'PartySelectScene', 'DungeonScene',
  'BattleScene'
]);

export function installVisualQaBridge(game) {
  window.__DELVE_DEEP_VISUAL_QA__ = {
    game,
    get state() { return GameState; },
    scenes: [...SCENES],
    activate(sceneName, options = {}) {
      if (!SCENES.has(sceneName)) throw new Error(`Unsupported visual QA scene: ${sceneName}`);
      const current = game.scene.getScenes(true)[0];
      if (!current || current.scene.key === 'BootScene') throw new Error('BootScene has not finished');

      const delve = getDelveById(options.delve ?? 'slime-cave');
      GameState.currentDelve = delve;
      if (sceneName === 'BattleScene' || sceneName === 'DungeonScene') {
        GameState.activeParty = GameState.roster.slice(0, 5).map((member) => ({ ...member }));
      }
      GameState.run.entry = 'progress';

      const data = sceneName === 'TownScene'
        ? { townId: 'pineshire', townName: 'Pineshire' }
        : sceneName === 'FacilityScene'
          ? { title: options.facility ?? 'Alchemist' }
          : undefined;
      current.selectionDetailsClose?.();
      if (sceneName === 'TitleScene') current.selectionDetailsClose ??= null;
      current.scene.start(sceneName, data);
    },
    inspect(sceneName) {
      const scene = game.scene.getScene(sceneName);
      const active = scene.sys.isActive();
      const camera = scene.cameras.main;
      const width = game.scale.gameSize.width;
      const height = game.scale.gameSize.height;
      const warnings = [];
      if (!active) return { active, warnings: ['Scene is not active'] };

      const entries = scene.children.list.filter((object) =>
        object.active && object.visible && object.alpha > 0 && object.getBounds &&
        (object.type === 'Text' || object.input?.enabled));
      const bounds = (object) => {
        const rect = object.getBounds();
        const fixed = object.scrollFactorX === 0 && object.scrollFactorY === 0;
        return {
          x: rect.x - (fixed ? 0 : camera.scrollX),
          y: rect.y - (fixed ? 0 : camera.scrollY),
          right: rect.right - (fixed ? 0 : camera.scrollX),
          bottom: rect.bottom - (fixed ? 0 : camera.scrollY)
        };
      };
      const nearDuplicate = (a, b) => {
        const sharedWidth = Math.max(0, Math.min(a.right, b.right) - Math.max(a.x, b.x));
        const sharedHeight = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y));
        const areaA = (a.right - a.x) * (a.bottom - a.y);
        const areaB = (b.right - b.x) * (b.bottom - b.y);
        return Math.min(areaA, areaB) > 2500 && sharedWidth * sharedHeight > 0.8 * Math.max(areaA, areaB);
      };

      for (const object of entries) {
        const rect = bounds(object);
        if (!Object.values(rect).every(Number.isFinite)) continue;
        const isWorldMap = sceneName === 'TitleScene' && object.scrollFactorX !== 0;
        if (!isWorldMap && (rect.x < -2 || rect.y < -2 || rect.right > width + 2 || rect.bottom > height + 2)) {
          warnings.push(`${object.type} ${object.text ?? ''} extends outside the logical viewport`);
        }
        if (object.type !== 'Text') continue;
        const centerX = (rect.x + rect.right) / 2;
        const centerY = (rect.y + rect.bottom) / 2;
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
