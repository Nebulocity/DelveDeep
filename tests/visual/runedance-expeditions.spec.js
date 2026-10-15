import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

// Use the real game at phone and desktop sizes, including real decoded audio and PNGs.
for (const width of [915, 2048]) {
  test(`Runedance, expeditions and settings at ${width}`, async ({ page }) => {
    test.setTimeout(180000);
    await page.setViewportSize({ width, height: Math.round(width * 1080 / 2400) });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/?visualQa=1');
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
    await page.locator('#loading-screen').waitFor({ state: 'hidden' });
    await mkdir('output/qa/runedance', { recursive: true });
    const settings = await page.evaluate(() => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene');
      const labels = scene.children.list.filter(o => o.type === 'Text').map(o => o.text);
      scene.showDevelopmentTools();
      const all = scene.children.list.filter(o => o.type === 'Text').map(o => o.text);
      return { settings: labels.includes('SETTINGS'), transfers: labels.includes('SAVE TRANSFER'),
        cheats: all.some(text => ['DEV TOOLS', 'Dev mode', '+1,000', '+5,000', 'Renown Level', 'Character Level'].includes(text)) };
    });
    expect(settings).toEqual({ settings: true, transfers: true, cheats: false });
    await page.screenshot({ path: `output/qa/runedance/settings-${width}.png` });
    const waystone = await page.evaluate(async () => {
      const qa = window.__DELVE_DEEP_VISUAL_QA__;
      const scene = qa.game.scene.getScene('TitleScene');
      scene.selectionDetailsClose();
      scene.partyNode = 'verge-delves'; scene.activeEdge = null;
      const { selectPoi } = await import('/scenes/ScrollingWorldMap.js');
      const { pois } = await import('/data/worldMap.js');
      selectPoi(scene, pois.find(poi => poi.id === 'pineshire'));
      return qa.state.world.currentLocation;
    });
    expect(waystone).toBe('pineshire');
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TownScene').sys.isActive());
    const music = [];
    for (const [name, options, track] of [
      ['TownScene', {}, 'music-town'], ['FacilityScene', { facility: 'Alchemist' }, 'music-shops'],
      ['FacilityScene', { facility: 'Enchanter' }, 'music-shops'], ['BlacksmithScene', {}, 'music-shops'],
      ['RosterScene', {}, 'music-hall']
    ]) {
      await page.evaluate(({ name, options }) => window.__DELVE_DEEP_VISUAL_QA__.activate(name, options), { name, options });
      await page.waitForFunction(name => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene(name).sys.isActive(), name);
      const result = await page.evaluate(() => {
        const game = window.__DELVE_DEEP_VISUAL_QA__.game;
        const key = game.music.desiredTrack();
        return { key, decoded: game.cache.audio.exists(key) };
      });
      music.push(result); expect(result).toEqual({ key: track, decoded: true });
    }
    const departure = await page.evaluate(async () => {
      const qa = window.__DELVE_DEEP_VISUAL_QA__, state = qa.state;
      const { startEverdeepRun } = await import('/game/Everdeep.js');
      state.world.clearedDelves.push('verge-delves'); state.gold = 100000; state.leader.level = 3;
      state.everdeep = { schemaVersion: 2, runs: [], totals: { runsStarted: 0, chestsClaimed: 0 } };
      const party = ['garrick', 'sylva', 'alhanna', 'orwen', 'chaska'];
      state.lastPartyIds = party; state.activeParty = [];
      const before = state.gold;
      const run = startEverdeepRun(party).run;
      window.__RUNE_TEST_RUN__ = run.id;
      qa.game.scene.getScenes(true)[0].scene.start('EverdeepScene');
      return { cost: before - state.gold, party: run.party.map(hero => hero.id) };
    });
    expect(departure.cost).toBe(825);
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('EverdeepScene').content?.list.length > 10);
    const selection = await page.evaluate(() => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('EverdeepScene');
      scene.selectedRunId = null; scene.selectedIds = new Set(['garrick']); scene.render();
      return { selected: scene.selectedIds.size,
        disabled: scene.content.list.filter(o => o.type === 'Text' && o.text.includes('IN THE EVERDEEP')).length };
    });
    expect(selection.selected).toBe(0); expect(selection.disabled).toBeGreaterThan(0);
    await page.screenshot({ path: `output/qa/runedance/expedition-${width}.png` });
    await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('PartySelectScene'));
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('PartySelectScene').cards?.size === 15);
    const away = await page.evaluate(() => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('PartySelectScene');
      scene.toggleAdventurer('alhanna');
      return { selected: [...scene.selectedIds], disabled: scene.cards.get('alhanna').level.text };
    });
    expect(away.selected).toEqual([]); expect(away.disabled).toBe('IN THE EVERDEEP');
    await page.screenshot({ path: `output/qa/runedance/party-away-${width}.png` });
    const returned = await page.evaluate(async () => {
      const { recallEverdeep } = await import('/game/Everdeep.js');
      recallEverdeep(Date.now(), undefined, window.__RUNE_TEST_RUN__);
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('PartySelectScene');
      scene.nextAvailabilityCheck = 0; scene.update(); scene.toggleAdventurer('alhanna');
      return { selected: [...scene.selectedIds], available: scene.canAddToSelection(scene.cards.get('garrick').adventurer) };
    });
    expect(returned).toEqual({ selected: ['alhanna'], available: true });
    expect(errors).toEqual([]);
  });
}

