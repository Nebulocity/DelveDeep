import { test, expect } from './helpers.js';
import { readFile } from 'node:fs/promises';

test('map destination cards include locked state, details, travel and town entry', async ({ page, audit }) => {
  await audit.boot();
  const names = (await audit.snapshot('TitleScene')).objects.filter(o => o.name?.startsWith('destination-')).map(o => o.name);
  expect(names.length).toBeGreaterThan(5);
  for (const name of names) {
    const visible = (await audit.snapshot('TitleScene')).objects.find(o => o.name === name && o.probes?.[0]?.topmost);
    if (!visible) {
      // Scroll the real destination rail until its last rows become reachable.
      const p = await audit.point(200, 700);
      await page.mouse.move(p.x, p.y);
      await page.mouse.wheel(0, 700);
      await page.waitForTimeout(180);
    }
    await audit.click('TitleScene', name, 1);
    await audit.capture('TitleScene', name);
    expect(await page.evaluate(() => !!window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene').selectedMapPoi)).toBe(true);
    await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene').mapLocationClose());
  }
});

test('save transfer native dialog errors, export and dismissal remain in viewport', async ({ page, audit }) => {
  await audit.boot();
  await audit.click('TitleScene', 'Save Transfer');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Undo last restore on this device' })).toBeHidden();
  await page.getByRole('button', { name: "Export this device's progress" }).click();
  await page.getByRole('button', { name: 'Save backup file', exact: true }).click();
  await expect(page.getByRole('status')).not.toBeEmpty();
  await page.locator('[data-field="password"]').fill('overnight isolated QA passphrase');
  await page.locator('[data-field="repeat"]').fill('wrong passphrase');
  await page.getByRole('button', { name: 'Save backup file', exact: true }).click();
  await expect(page.getByRole('status')).toContainText(/match/i);
  await page.locator('[data-field="repeat"]').fill('overnight isolated QA passphrase');
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save backup file', exact: true }).click();
  const download = await event;
  expect(download.suggestedFilename()).toMatch(/\.ddsave$/);
  const backup = await readFile(await download.path(), 'utf8');
  expect(backup).not.toContain('"roster"');
  const bounds = await page.getByRole('dialog').boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(page.viewportSize().width + 1);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(page.viewportSize().height + 1);
  // Phaser is paused by this DOM dialog; capture still inspects its visible scene.
  await audit.capture('TitleScene', 'save-transfer');
  await page.getByRole('button', { name: 'Back to transfer options' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Restore from a backup file' }).click();
  await (await chooser).setFiles({ name: 'audit.ddsave', mimeType: 'application/octet-stream', buffer: Buffer.from(backup) });
  await page.locator('[data-field="password"]').fill('overnight isolated QA passphrase');
  await page.getByRole('button', { name: 'Open backup and review progress' }).click();
  await expect(page.getByRole('status')).toContainText(/review this backup/i);
  await audit.capture('TitleScene', 'save-restore-preview');
  const recovery = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save this device’s current progress and continue' }).click();
  await recovery;
  await audit.capture('TitleScene', 'save-restore-confirmation');
  await page.getByRole('button', { name: 'Cancel restore' }).click();
  await page.getByRole('button', { name: 'Close save transfer' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await audit.active('TitleScene');
});

test('How to Play existing slideshow opens, navigates and dismisses', async ({ page, audit }) => {
  test.setTimeout(300000);
  await audit.boot();
  await audit.click('TitleScene', 'How to Play');
  const total = await page.evaluate(async () => (await import('/data/tutorial.js')).tutorialSlides.length);
  for (let index = 1; index <= total; index++) {
    await page.waitForFunction(() => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene');
      return scene.children.getByName('tutorial-video')?.frameReady;
    });
    const data = await audit.capture('TitleScene', `how-to-play-${index}`);
    expect(data.texts.some(o => o.text === `${index} of ${total}`)).toBe(true);
    if (index < total) await audit.click('TitleScene', 'tutorial-next');
  }
  await audit.click('TitleScene', 'tutorial-previous');
  await audit.click('TitleScene', 'tutorial-pause');
  await audit.click('TitleScene', 'tutorial-replay');
  await audit.click('TitleScene', 'tutorial-close');
  expect(await page.evaluate(() => !!window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene').selectionDetailsClose)).toBe(false);
});

test('Everdeep locked and unlocked selection, purchase, recall and empty state', async ({ page, audit }) => {
  await audit.boot();
  await audit.activate('EverdeepScene');
  await audit.click('EverdeepScene', '+ New Expedition');
  expect((await audit.capture('EverdeepScene', 'locked-feedback')).texts.some(o => /Sunken Watch/.test(o.text))).toBe(true);
  await page.evaluate(async () => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__;
    const { everdeepRegion } = await import('/game/Everdeep.js');
    qa.state.world.clearedDelves.push(everdeepRegion.ordinaryDelves.at(-1));
    qa.state.gold = 100000;
    qa.game.scene.getScene('EverdeepScene').render();
  });
  await audit.capture('EverdeepScene', 'unlocked-selection');
  // Select five eligible cards through pointer input; the live labels include names/levels.
  for (let index = 0; index < 5; index++) {
    let choice;
    for (let attempt = 0; attempt < 3 && !choice; attempt++) {
      const eligible = await page.evaluate(() => {
        const qa = window.__DELVE_DEEP_VISUAL_QA__, s = qa.game.scene.getScene('EverdeepScene');
        return qa.state.roster.filter(hero => !s.selectedIds.has(hero.id) && s.roleAllowed(hero)).map(hero => hero.name);
      });
      const data = await audit.snapshot('EverdeepScene');
      choice = data.objects.find(o => o.probes?.[0]?.topmost && eligible.some(name => o.label?.startsWith(`${name}\n`)));
      if (!choice) await audit.click('EverdeepScene', 'More Adventurers');
    }
    expect(choice).toBeTruthy();
    await audit.click('EverdeepScene', choice.label);
  }
  const selected = await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('EverdeepScene').selectedIds.size);
  expect(selected).toBe(5);
  const purchase = (await audit.snapshot('EverdeepScene')).objects.find(o => o.label?.startsWith('Purchase Writ'));
  await audit.click('EverdeepScene', purchase.label);
  await audit.capture('EverdeepScene', 'active-expedition');
  await audit.click('EverdeepScene', 'Cancel Expedition');
  await audit.capture('EverdeepScene', 'recall-confirmation');
  await audit.click('EverdeepScene', 'Keep Descending');
  await audit.click('EverdeepScene', 'Cancel Expedition');
  await audit.click('EverdeepScene', 'Confirm Recall');
  await audit.capture('EverdeepScene', 'recalled-expedition');
  await audit.click('EverdeepScene', 'Return to World Map');
  await audit.active('TitleScene');
});
