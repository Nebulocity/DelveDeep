import { combatButton, combatText } from './CombatHudTheme.js';
import { bindButtonPress } from './ButtonPress.js';
import { leaderAbilities } from '../game/LeaderProgression.js';

const GOLD = 0xe6bc72;
const ACCENTS = { MOVE: 0x78c6ff, HOLD: 0xffd882, SPREAD: 0x80d7c6, STACK: 0x9eb7ff,
  ATTACK: 0xffc188, INTERRUPT: 0xca91ff, ASSIST: 0x9ce6ba, TACTIC: 0xb9c9ff };

function symbol(g, x, y, type, color, alpha, size = 18) {
  g.lineStyle(1.5, GOLD, alpha).strokePoints([
    { x, y: y - size }, { x: x + size, y }, { x, y: y + size }, { x: x - size, y }
  ], true);
  g.lineStyle(2, color, alpha);
  const r = size * 0.48;
  if (type === 'HOLD') {
    g.strokePoints([{ x: x - r, y: y - r }, { x: x + r, y: y - r },
      { x: x + r, y: y + r / 2 }, { x, y: y + r }, { x: x - r, y: y + r / 2 }], true);
  } else if (type === 'INTERRUPT') {
    g.lineBetween(x, y - r, x, y + 2).fillStyle(color, alpha).fillCircle(x, y + r, 2);
  } else if (type === 'STACK') {
    g.strokeRect(x - r, y - r, r * 2, r * 2).strokeRect(x - r / 2, y - r / 2, r, r);
  } else if (type === 'SPREAD') {
    g.lineBetween(x - r, y, x + r, y).lineBetween(x, y - r, x, y + r);
    g.lineBetween(x - r, y, x - r + 4, y - 4).lineBetween(x + r, y, x + r - 4, y + 4);
  } else if (type === 'ATTACK') {
    g.strokeCircle(x, y, r).lineBetween(x - r - 4, y, x + r + 4, y).lineBetween(x, y - r - 4, x, y + r + 4);
  } else if (type === 'MOVE') {
    g.lineBetween(x - r, y + r / 2, x, y - r).lineBetween(x, y - r, x + r, y + r / 2);
  } else g.lineBetween(x - r, y, x + r, y).lineBetween(x, y - r, x, y + r);
}

function dashed(g, from, to, color, alpha) {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  if (length < 1) return;
  g.lineStyle(1.5, color, alpha);
  for (let start = 0; start < length; start += 18) {
    const end = Math.min(start + 8, length);
    g.lineBetween(from.x + (to.x - from.x) * start / length, from.y + (to.y - from.y) * start / length,
      from.x + (to.x - from.x) * end / length, from.y + (to.y - from.y) * end / length);
  }
}