test('all Runedance rune sheets animate, restore at fixed points and fade on combat time', async ({ page }) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 915, height: 412 });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  await page.evaluate(() => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__;
    const dancer = qa.state.roster.find(hero => hero.id === 'alhanna');
    qa.state.roster = [dancer, ...qa.state.roster.filter(hero => hero !== dancer)];
    qa.activate('BattleScene');
  });
  await page.waitForFunction(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    return scene.sys.isActive() && scene.enemies?.some(enemy => !enemy.landing) && !scene.waveTransitioning;
  });
  await mkdir('output/qa/runedance', { recursive: true });
  for (let group = 0; group < 3; group++) {
    const result = await page.evaluate(async group => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
      const effects = await import('/combat/AbilityEffect.js');
      const { replacementAbilities } = await import('/data/replacementAbilities.js');
      const kit = Object.values(replacementAbilities('Runedance')).filter(a => a.origin === 'Class').slice(group * 4, group * 4 + 4);
      scene.combatPaused = true; scene.time.paused = true; effects.clearAbilityEffects(scene);
      for (const unit of scene.partyUnits) { unit.status.replacementZones = []; unit.status.replacementEffects = []; }
      kit.forEach((ability, i) => {
        const owner = scene.partyUnits[i];
        owner.setArenaPosition(400 + i * 310, 560);
        owner.status.replacementZones = [{ ability, until: scene.time.now + 6000, wave: scene.currentWaveIndex,
          point: { arenaX: owner.arenaX, arenaY: owner.arenaY } }];
        scene.createAbilityEffect(owner, owner, { ...ability, vfxPhase: ability.duration ? undefined : 'impact' });
      });
      scene.combatPaused = false; effects.updateAbilityEffects(scene, 600); scene.combatPaused = true;
      const entries = scene.abilityEffects.filter(e => e.definition.id.startsWith('runedance-'));
      const frames = entries.map(e => e.pieces[0].image.frame.name);
      effects.updateAbilityEffects(scene, 1000);
      window.__RUNE_VIEWS__ = entries;
      return { count: entries.length, ready: entries.every(e => e.pieces[0].image.visible && scene.textures.get(e.pieces[0].clip.key).has(31)),
        paused: entries.every((e,i) => e.pieces[0].image.frame.name === frames[i]), dancer: Boolean(scene.partyUnits[0].spriteVisual) };
    }, group);
    expect(result).toEqual({ count: 4, ready: true, paused: true, dancer: true });
    await page.screenshot({ path: `output/qa/runedance/runes-${group}.png` });
  }
  const fade = await page.evaluate(async () => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    const effects = await import('/combat/AbilityEffect.js');
    // Rebuild the artwork solely from saved rune records, as after a paused reload.
    effects.clearAbilityEffects(scene);
    scene.combatPaused = false; effects.updateAbilityEffects(scene, 0); scene.combatPaused = true;
    const views = scene.abilityEffects.filter(e => e.definition.id.startsWith('runedance-'));
    const restored = views.length === 4 && views.every(view => view.anchor.arenaX === view.target.status.replacementZones[0].point.arenaX);
    for (const unit of scene.partyUnits) unit.status.replacementZones = [];
    scene.combatPaused = false; effects.updateAbilityEffects(scene, 0); effects.updateAbilityEffects(scene, 200);
    const halfway = views[0].pieces[0].image.alpha;
    scene.combatPaused = true; effects.updateAbilityEffects(scene, 1000);
    const paused = views[0].pieces[0].image.alpha === halfway;
    scene.combatPaused = false; effects.updateAbilityEffects(scene, 300); scene.combatPaused = true;
    return { halfway, paused, restored, removed: views.every(view => !scene.abilityEffects.includes(view)) };
  });
  expect(fade.halfway).toBeGreaterThan(0); expect(fade.halfway).toBeLessThan(0.72);
  expect(fade.paused).toBe(true); expect(fade.restored).toBe(true); expect(fade.removed).toBe(true); expect(errors).toEqual([]);
});
