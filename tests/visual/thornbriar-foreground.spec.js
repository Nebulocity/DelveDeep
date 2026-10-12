// Sample real rendered pixels to catch open floor accidentally copied over a combatant.
import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

for (const width of [915, 1920]) {
  test(`Thornbriar foliage preserves floor gaps at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 915 ? 412 : 1080 });
    await page.goto('/?visualQa=1');
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
    await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('BattleScene', { delve: 'thornbriar-hollow' }));
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').partyHud?.length === 5);
    await page.locator('#loading-screen').waitFor({ state: 'hidden' });
    const samples = await page.evaluate(async () => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
      if (!scene.combatPaused) scene.togglePause();
      scene.clearWaveAnnouncement();
      const t = scene.battlefieldVisualLayers.transform;

      // A magenta stand-in behind the foreground reveals gaps independently of sprites.
      const marker = scene.add.rectangle(t.x + 836 * t.scale, t.y + 770 * t.scale,
        1672 * t.scale, 340 * t.scale, 0xff00ff).setDepth(4200);
      marker.name = 'foreground-review-marker';
      const points = { floor: [[226, 683], [250, 698], [350, 680], [375, 690], [410, 710], [440, 730],
        [550, 730], [580, 770], [615, 790], [1300, 690], [1360, 690]],
      foliage: [[300, 660], [330, 760], [390, 755], [480, 750], [570, 820], [1410, 710]] };
      const result = [];
      for (const [kind, coordinates] of Object.entries(points)) {
        for (const [x, y] of coordinates) {
          const color = await new Promise(resolve => scene.game.renderer.snapshotPixel(
            t.x + x * t.scale, t.y + y * t.scale, resolve));
          result.push({ kind, x, y, visible: color.red === 255 && color.green === 0 && color.blue === 255 });
        }
      }
      return result;
    });
    await mkdir('output/qa/thornbriar-clipping', { recursive: true });
    await page.screenshot({ path: `output/qa/thornbriar-clipping/gaps-${width}.png` });
    for (const sample of samples) expect(sample.visible,
      `${sample.kind} at ${sample.x}, ${sample.y}`).toBe(sample.kind === 'floor');

    // Inspect real characters across the reported corner after removing the test color.
    await page.evaluate(() => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
      scene.children.list.find(child => child.name === 'foreground-review-marker').destroy();
      const t = scene.battlefieldVisualLayers.transform;
      const positions = [[350, 715], [400, 740], [460, 755], [540, 775], [600, 800]];
      scene.partyUnits.forEach((unit, index) => {
        const [x, y] = positions[index];
        const point = scene.battlefield.screenToArenaUnchecked(t.x + x * t.scale, t.y + y * t.scale);
        unit.setArenaPosition(point.x, point.y);
        unit.spriteVisual.action = null;
        unit.spriteVisual.motion.state = 'idle';
        unit.spriteVisual.applyFrame(unit.spriteVisual.currentFrame());
        unit.spriteVisual.applyPose();
      });
    });
    await page.screenshot({ path: `output/qa/thornbriar-clipping/party-${width}.png` });
  });
}
