import { test, expect } from './helpers.js';

test('visible interface animation frames exist and remain stable through navigation', async ({ page, audit }) => {
  await audit.boot();
  for (const name of ['TownScene', 'HeroesScene', 'PartySelectScene', 'BattleScene']) {
    await audit.activate(name);
    const frames = await page.evaluate(name => {
      const qa = window.__DELVE_DEEP_VISUAL_QA__, scene = qa.game.scene.getScene(name);
      const entries = [];
      const visit = object => {
        if (object.visible && object.active && object.texture) entries.push({
          texture: object.texture.key, frame: object.frame?.name,
          missing: object.texture.key === '__MISSING',
          animation: object.anims?.currentAnim?.key ?? null,
          valid: !object.anims?.currentAnim || object.anims.currentAnim.frames.every(frame => !!frame.frame)
        });
        object.list?.forEach(visit);
      };
      scene.children.list.forEach(visit);
      return entries;
    }, name);
    expect(frames.length).toBeGreaterThan(0);
    expect(frames.filter(frame => frame.missing || !frame.valid)).toEqual([]);
    await page.waitForTimeout(500);
    await audit.capture(name, 'animated-frame-sample');
  }
});

test('approved screenshot regression for town hub', async ({ page, audit }) => {
  test.skip(!process.env.DELVE_QA_APPROVED_BASELINES,
    'No human-approved current UI baselines supplied. Captures are candidates, not automatic approval.');
  await audit.boot();
  await audit.activate('TownScene');
  await page.mouse.move(1, 1);
  await expect(page).toHaveScreenshot('town-hub.png', { scale: 'css', animations: 'disabled', maxDiffPixelRatio: 0.001 });
});
