import { test, expect } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const screenshotDir = path.resolve('tests/visual/screenshots');
test.beforeEach(async ({ page }) => {
  if (!process.env.REGION_MAP_QA_ASSETS) return;
  const root = path.resolve(process.env.REGION_MAP_QA_ASSETS);
  const types = { '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.html': 'text/html' };
  await page.route('**/*', async route => {
    const pathname = decodeURIComponent(new URL(route.request().url()).pathname);
    const file = path.join(root, pathname === '/' ? 'index.html' : pathname);
    try {
      await route.fulfill({ status: 200, contentType: types[path.extname(file)] ?? 'application/octet-stream', body: await readFile(file) });
    } catch {
      await route.fulfill({ status: 404, body: '' });
    }
  });
});
const ready = async (page, scene = 'TitleScene') => {
  await page.waitForFunction((name) => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene(name).sys.isActive(), scene);
  await page.locator('#loading-screen').waitFor({ state: 'hidden' });
};
const frames = (page) => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function focusLabel(page, text) {
  await page.evaluate((name) => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene');
    const label = scene.children.list.find((object) => object.type === 'Text' && object.text.endsWith(name));
    scene.cameras.main.stopFollow();
    scene.cameras.main.centerOn(label.x, label.y + 200);
  }, text);
  await frames(page);
  return page.evaluate((name) => {
    const game = window.__DELVE_DEEP_VISUAL_QA__.game;
    const scene = game.scene.getScene('TitleScene');
    const label = scene.children.list.find((object) => object.type === 'Text' && object.text.endsWith(name));
    const rect = game.canvas.getBoundingClientRect();
    const camera = scene.cameras.main;
    return { x: rect.x + (camera.x + camera.width / 2 + (label.x - camera.scrollX - camera.width / 2) * camera.zoom) * rect.width / game.scale.width,
      y: rect.y + (camera.y + camera.height / 2 + (label.y - camera.scrollY - camera.height / 2) * camera.zoom) * rect.height / game.scale.height };
  }, text);
}

for (const viewport of [{ width: 1920, height: 1080 }, { width: 915, height: 412 }]) {
  test(`Region destination rail and smooth Find Party at ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/?visualQa=1');
    await ready(page);
    const clickLogical = async (x, y) => {
      const box = await page.locator('canvas').boundingBox();
      await page.mouse.click(box.x + x * box.width / 2400, box.y + y * box.height / 1080);
    };
    expect(await page.evaluate(() => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene');
      return { rows: scene.locationRows.length, mapLeft: scene.cameras.main.x, zoom: scene.cameras.main.zoom };
    })).toEqual({ rows: 8, mapLeft: 460, zoom: 0.7 });
    await clickLogical(220, 450);
    expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene').destination)).toBe(null);
    await page.evaluate(async () => {
      const qa = window.__DELVE_DEEP_VISUAL_QA__;
      qa.state.world.clearedDelves = ['slime-cave'];
      qa.activate('TitleScene');
    });
    await ready(page);
    await frames(page);
    await clickLogical(220, 450);
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene').destination?.id === 'thornbriar-hollow');
    await page.evaluate(() => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene');
      scene.partyPan?.stop();
      scene.partyPan = null;
      scene.cameras.main.stopFollow();
      scene.cameras.main.centerOn(3000, 900);
    });
    const before = await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene').cameras.main.scrollX);
    await clickLogical(2215, 1015);
    await page.waitForTimeout(180);
    const middle = await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene').cameras.main.scrollX);
    expect(middle).toBeLessThan(before);
    await page.waitForTimeout(650);
    const after = await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene').cameras.main.scrollX);
    expect(after).toBeLessThan(middle);
    await page.screenshot({ path: path.join(screenshotDir, `region-map-travel-${viewport.width}.png`) });
    await ready(page, 'DelveSelectScene');
    expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('DelveSelectScene').sys.isActive())).toBe(true);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('delveDeep.profile.v2')).world.currentLocation)).toBe('thornbriar-hollow');
  });
}

for (const viewport of [{ width: 1920, height: 1080 }, { width: 915, height: 412 }]) {
  test(`Pineshire final map travel and locks at ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/?visualQa=1');
    await ready(page);
    await mkdir(screenshotDir, { recursive: true });
    await page.screenshot({ path: path.join(screenshotDir, `pineshire-start-${viewport.width}.png`) });
    expect(await page.evaluate(() => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene');
      return scene.children.list.some((object) => object.texture?.key === 'world-pineshire-final');
    })).toBe(true);

    let point = await focusLabel(page, 'Thornbriar Hollow');
    await page.mouse.click(point.x, point.y);
    expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene').destination)).toBe(null);
    await page.screenshot({ path: path.join(screenshotDir, `pineshire-locked-${viewport.width}.png`) });

    point = await focusLabel(page, 'The Slime Cave');
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await page.waitForFunction(() => Boolean(window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene').selectionDetailsClose));
    await page.mouse.up();
    expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene').destination)).toBe(null);
    await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene').selectionDetailsClose());
    point = await focusLabel(page, 'The Slime Cave');
    await page.mouse.click(point.x, point.y);
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene').activeEdge);
    await page.waitForFunction(() => {
      const raw = JSON.parse(localStorage.getItem('delveDeep.profile.v2'));
      return raw?.world?.travel?.destinationId === 'slime-cave';
    });
    await page.reload();
    await ready(page, 'DelveSelectScene');
    expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.state.currentDelve.id)).toBe('slime-cave');

    await page.evaluate(async () => {
      const state = window.__DELVE_DEEP_VISUAL_QA__.state;
      state.world.clearedDelves = ['slime-cave', 'thornbriar-hollow', 'dolmark-den', 'march-west-delves', 'verge-delves'];
      state.world.currentLocation = 'verge-delves';
      state.world.travel = null;
      window.__DELVE_DEEP_VISUAL_QA__.activate('TitleScene');
    });
    await ready(page);
    point = await focusLabel(page, 'The Everdeep');
    await page.screenshot({ path: path.join(screenshotDir, `pineshire-branch-${viewport.width}.png`) });
    expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene').children.list.some((object) => object.text === 'LOCKED'))).toBe(false);
    await page.mouse.click(point.x, point.y);
    await ready(page, 'EverdeepScene');
    expect(errors).toEqual([]);
  });
}


