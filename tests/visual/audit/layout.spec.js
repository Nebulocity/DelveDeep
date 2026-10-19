import { test, expect } from './helpers.js';

for (const vendor of ['Blacksmith', 'Alchemist', 'Enchanter']) {
  test(`${vendor} catalog count clears the painted panel footer`, async ({ page, audit }) => {
    await audit.boot();
    await audit.activate('MarketScene', { data: { vendor } });
    const metrics = await page.evaluate(() => {
      const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('MarketScene');
      const label = s.children.list.find(o => o.type === 'Text' && /^\d+ items$/.test(o.text));
      return { text: label.text, bounds: label.getBounds(), catalog: s.shopBounds.catalog };
    });
    await audit.capture('MarketScene', `${vendor}-catalog-footer`);
    expect(metrics.bounds.y + metrics.bounds.height, metrics.text)
      .toBeLessThanOrEqual(metrics.catalog.y + metrics.catalog.height - 30);
  });
}

test('Garrick combat nameplate stays near visible sprite artwork', async ({ page, audit }) => {
  await audit.boot();
  await audit.activate('BattleScene');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').partyUnits?.some(u => u.id === 'garrick'));
  const metrics = await page.evaluate(async () => {
    const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    if (!s.combatPaused) s.togglePause();
    const unit = s.partyUnits.find(u => u.id === 'garrick'), visual = unit.spriteVisual;
    const { characterArtworkBounds } = await import('/ui/CharacterSpriteDisplay.js');
    const bounds = characterArtworkBounds(s, visual.currentFrame());
    const top = visual.image.getWorldTransformMatrix().transformPoint(0, bounds.top).y;
    const health = unit.hpBack.getBounds(), name = unit.label.getBounds();
    return { top, healthBottom: health.bottom, nameBottom: name.bottom };
  });
  await audit.capture('BattleScene', 'garrick-nameplate');
  expect(metrics.top - metrics.healthBottom, 'Health stays associated with Garrick rather than the empty frame margin').toBeLessThanOrEqual(100);
  expect(metrics.top - metrics.nameBottom).toBeLessThanOrEqual(140);
  expect(metrics.healthBottom).toBeLessThan(metrics.top);
});
