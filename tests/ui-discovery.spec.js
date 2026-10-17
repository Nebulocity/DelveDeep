
import { test } from '@playwright/test';
import fs from 'node:fs';

test.use({
  viewport: { width: 960, height: 540 }
});

test('Discover Delve Deep UI objects', async ({ page }) => {
  await page.goto('http://localhost:5173/');
  await page.locator('canvas').waitFor();
  await page.waitForTimeout(1500);

  const result = await page.evaluate(() => {
    const canvases = [...document.querySelectorAll('canvas')].map(canvas => ({
      width: canvas.width,
      height: canvas.height,
      bounds: canvas.getBoundingClientRect().toJSON()
    }));

    const possibleGlobals = Object.keys(window).filter(key =>
      /phaser|game|scene|delve/i.test(key)
    );

    const candidates = [
	  window.__DELVE_DEEP_GAME__,
	  window.game,
      window.phaserGame,
      window.__game,
      window.DelveDeep?.game,
      ...(window.Phaser?.GAMES || [])
    ];

    const game = candidates.find(candidate =>
      candidate?.scene?.getScenes &&
      candidate?.canvas
    );

    if (!game) {
      return {
        status: 'GAME_NOT_EXPOSED',
        canvases,
        possibleGlobals,
        message: 'Phaser game instance not accessible through known globals.'
      };
    }

    const scenes = game.scene.getScenes(false).map(scene => {
      const objects = [];

      const visit = (object, parent = '') => {
        if (!object) return;

        const label = String(
          object.name ||
          object.text ||
          object.texture?.key ||
          object.type ||
          'unknown'
        ).slice(0, 120);

        if (object.input?.enabled) {
          const bounds = object.getBounds?.();

          objects.push({
            label,
            type: object.type,
            parent,
            x: object.x,
            y: object.y,
            visible: object.visible,
            depth: object.depth,
            bounds: bounds
              ? {
                  x: bounds.x,
                  y: bounds.y,
                  width: bounds.width,
                  height: bounds.height
                }
              : null
          });
        }

        if (object.list && Array.isArray(object.list)) {
          for (const child of object.list) {
            visit(child, label);
          }
        }
      };

      for (const object of scene.children?.list || []) {
        visit(object);
      }

      return {
        name: scene.sys.settings.key,
        active: scene.sys.isActive(),
        visible: scene.sys.isVisible(),
        interactiveObjects: objects
      };
    });

    return {
      status: 'GAME_FOUND',
      canvases,
      possibleGlobals,
      scenes
    };
  });

  fs.mkdirSync('screenshots/ui-catalog', {
    recursive: true
  });

  fs.writeFileSync(
    'screenshots/ui-catalog/discovery.json',
    JSON.stringify(result, null, 2)
  );

  console.log('\n=== DELVE DEEP UI DISCOVERY ===');
  console.log('Status:', result.status);
  console.log('Globals:', result.possibleGlobals);

  if (result.scenes) {
    for (const scene of result.scenes) {
      console.log(
        `Scene: ${scene.name} | Active: ${scene.active} | ` +
        `Interactive: ${scene.interactiveObjects.length}`
      );

      for (const object of scene.interactiveObjects.slice(0, 15)) {
        console.log(`  - ${object.label} (${object.type})`);
      }
    }
  }

  console.log('\nFull results saved to discovery.json');
});