test('Region map surfaces, notices and dialogs share the map theme', async ({ page }) => {
  await page.setViewportSize({ width: 915, height: 412 });
  await page.goto('/?visualQa=1');
  await ready(page);
  const themed = async () => {
    await frames(page);
    expect(await page.evaluate(() => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene');
      return {
        wood: scene.children.list.filter(o => o.texture?.key === 'town-sign-details').length,
        flat: scene.children.list.filter(o => o.type === 'Rectangle' && o.fillAlpha > 0 && o.fillColor !== 0x000000).length,
        textures: scene.children.list.filter(o => o.texture?.key.startsWith('region-surface-')).length
      };
    })).toMatchObject({ wood: 0, flat: 0 });
  };
  await themed();
  await page.screenshot({ path: path.join(screenshotDir, 'region-map-mockup-phone.png') });
  await page.evaluate(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene');
    scene.showToast('Clear The Slime Cave to open the next road.');
    scene.activeToast.tween.stop();
  });
  await themed();
  await page.screenshot({ path: path.join(screenshotDir, 'region-map-notice-phone.png') });
  await page.evaluate(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene');
    scene.activeToast.text.destroy();
    const help = scene.children.list.find(o => o.input?.enabled && o.x === 640 && o.y === 1015);
    help.emit('pointerdown');
  });
  await themed();
  await page.screenshot({ path: path.join(screenshotDir, 'region-map-help-phone.png') });
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene').showDevelopmentTools());
  await themed();
  await page.screenshot({ path: path.join(screenshotDir, 'region-map-dev-tools-phone.png') });
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene').showResetConfirmation());
  await themed();
  await page.screenshot({ path: path.join(screenshotDir, 'region-map-reset-phone.png') });
  const before = await page.evaluate(() => localStorage.getItem('delveDeep.profile.v2'));
  const cancelPoint = await page.evaluate(() => {
    const game = window.__DELVE_DEEP_VISUAL_QA__.game;
    const caption = game.scene.getScene('TitleScene').children.list.find(o => o.text === 'CANCEL');
    const box = game.canvas.getBoundingClientRect();
    return { x: box.x + caption.x * box.width / 2400, y: box.y + caption.y * box.height / 1080 };
  });
  await page.mouse.click(cancelPoint.x, cancelPoint.y);
  expect(await page.evaluate(() => localStorage.getItem('delveDeep.profile.v2'))).toBe(before);
  await themed();
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene').selectionDetailsClose());
  const canvas = await page.locator('canvas').boundingBox();
  await page.mouse.move(canvas.x + 220 * canvas.width / 2400, canvas.y + 366 * canvas.height / 1080);
  await page.mouse.down();
  await page.waitForFunction(() => Boolean(window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene').selectionDetailsClose));
  await page.mouse.up();
  await themed();
  await page.screenshot({ path: path.join(screenshotDir, 'region-map-location-phone.png') });
});


test('Map messages use the map center and UI messages use the screen center', async ({ page }) => {
  await page.setViewportSize({ width: 915, height: 412 });
  await page.goto('/?visualQa=1');
  await ready(page);
  const canvas = await page.locator('canvas').boundingBox();
  await page.mouse.click(canvas.x + 220 * canvas.width / 2400, canvas.y + 450 * canvas.height / 1080);
  expect(await page.evaluate(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene');
    return { text: scene.activeToast.text.x, panel: scene.activeToast.panel.x,
      expected: scene.cameras.main.x + scene.cameras.main.width / 2 };
  })).toEqual({ text: 1430, panel: 1430, expected: 1430 });
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene').showToast('Added 100 Gold.'));
  expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene').activeToast.text.x)).toBe(1200);
  await page.mouse.move(canvas.x + 220 * canvas.width / 2400, canvas.y + 366 * canvas.height / 1080);
  await page.mouse.down();
  await page.waitForFunction(() => Boolean(window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene').selectionDetailsClose));
  await page.mouse.up();
  expect(await page.evaluate(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene');
    return scene.children.list.find(o => o.text === 'The Slime Cave' && o.depth === 10002).x;
  })).toBe(1430);
  await page.evaluate(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene');
    scene.selectionDetailsClose();
    scene.children.list.find(o => o.input?.enabled && o.x === 640 && o.y === 1015).emit('pointerdown');
  });
  expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene').children.list.find(o => o.text === 'WELCOME TO DELVE DEEP').x)).toBe(1200);
});
