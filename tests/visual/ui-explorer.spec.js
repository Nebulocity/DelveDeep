// Delve Deep visual QA explorer v3.
// Reuses the existing development QA bridge; does not mutate game code.
// Actions are allowlisted, and every attempt starts with a fresh page state.

import { test, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const aliases = { AdventurersHallScene: 'RosterScene' };
const chosen = (process.env.UI_EXPLORE_SCENES || 'AdventurersHallScene')
  .split(',').map(s => s.trim()).filter(Boolean);
const out = path.resolve('output/qa/ui-explorer');
const settleMs = Math.max(200, Number(process.env.UI_EXPLORE_SETTLE_MS || 700));
const maxActions = Math.max(0, Math.floor(Number(process.env.UI_EXPLORE_MAX_ACTIONS || 4)));
const startAt = Math.max(0, Math.floor(Number(process.env.UI_EXPLORE_START_AT || 0)));
const includeActions = process.env.UI_EXPLORE_ACTIONS === '1';

function slug(s) {
  return String(s).replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '').slice(0, 100);
}

function inside(p, r) {
  return !!(p && r && Number.isFinite(p.x) && Number.isFinite(p.y) &&
    p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height);
}

// Prioritize interface transitions over repeated character selections.
// Equipment buttons and purchases are intentionally excluded.
function actionFor(scene, label) {
  if (!['AdventurersHallScene', 'RosterScene'].includes(scene)) return null;
  if (/^hall-tab-(skills|gear)$/i.test(label)) return { kind: 'click', priority: 0 };
  if (/^hall-nav-(items|tactics|adventurers)$/i.test(label)) return { kind: 'click', priority: 1 };
  if (/^hall-(class-info|all-stats)$/i.test(label)) return { kind: 'hold', priority: 2 };
  if (/^hall-summary-stat-/i.test(label)) return { kind: 'hold', priority: 3 };
  if (/^hall-slot-bonuses-(weapon|armor)$/i.test(label)) return { kind: 'hold', priority: 4 };
  if (/^hall-hero-[a-z0-9-]+$/i.test(label)) return { kind: 'click', priority: 5 };
  return null;
}

