// Review the actual saved-map lookup, new scenery and moving light in both layouts.
import { test, expect } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

for (const viewport of [{ width: 915, height: 412 }, { width: 1920, height: 1080 }]) {
  test(`Quarry floor and animated lighting at ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    // A local review build can be served by intercepted browser requests when a
    // sandbox cannot reach localhost. It uses the same bundled game and Phaser code.
    if (process.env.DELVE_QUARRY_REVIEW_ROOT) {
      const root = path.resolve(process.env.DELVE_QUARRY_REVIEW_ROOT);
      await page.route('http://delve.test/**', async route => {
        const pathname = decodeURIComponent(new URL(route.request().url()).pathname);
        const file = path.join(root, pathname === '/' ? 'index.html' : pathname);
        const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
          '.png': 'image/png', '.json': 'application/json', '.mp4': 'video/mp4', '.m4a': 'audio/mp4' };
        try {
          await route.fulfill({ body: await readFile(file), contentType: mime[path.extname(file)] ?? 'application/octet-stream' });
        } catch {
          await route.fulfill({ status: 404, body: '' });
        }
      });
    }
    await page.goto('/?visualQa=1');
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
    await page.locator('#loading-screen').waitFor({ state: 'hidden' });
    await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('BattleScene', { delve: 'march-west-delves' }));
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').enemies?.length > 0);
    await page.locator('#loading-screen').waitFor({ state: 'hidden' });

    // Manual presentation steps prove that light still animates in the real Phaser
    // scene. Pause combat afterwards so screenshots show stable character positions.
    const result = await page.evaluate(() => {
      const qa = window.__DELVE_DEEP_VISUAL_QA__;
      const scene = qa.game.scene.getScene('BattleScene');
      const art = scene.children.list.find(child => child.texture?.key === 'old-quarry-chamber' && child.depth === -1000);
      const foreground = scene.children.list.find(child => child.texture?.key === 'old-quarry-chamber' && child.depth === 4300);
      const lights = scene.children.list.filter(child => child.type === 'Graphics' && child.depth === -950);
      scene.combatPaused = false;
      const before = lights.map(light => light.alpha);
      scene.events.emit('update', 0, 100);
      const after = lights.map(light => light.alpha);
      scene.combatPaused = true;
      scene.events.emit('update', 0, 100);
      scene.clearWaveAnnouncement();
      const frame = scene.children.list.find(child => child.name === 'carved-stone-panel' && child.depth === 4500 && child.y > scene.scale.height / 2);
      return { id: qa.state.currentDelve.id, art: !!art, masked: !!foreground?.mask,
        lights: lights.length, animated: after.every((alpha, index) => alpha !== before[index]),
        frozen: after.every((alpha, index) => alpha === lights[index].alpha),
        bottom: scene.battlefield.bottomY, hudTop: frame.y - frame.displayHeight / 2,
        sprites: scene.enemies.every(enemy => !!enemy.spriteVisual) };
    });
    expect(result.id).toBe('march-west-delves');
    expect(result.art).toBe(true);
    expect(result.masked).toBe(true);
    expect(result.lights).toBe(11);
    expect(result.animated).toBe(true);
    expect(result.frozen).toBe(true);
    expect(result.sprites).toBe(true);
    expect(result.bottom).toBeCloseTo(result.hudTop, 6);
    await mkdir('output/qa/old-quarry/environment', { recursive: true });
    await page.evaluate(() => new Promise(resolve => window.__DELVE_DEEP_VISUAL_QA__.game.events.once('postrender', resolve)));
    await page.screenshot({ path: `output/qa/old-quarry/environment/battle-${viewport.width}.png` });
    expect(errors).toEqual([]);
  });
}
