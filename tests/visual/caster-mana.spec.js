// Check real spell payments against the text and blue bar on Mishakal's character card.
// Freeze cast timers while rendered frames continue, so automatic HUD refresh is tested.

import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

for (const width of [915, 1920]) {
  test(`Mishakal's card follows Mend, class spell and regeneration Mana at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 915 ? 412 : 1080 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/?visualQa=1');
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
    await page.evaluate(() => {
      const qa = window.__DELVE_DEEP_VISUAL_QA__;
      qa.activate('BattleScene');
      qa.state.activeParty = ['Gladiator', 'Barmaid', 'Ranger', 'Scoundrel', 'Cleric of the Everbright']
        .map(className => ({ ...qa.state.roster.find(hero => hero.className === className) }));
    });
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene')
      .enemies?.some(enemy => enemy.alive && !enemy.landing));
    const payment = await page.evaluate(() => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
      scene.time.paused = true;
      scene.battleEvents.forEach(event => event.timer.remove(false));
      scene.battleEvents.clear();
      [...scene.partyUnits, ...scene.enemies].forEach(unit => {
        unit.finishAction(); unit.status = {}; unit.criticalKnockback = null;
      });
      const healer = scene.partyUnits.find(unit => unit.id === 'mishakal');
      const ally = scene.partyUnits[0];
      healer.setArenaPosition(ally.arenaX + 100, ally.arenaY);
      healer.manaRegen = 0;
      healer.mana = Math.floor(healer.maxMana / 2);
      healer.lastHealAt = -Infinity;
      ally.hp = ally.maxHp / 2;
      scene.updateHud();
      const before = healer.mana;
      scene.beginBasicHeal(healer, ally, scene.time.now);
      return { before, after: healer.mana, cost: healer.basicHealManaCost,
        maximum: healer.maxMana, action: healer.pendingAction?.name };
    });
    expect(payment.action).toBe('Mend');
    expect(payment.cost).toBe(Math.round(payment.maximum * .02));
    expect(payment.after).toBe(payment.before - payment.cost);

    // Wait for normal rendered frames to refresh the card instead of calling updateHud.
    const cardMatches = async mana => {
      await page.waitForFunction(expected => {
        const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
        const card = scene.partyHud.find(card => card.unit.id === 'mishakal');
        return card.manaText.text === `${Math.floor(expected)} / ${card.unit.maxMana}`
          && Math.abs(card.manaFill.displayWidth - card.hudBarWidth * expected / card.unit.maxMana) < .01;
      }, mana);
    };
    await cardMatches(payment.after);
    await mkdir('output/qa/caster-mana', { recursive: true });
    await page.screenshot({ path: `output/qa/caster-mana/mishakal-mend-${width}.png` });

    const spellPayment = await page.evaluate(() => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
      const healer = scene.partyUnits.find(unit => unit.id === 'mishakal');
      const ally = scene.partyUnits[0];
      const before = healer.mana;
      scene.resolveBasicHeal(healer, healer.pendingAction, ally);
      const afterMend = healer.mana;
      const holyLight = Object.values(healer.abilities).find(ability => ability.name === 'Holy Light');
      healer.lastAbilityAt[holyLight.id] = -Infinity;
      const cast = scene.classAbilitySystem.replacement.cast(healer, ally, holyLight.id, scene.time.now);
      return { before, afterMend, cast, after: healer.mana, cost: holyLight.manaCost };
    });
    expect(spellPayment.afterMend).toBe(spellPayment.before);
    expect(spellPayment.cast).toBe(true);
    expect(spellPayment.after).toBe(spellPayment.before - spellPayment.cost);
    await cardMatches(spellPayment.after);

    const regenerated = await page.evaluate(() => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
      const healer = scene.partyUnits.find(unit => unit.id === 'mishakal');
      healer.manaRegen = 8;
      healer.regenMana(1.03125);
      healer.manaRegen = 0;
      return healer.mana;
    });
    await cardMatches(regenerated);
    await page.evaluate(() => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
      scene.partyUnits.find(unit => unit.id === 'mishakal').mana = 0;
    });
    await cardMatches(0);
    const emptyBarVisible = await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game
      .scene.getScene('BattleScene').partyHud.find(card => card.unit.id === 'mishakal').manaFill.visible);
    expect(emptyBarVisible).toBe(false);
    expect(errors).toEqual([]);
  });
}
