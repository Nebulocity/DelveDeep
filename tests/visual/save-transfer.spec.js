// End-to-end browser transfer: encrypted download, preview without mutation, recovery
// backup, explicit replacement, and undo through the stored encrypted recovery file.
import { test, expect } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

test('private transfer preserves progress and provides recovery on phone landscape', async ({ page }) => {
  await page.setViewportSize({ width: 915, height: 412 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  await page.locator('#loading-screen').waitFor({ state: 'hidden' });
  const footerBounds = await page.evaluate(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene');
    return ['SAVE TRANSFER', 'FIND PARTY'].map(text => {
      const label = scene.children.list.find(object => object.type === 'Text' && object.text === text);
      const button = scene.children.list.find(object => object.input?.enabled && object.x === label.x && object.y === label.y);
      const bounds = button.getBounds();
      return { left: bounds.left, right: bounds.right };
    });
  });
  expect(footerBounds[0].right).toBeLessThan(footerBounds[1].left);
  await mkdir('output/qa/save-transfer', { recursive: true });
  await page.screenshot({ path: path.resolve('output/qa/save-transfer/phone-footer.png') });
  const setGold = async gold => page.evaluate(async amount => {
    const { default: state } = await import('/game/GameState.js');
    const { flushProfileSave } = await import('/game/GameStorage.js');
    state.gold = amount;
    flushProfileSave();
  }, gold);
  const open = async () => {
    await page.evaluate(() => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene');
      const label = scene.children.list.find(object => object.type === 'Text' && object.text === 'SAVE TRANSFER');
      scene.children.list.find(object => object.input?.enabled && object.x === label.x && object.y === label.y).emit('pointerdown');
    });
    await expect(page.getByRole('dialog')).toBeVisible();
  };
  const passphrase = 'private transfer browser QA';
  await setGold(100.24);
  await open();
  await page.locator('[data-field="password"]').fill(passphrase);
  await page.locator('[data-field="repeat"]').fill(passphrase);
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export backup', exact: true }).click();
  const download = await downloadEvent;
  const text = await readFile(await download.path(), 'utf8');
  expect(text).not.toContain('"gold"');
  await expect(page.getByRole('status')).toContainText('Backup saved');
  await setGold(999.65);
  const chooserEvent = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose backup to restore' }).click();
  await (await chooserEvent).setFiles({ name: 'private.ddsave', mimeType: 'application/octet-stream', buffer: Buffer.from(text) });
  await expect(page.getByRole('status')).toContainText('Backup validated');
  await expect(page.locator('.save-transfer-preview')).toContainText('100.24 Gold');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('delveDeep.profile.v2')).gold)).toBe(999.65);
  const recoveryDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save recovery backup before replacing' }).click();
  await recoveryDownload;
  await expect(page.getByRole('status')).toContainText('Recovery backup saved');
  await page.getByRole('checkbox').check();
  await mkdir('output/qa/save-transfer', { recursive: true });
  await page.screenshot({ path: path.resolve('output/qa/save-transfer/phone-confirmation.png') });
  await page.getByRole('button', { name: 'Replace progress and reload' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene').sys.isActive());
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('delveDeep.profile.v2')).gold)).toBe(100.24);
  await open();
  await page.locator('[data-field="password"]').fill(passphrase);
  await page.getByRole('button', { name: 'Restore previous progress' }).click();
  await expect(page.locator('.save-transfer-preview')).toContainText('999.65 Gold');
  await page.getByRole('button', { name: 'Close save transfer' }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('delveDeep.profile.v2')).gold)).toBe(100.24);
  expect(errors).toEqual([]);
});
