import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

for (const viewport of [{ width: 915, height: 412 }, { width: 1920, height: 1080 }]) {
  test(`Renown, roster grants and walkable arenas at ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/?visualQa=1');
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
    await page.locator('#loading-screen').waitFor({ state: 'hidden' });
    await mkdir('output/qa/arenas', { recursive: true });
    const controls = await page.evaluate(async () => {
      const { default: state } = await import('/game/GameState.js');
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene');
      scene.showDevelopmentTools();
      const labels = scene.children.list.filter(o => o.depth === 4002 && o.type === 'Text');
      const row = name => labels.find(o => o.text === name).y;
      const tap = (name, y) => {
        const label = scene.children.list.find(o => o.text === name && o.y === y && o.depth === 4003);
        scene.children.list.find(o => o.type === 'Rectangle' && o.x === label.x && o.y === y && o.depth === 4002).emit('pointerdown');
      };
      const before = state.roster.map(hero => ({ level: hero.level, xp: hero.xp, skillPoints: hero.skillPoints }));
      const renown = state.leader.level;
      tap('+1', row('Renown Level'));
      tap('+5', row('Renown Level'));
      tap('+1', row('Character Level'));
      tap('+5', row('Character Level'));
      if (!state.development.showArenaBorder) tap('OFF', row('Arena Border'));
      return { renown: state.leader.level - renown,
        roster: state.roster.every((hero, i) => hero.level === before[i].level + 6
          && hero.skillPoints === before[i].skillPoints + 6 && hero.xp === before[i].xp),
        border: state.development.showArenaBorder };
    });
    expect(controls).toEqual({ renown: 6, roster: true, border: true });
    await page.screenshot({ path: `output/qa/arenas/dev-tools-${viewport.width}.png` });
    await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene').selectionDetailsClose());
    const boundaries = [];
    for (const delve of ['slime-cave', 'thornbriar-hollow', 'dolmark-den', 'murmuring-abyss', 'verdant-tear']) {
      await page.evaluate(id => window.__DELVE_DEEP_VISUAL_QA__.activate('BattleScene', { delve: id }), delve);
      await page.waitForFunction(() => {
        const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
        return scene.sys.isActive() && scene.enemies?.some(e => e.alive && !e.landing);
      });
      await page.waitForTimeout(1500);
      const state = await page.evaluate(() => {
        const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
        scene.togglePause();
        return { boundary: scene.battlefield.boundary, grid: scene.gridCells,
          safe: [...scene.partyUnits, ...scene.enemies].filter(u => u.alive)
            .every(u => !scene.terrain.isUnitBlocked(u, u.arenaX, u.arenaY, 0)),
          cards: scene.partyHud.length };
      });
      expect(state.safe).toBe(true);
      expect(state.grid).toBeUndefined();
      expect(state.cards).toBe(5);
      expect(state.boundary.length).toBeGreaterThan(8);
      boundaries.push(JSON.stringify(state.boundary));
      await page.screenshot({ path: `output/qa/arenas/${delve}-${viewport.width}.png` });
    }
    expect(new Set(boundaries).size).toBe(5);
    expect(errors).toEqual([]);
  });
}