export function createTacticalPlanOverlay(scene) {
  const { width, height } = scene.scale;
  // Planning lines sit below every enemy warning (40 + projected Y), with no filled
  // areas. Diamonds and dashed intent paths never resemble red danger telegraphs.
  const ground = scene.add.graphics().setDepth(35);
  const cards = scene.add.graphics().setDepth(4504.5);
  const pauseLabel = combatText(scene, width / 2, 207, 'TACTICAL PAUSE', 26, 5001, { color: '#c4d9ed' }).setVisible(false);
  const cancel = combatButton(scene, width - 170, height - 84, 310, 76, 4805);
  const cancelLabel = combatText(scene, cancel.x, cancel.y, '', 26, 4807);
  bindButtonPress(scene, cancel, [cancelLabel], () => scene.leaderOrderPlan.cancelSelected());
  const labels = new Map();
  const textFor = (key, x, y, value, alpha) => {
    let text = labels.get(key);
    if (!text) { text = combatText(scene, x, y, '', 23, 36); labels.set(key, text); }
    text.setPosition(x, y).setText(value).setAlpha(alpha).setVisible(true);
  };
  const tick = () => {
    if (scene.idleSimulating || scene.game.backgroundProgress?.isReplaying) return;
    ground.clear();
    cards.clear();
    labels.forEach(label => label.setVisible(false));
    const paused = scene.combatPaused && !scene.battleOver;
    pauseLabel.setVisible(paused);
    const plan = scene.leaderOrderPlan;
    const selected = scene.getSelectedUnits();
    cancel.setVisible(paused && plan.count > 0);
    cancel.input.enabled = paused && plan.count > 0;
    cancelLabel.setVisible(paused && plan.count > 0).setText(selected.length ? 'CANCEL SELECTED' : 'CANCEL ALL ORDERS');
    if (!paused) {
      scene.pauseButtonText?.setFontSize(30);
      labels.forEach(label => label.destroy());
      labels.clear();
      return;
    }
    scene.pauseButtonText?.setFontSize(plan.count ? 27 : 30).setText(plan.count ? `RESUME\n${plan.count} Pending` : 'RESUME');
    const records = [...plan.orders, ...plan.tactics.map(tactic => ({
      ...tactic, type: ['focusFire', 'coordinatedAttack', 'lunarAssault'].includes(tactic.id) ? 'ATTACK' : 'TACTIC',
      unitIds: plan.membersForTactic(tactic.id, tactic.targetId), tacticName: tactic.id
    }))];
    const visibleKeys = new Set();
    const badges = new Map();
    for (const order of records) {
      const units = scene.partyUnits.filter(unit => order.unitIds.includes(unit.id));
      const related = !selected.length || units.some(unit => scene.selectedUnitIds.has(unit.id))
        || order.type === 'INTERRUPT' && order.targetId === scene.inspectedEnemyId;
      const alpha = related ? 0.9 : 0.22;
      const color = ACCENTS[order.type] ?? ACCENTS.TACTIC;
      // Individual badges identify group recipients without drawing a path per member.
      for (const unit of units) {
        const previous = badges.get(unit.id);
        badges.set(unit.id, previous && order.type === 'TACTIC' ? { ...previous, extra: true }
          : { unit, type: order.type, color, alpha, extra: Boolean(previous) });
      }
      const target = [...scene.enemies, ...scene.partyUnits].find(unit => unit.id === order.targetId);
      const destination = order.point ? scene.battlefield.arenaToScreen(order.point.x, order.point.y) : null;
      const marker = destination ?? (target ? { x: target.x, y: order.type === 'INTERRUPT'
        ? (target.label?.getBounds?.().top ?? target.y - 130) - 28 : target.y - 4 } : null);
      if (marker) {
        const key = order.serial;
        const tactic = leaderAbilities.find(ability => ability.id === order.tacticName);
        visibleKeys.add(key);
        if (tactic?.radius && target) {
          const radii = scene.battlefield.getGroundEllipseRadii(tactic.radius, target.arenaY);
          ground.lineStyle(1.5, GOLD, alpha * 0.6).strokeEllipse(target.x, target.y, radii.width * 2, radii.height * 2);
        }
        if (order.type === 'MOVE') {
          ground.lineStyle(5, color, alpha * 0.12).strokeCircle(marker.x, marker.y, 27);
          // This is a direction of intent, not a promised path through terrain.
          if (units.length) dashed(ground, units.length === 1 ? units[0] : {
            x: units.reduce((sum, unit) => sum + unit.x, 0) / units.length,
            y: units.reduce((sum, unit) => sum + unit.y, 0) / units.length
          }, marker, GOLD, alpha * 0.65);
        } else if (order.type === 'ATTACK') {
          ground.lineStyle(1.5, GOLD, alpha).strokeEllipse(marker.x, marker.y, 80, 38);
          const member = units.find(unit => scene.selectedUnitIds.has(unit.id)) ?? units[0];
          if (member) dashed(ground, member, marker, color, alpha * 0.35);
        }
        symbol(ground, marker.x, marker.y, order.type, color, alpha, 23);
        textFor(key, marker.x, marker.y + 35, `${tactic?.shortName ?? order.type}${units.length > 1 ? ` · ${units.length}` : ''}`, alpha);
      }
    }
    for (const { unit, type, color, alpha, extra } of badges.values()) {
      symbol(ground, unit.x + 46, unit.y - 24, type, color, alpha, 15);
      const card = scene.partyHud?.find(entry => entry.unit.id === unit.id);
      if (card) {
        const x = card.panel.x + card.panel.width / 2 - 23;
        const y = card.panel.y - card.panel.height / 2 + 30;
        symbol(cards, x, y, type, color, alpha, 13);
        if (extra) cards.fillStyle(GOLD, alpha).fillCircle(x + 13, y - 13, 3);
      }
    }
    for (const [key, label] of labels) {
      if (!visibleKeys.has(key)) { label.destroy(); labels.delete(key); }
    }
  };
  scene.events.on('update', tick);
  scene.events.once('shutdown', () => {
    scene.events.off('update', tick);
    labels.forEach(label => label.destroy());
    labels.clear();
  });
  tick();
  return { update: tick };
}
