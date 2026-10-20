import { test, expect } from './helpers.js';
import { readFileSync } from 'node:fs';

const catalog = readFileSync('data/delves.js', 'utf8');
const delves = [...catalog.matchAll(/from '\.\/levels\/([^']+)'/g)].map(match => {
  const source = readFileSync(`data/levels/${match[1]}`, 'utf8');
  return source.match(/\bid: '([^']+)'/)[1];
});

for (const delve of delves) {
  test(`${delve} bestiary preview and live combat HUD`, async ({ page, audit }) => {
    await audit.boot();
    await audit.activate('DelveSelectScene', { delve });
    await audit.capture('DelveSelectScene', `${delve}-bestiary`);
    await audit.activate('BattleScene', { delve });
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').partyHud?.length === 5);
    const data = await audit.capture('BattleScene', `${delve}-hud`);
    expect(data.objects.some(o => o.enabled && o.probes?.[0]?.topmost)).toBe(true);
    expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').partyHud.length)).toBe(5);
  });
}