async function readPrevious(file, requestedScene, actualScene) {
  try {
    const value = JSON.parse(await readFile(file, 'utf8'));
    return value.requestedScene === requestedScene && value.actualScene === actualScene ? value : null;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

for (const requestedScene of chosen) {
  test(`UI explore ${requestedScene}`, async ({ page }) => {
    test.setTimeout(Math.max(120000, 50000 + maxActions * 40000));
    const actualScene = aliases[requestedScene] || requestedScene;
    const folder = path.join(out, slug(requestedScene));
    const reportPath = path.join(folder, 'report.json');
    await mkdir(folder, { recursive: true });
    const old = await readPrevious(reportPath, requestedScene, actualScene);
    const report = {
      requestedScene, actualScene, capturedAt: new Date().toISOString(),
      mode: includeActions ? 'v3-prioritized-interactions' : 'inventory-only',
      inventory: old?.inventory || [],
      captures: old?.captures || [],
      skipped: [], errors: old?.errors || [],
      branches: old?.branches || [],
      attempts: old?.attempts || [],
      canvasBounds: old?.canvasBounds || null
    };
    const completed = new Set(report.captures.map(x => x.name));
    const attempted = new Set(report.attempts.filter(x => x.status === 'captured').map(x => x.label));
    async function save() {
      await writeFile(reportPath, JSON.stringify(report, null, 2));
    }
    async function ready() {
      await page.goto('/?visualQa=1', { timeout: 25000 });
      await page.waitForFunction(() => {
        const qa = window.__DELVE_DEEP_VISUAL_QA__;
        return !!qa?.game?.scene?.getScene('TitleScene')?.sys?.isActive();
      }, null, { timeout: 22000 });
      await page.evaluate(name => window.__DELVE_DEEP_VISUAL_QA__.activate(name), requestedScene);
      await page.waitForFunction(name => {
        const qa = window.__DELVE_DEEP_VISUAL_QA__;
        const scene = qa?.game?.scene?.getScene(name);
        return !!scene?.sys?.isActive() && scene.sys.settings.status === 5;
      }, actualScene, { timeout: 22000 });
      await page.locator('#loading-screen').waitFor({ state: 'hidden', timeout: 22000 });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(settleMs);
    }
    async function discover(sceneName = actualScene) {
      return page.evaluate(name => window.__DELVE_DEEP_VISUAL_QA__.discover(name), sceneName);
    }
    async function snapshot(name, action, meta = {}) {
      const filename = `${slug(name)}.png`;
      await page.screenshot({ path: path.join(folder, filename), timeout: 15000 });
      if (!completed.has(name)) {
        report.captures.push({ name, action, screenshot: `${slug(requestedScene)}/${filename}`, ...meta });
        completed.add(name);
      }
      await save();
    }

    try {
      await ready();
      const initial = await discover();
      expect(initial.active).toBe(true);
      report.inventory = initial.objects;
      report.canvasBounds = initial.canvasBounds;
      if (!completed.has('00-overview')) await snapshot('00-overview', 'initial state');

      const targets = initial.objects
        .map((object, originalIndex) => ({ object, originalIndex, action: actionFor(requestedScene, object.label) }))
        .filter(item => item.action)
        .sort((a, b) => a.action.priority - b.action.priority || a.originalIndex - b.originalIndex);
      report.v3Queue = targets.map(({ object, action }) => ({ label: object.label, action: action.kind }));
      await save();

      if (includeActions) {
        for (let index = startAt; index < Math.min(targets.length, startAt + maxActions); index++) {
          const { object, action } = targets[index];
          const name = `v3-${String(index + 1).padStart(2, '0')}-${object.label}-${action.kind}`;
          if (completed.has(name) || attempted.has(object.label)) continue;
          const attempt = { label: object.label, action: action.kind, queueIndex: index, status: 'pending' };
          try {
            await ready();
            const fresh = await discover();
            const match = fresh.objects.find(x => x.label === object.label && x.inViewport);
            const center = match?.browserCenter;
            const viewport = page.viewportSize();
            if (!match || !inside(center, fresh.canvasBounds) ||
              !inside(center, { x: 0, y: 0, width: viewport.width, height: viewport.height })) {
              attempt.status = 'skipped';
              attempt.reason = 'Outside canvas or viewport; scrolling required';
              continue;
            }
            // Center hit testing cannot prove the target is not covered by a Phaser overlay.
            await page.mouse.move(center.x, center.y);
            if (action.kind === 'hold') {
              await page.mouse.down();
              try {
                await page.waitForTimeout(950);
                await snapshot(name, 'long press', { sourceLabel: object.label });
              } finally {
                await page.mouse.up();
              }
            } else {
              await page.mouse.click(center.x, center.y);
              await page.waitForTimeout(settleMs);
              await snapshot(name, 'click', { sourceLabel: object.label });
            }
            // Only inspect the scene that is actually active after the interaction.
            const activeScenes = await page.evaluate(() => {
              const qa = window.__DELVE_DEEP_VISUAL_QA__;
              return qa.game.scene.getScenes(true).map(s => s.sys.settings.key);
            });
            const activeScene = activeScenes.includes(actualScene) ? actualScene : activeScenes[0];
            let discovered = [];
            if (activeScene) {
              try {
                const child = await discover(activeScene);
                discovered = child.objects?.map(o => o.label) || [];
              } catch (error) {
                attempt.inspectionWarning = String(error.message || error);
              }
            }
            // Branch inventories are useful even when the new state isn't a new Phaser scene.
            report.branches = report.branches.filter(b => b.name !== name);
            report.branches.push({ name, sourceLabel: object.label, activeScenes, discoveredLabels: discovered,
              newLabels: discovered.filter(label => !fresh.objects.some(o => o.label === label)) });
            attempt.status = 'captured';
            attempted.add(object.label);
          } catch (error) {
            attempt.status = 'error';
            attempt.reason = String(error.message || error);
            report.errors.push({ label: object.label, error: attempt.reason });
          } finally {
            report.attempts = report.attempts.filter(a => !(a.label === object.label && a.queueIndex === index));
            report.attempts.push(attempt);
            await save();
          }
        }
      }
      report.skipped = initial.objects.flatMap(object => {
        const action = actionFor(requestedScene, object.label);
        if (!action) return [{ label: object.label, reason: 'Not on conservative interaction allowlist' }];
        if (attempted.has(object.label)) return [];
        const last = [...report.attempts].reverse().find(a => a.label === object.label);
        return [{ label: object.label, reason: last?.reason || (includeActions ? 'Not captured yet' : 'Actions not enabled') }];
      });
    } finally {
      await save();
      console.log(`${requestedScene}: ${report.inventory.length} discovered; ${report.captures.length} cumulative screenshots; ${report.branches.length} explored branches; ${report.skipped.length} skipped; ${report.errors.length} recorded errors`);
    }
  });
}
