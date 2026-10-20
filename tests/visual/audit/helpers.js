import { test as base, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const root = path.resolve(process.env.DELVE_QA_REPORT_ROOT ?? 'output/qa/overnight-ui-audit');
export const slug = text => text.replace(/[^a-z0-9_-]+/gi, '-').slice(0, 150);
export { expect };
export const test = base.extend({
  audit: async ({ page }, use, info) => {
    const errors = [];
    const warnings = [];
    const captures = [];
    const interactions = [];
    page.on('pageerror', e => errors.push({ type: 'exception', message: e.message, stack: e.stack }));
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push({ type: 'console', message: msg.text() });
      if (msg.type() === 'warning') warnings.push(msg.text());
    });
    page.on('response', response => {
      if (response.status() >= 400) errors.push({ type: 'http', status: response.status(), url: response.url() });
    });
    page.on('requestfailed', request => {
      if (request.failure()?.errorText !== 'net::ERR_ABORTED') errors.push({ type: 'request', url: request.url(), message: request.failure()?.errorText });
    });
    // Each test gets a new nonpersistent browser context, including localStorage and IDB.
    const audit = {
      errors, warnings, captures, interactions,
      async boot() {
        await page.goto('/?visualQa=1');
        await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene')?.sys.isActive());
        await page.locator('#loading-screen').waitFor({ state: 'hidden' });
        await page.evaluate(() => document.fonts.ready);
      },
      async activate(scene, options = {}) {
        await page.evaluate(({ scene, options }) => window.__DELVE_DEEP_VISUAL_QA__.activate(scene, options), { scene, options });
        await page.evaluate(() => new Promise(resolve => window.__DELVE_DEEP_VISUAL_QA__.game.events.once('poststep', resolve)));
        await audit.active(scene);
      },
      async active(scene) {
        await page.waitForFunction(name => {
          const s = window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene(name);
          return s?.sys.isActive() && s.sys.settings.status === 5;
        }, scene);
        await page.locator('#loading-screen').waitFor({ state: 'hidden' });
        await page.waitForTimeout(220);
      },
      async snapshot(scene) { return page.evaluate(name => window.__DELVE_DEEP_VISUAL_QA__.audit(name), scene); },
      async reach(scene, name) {
        for (let step = 0; step < 40; step++) {
          const target = (await audit.snapshot(scene)).objects.find(o => o.name === name);
          expect(target, `Discovered control remains present: ${name}`).toBeTruthy();
          if (target.inViewport && target.probes?.[0]?.topmost) return target;
          const b = target.worldBounds;
          expect(b, `Scrollable bounds for ${name}`).toBeTruthy();
          const p = await audit.point(Math.max(100, Math.min(2300, b.x + b.width / 2)), 600);
          await page.mouse.move(p.x, p.y);
          await page.mouse.wheel(0, b.y + b.height / 2 > 600 ? 350 : -350);
          await page.waitForTimeout(100);
        }
        throw new Error(`Control could not be reached by scrolling: ${scene} ${name}`);
      },
      async capture(scene, state = 'overview') {
        const data = await audit.snapshot(scene);
        const dir = path.join(root, 'scenes', scene, info.project.name);
        await mkdir(dir, { recursive: true });
        const file = `${slug(info.title)}--${slug(state)}`;
        await page.screenshot({ path: path.join(dir, `${file}.png`), scale: 'css', timeout: 20000 });
        await writeFile(path.join(dir, `${file}.json`), JSON.stringify(data, null, 2));
        captures.push({ scene, state, screenshot: path.relative(root, path.join(dir, `${file}.png`)).replaceAll('\\', '/'), data });
        return data;
      },
      async click(scene, label, edge = 0) {
        const data = await audit.snapshot(scene);
        const hit = data.objects.find(o => (o.name === label || o.label === label) && o.enabled && o.probes?.[edge]?.topmost);
        expect(hit, `Reachable ${scene} control: ${label}`).toBeTruthy();
        const point = hit.probes[edge];
        await page.mouse.click(point.x, point.y, { delay: 70 });
        await page.evaluate(() => new Promise(resolve => window.__DELVE_DEEP_VISUAL_QA__.game.events.once('poststep', resolve)));
        await page.waitForTimeout(160);
        const destinations = await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScenes(true).map(s => s.scene.key));
        interactions.push({ scene, label, edge, kind: 'pointer-click', point, id: hit.id, destinations });
      },
      async point(x, y) {
        const rect = await page.locator('#game canvas').boundingBox();
        return { x: rect.x + x * rect.width / 2400, y: rect.y + y * rect.height / 1080 };
      }
    };
    await use(audit);
    const dir = path.join(root, 'records');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, `${info.project.name}--${slug(info.title)}.json`), JSON.stringify({
      title: info.title, project: info.project.name, status: info.status, errors, warnings, interactions, captures
    }, null, 2));
    expect(errors, 'Browser exceptions, console errors and failed resources').toEqual([]);
  }
});
