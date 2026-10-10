import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

// Check actual sprite opacity and projected movement at all three hop peaks.
test('Tasslehoff stealth and three physical critical bounces', async ({ page }) => {
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('BattleScene'));
  await page.waitForFunction(() => {
    const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    return s?.sys.isActive() && s.enemies?.some(e => !e.landing) && !s.waveTransitioning;
  });
  const opacity = await page.evaluate(async () => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__;
    const s = qa.game.scene.getScene('BattleScene');
    s.combatPaused = true;
    const { default: BattleUnit } = await import('/combat/BattleUnit.js');
    const { getEquippedAdventurer } = await import('/game/Equipment.js');
    const hero = qa.state.roster.find(hero => hero.name === 'Tasslehoff');
    const point = s.movement.getSafeArenaPoint(600, 300);
    const unit = new BattleUnit(s, { ...getEquippedAdventurer(hero), battlefield: s.battlefield,
      arenaX: point.x, arenaY: point.y });
    s.partyUnits[0].container.destroy();
    s.partyUnits[0] = unit;
    unit.setStealthed(true);
    unit.spriteVisual.reset();
    unit.spriteVisual.update(0);
    const hidden = unit.spriteVisual.image.alpha;
    unit.setStealthed(false);
    unit.spriteVisual.update(0);
    return { hidden, visible: unit.spriteVisual.image.alpha };
  });
  expect(opacity).toEqual({ hidden: 0.55, visible: 1 });
  await mkdir('output/qa/critical-knockback', { recursive: true });

  // Freeze autonomous combat and advance only the hit reaction for deterministic captures.
  const start = await page.evaluate(() => {
    const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    const unit = s.partyUnits[0];
    unit.playCriticalHit({ arenaX: unit.arenaX - 100, arenaY: unit.arenaY });
    return { x: unit.x, y: unit.y, width: unit.bodyRadius * 2 * unit.container.scaleX };
  });
  const samples = [];
  for (const milliseconds of [110, 220, 220, 110]) {
    samples.push(await page.evaluate(milliseconds => {
      const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
      const unit = s.partyUnits[0];
      s.combatPaused = false;
      for (let time = 0; time < milliseconds; time += 55) unit.updateCriticalRecoil(55);
      unit.spriteVisual.update(0);
      s.combatPaused = true;
      return { x: unit.x, y: unit.y, lift: unit.spriteVisual.definition.footY - unit.spriteVisual.image.y,
        finished: !unit.criticalKnockback };
    }, milliseconds));
    await page.screenshot({ path: `output/qa/critical-knockback/hop-${samples.length}-${page.viewportSize().width}.png` });
  }
  expect(samples[0].x).toBeGreaterThan(start.x);
  expect(samples[1].x).toBeGreaterThan(samples[0].x);
  expect(samples[2].x).toBeGreaterThan(samples[1].x);
  expect(samples.slice(0, 3).map(sample => Math.round(sample.lift))).toEqual([32, 20, 10]);
  expect(samples[3].finished).toBe(true);
  expect(samples[3].x - start.x).toBeCloseTo(start.width * 2.5, 1);
  expect(samples[3].lift).toBe(0);
});
