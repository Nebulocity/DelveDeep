import { combatHudLayout, combatPanel, combatButton, combatText } from './CombatHudTheme.js';
import { bindButtonPress } from './ButtonPress.js';
import HapticsService from '../services/HapticsService.js';
import { bindSelectionDetails } from './SelectionDetails.js';

// Observe live units and casts without changing AI targets. The cast shortcuts retain
// the existing deliberate arm-then-target Interrupt interaction.
export function createCombatEncounterPanel(scene) {
  const layout = combatHudLayout(scene);
  const panelWidth = layout.encounterWidth;
  const x = layout.width - panelWidth / 2 - 8;
  const inset = 34;
  const left = x - panelWidth / 2 + inset;
  const contentWidth = panelWidth - inset * 2;
  const top = 112;
  let expanded = !layout.compact;
  let page = 0;
  let groupCount = 0;
  let lastInspected = null;
  let compact = layout.compact;
  let panel = null;
  let panelHeight = 0;
  const text = (value, size = 27, color = '#fff0d0') =>
    combatText(scene, left, top, value, size, 4602, { color }).setOrigin(0, 0.5);
  const fit = (label, value, width = contentWidth) => {
    label.setText(value).setScale(1);
    if (label.width > width) label.setScale(width / label.width);
  };
  // Painted corners occupy more space than the hit rectangle's outer edges.
  // Keep both header lines and the expandable content inside that inner face.
  const header = combatButton(scene, x, top + 48, panelWidth, 96, 4600);
  const heading = text('ENCOUNTER', 29, '#ffda8b').setPosition(left, top + 33);
  fit(heading, heading.text);
  const countText = text('', 24, '#bdc9d4').setPosition(left, top + 65);
  bindButtonPress(scene, header, [heading, countText], () => {
    expanded = !expanded;
    HapticsService.tap();
  });
  const rows = Array.from({ length: 4 }, () => ({
    icon: scene.add.image(left + 21, top, 'carved-stone-panel').setDepth(4602).setVisible(false),
    name: text(''), count: text('', 24, '#bdc9d4')
  }));
  const pageButton = combatButton(scene, x, top, panelWidth - 24, 62, 4600);
  const pageText = text('', 25).setOrigin(0.5);
  bindSelectionDetails(scene, pageButton, () => ({ title: 'Enemy types', description: 'Tap to view the next group of enemy types.' }), () => {
    page = (page + 1) % Math.max(1, Math.ceil(groupCount / rows.length));
  });
  const targetTitle = text('TARGET', 27, '#ffda8b');
  const targetName = text('');
  const hpBack = scene.add.rectangle(left, top, contentWidth, 26, 0x080f1b)
    .setOrigin(0, 0.5).setDepth(4601).setStrokeStyle(1, 0x8b714b);
  const hpFill = scene.add.rectangle(left, top, contentWidth, 22, 0xc93837)
    .setOrigin(0, 0.5).setDepth(4602);
  const hpText = text('', 24).setOrigin(0.5).setDepth(4603);
  const castTitle = text('CASTS', 27, '#ffda8b');
  const casts = Array.from({ length: 2 }, () => {
    const button = combatButton(scene, x, top, panelWidth - 16, 90, 4600);
    const name = text('', 24, '#bdc9d4');
    const ability = text('', 26);
    const bar = scene.add.rectangle(left, top, contentWidth, 6, 0xe8b75c)
      .setOrigin(0, 0.5).setDepth(4602);
    const entry = { button, name, ability, bar, enemy: null, action: null };
    let pressedEnemy = null;
    let pressedAction = null;
    bindSelectionDetails(scene, button, () => ({ title: entry.enemy?.name ?? 'Enemy cast',
      description: entry.action?.name ?? 'No active cast' }), () => {
      if (entry.enemy !== pressedEnemy || entry.action !== pressedAction || !entry.enemy?.alive
        || entry.enemy.landing || entry.enemy.pendingAction !== entry.action || scene.battleOver || scene.waveTransitioning) return;
      scene.radialHud?.close();
      if (scene.commandMode === 'INTERRUPT') scene.handleEnemyTap(entry.enemy);
      else scene.armCommand('INTERRUPT');
    });
    button.on('pointerdown', () => { pressedEnemy = entry.enemy; pressedAction = entry.action; });
    return entry;
  });

  // Buttons retain their own fixed input centers when the content shifts vertically.
  // Rebinding press handlers on every frame would accumulate scene listeners.
  const moveButton = (button, y) => {
    const delta = y - button.y;
    button.y = y;
    button.pressVisuals.forEach(object => { object.y += delta; });
  };
  return {
    update() {
      // Catch-up temporarily replaces labels with display stand-ins without geometry.
      // Leave HUD layout alone until the actual Phaser views have been restored.
      if (scene.idleSimulating || scene.game.backgroundProgress?.isReplaying) return;
      const nextCompact = scene.scale.displaySize.width < 1200;
      if (nextCompact !== compact) { compact = nextCompact; expanded = !compact; }
      if (scene.inspectedEnemyId !== lastInspected) {
        lastInspected = scene.inspectedEnemyId;
        if (lastInspected && !scene.getSelectedUnits().length) expanded = true;
      }
      const living = (scene.enemies ?? []).filter(enemy => enemy.alive);
      const important = enemy => enemy.id === scene.focusTargetId
        || enemy.id === scene.inspectedEnemyId || [...scene.attackTargets.values()].includes(enemy.id)
        || Boolean(enemy.pendingAction && enemy.pendingAction.name !== 'Attack');
      const occupied = [];
      for (const ally of scene.partyUnits ?? []) {
        if (ally.alive && ally.label?.active && typeof ally.label.getBounds === 'function') occupied.push(ally.label.getBounds());
      }
      [...living].sort((a, b) => Number(important(b)) - Number(important(a))).forEach(enemy => {
        if (enemy.landing || !enemy.label?.active || typeof enemy.label.getBounds !== 'function') return;
        const bounds = enemy.label.getBounds();
        const overlaps = occupied.some(other => bounds.left < other.right + 8 && bounds.right > other.left - 8
          && bounds.top < other.bottom + 4 && bounds.bottom > other.top - 4);
        const visible = important(enemy) || !overlaps;
        enemy.label.setVisible(visible);
        enemy.targetLabel?.setVisible(important(enemy));
        if (visible) occupied.push(bounds);
      });
      const grouped = new Map();
      living.forEach(enemy => {
        const key = enemy.enemyType ?? enemy.name;
        const group = grouped.get(key) ?? { enemy, count: 0 };
        group.count += 1;
        grouped.set(key, group);
      });
      const groups = [...grouped.values()];
      groupCount = groups.length;
      page = Math.min(page, Math.max(0, Math.ceil(groupCount / rows.length) - 1));
      const pages = Math.ceil(groupCount / rows.length);
      fit(countText, `${living.length} alive  ${expanded ? '▴' : '▾'}`);
      let y = top + 116;
      rows.forEach((row, index) => {
        const group = expanded && groups[page * rows.length + index];
        [row.name, row.count, row.icon].forEach(object => object.setVisible(Boolean(group)));
        if (!group) return;
        row.icon.setPosition(left + 21, y + 16);
        row.name.setPosition(left + 54, y + 5);
        row.count.setPosition(left + 54, y + 31).setText(`×${group.count}`);
        fit(row.name, group.enemy.name, contentWidth - 54);
        fit(row.count, row.count.text, contentWidth - 54);
        const visual = group.enemy.spriteVisual;
        const frame = visual?.definition?.portraitFrame;
        const image = visual?.image;
        row.icon.setVisible(Boolean(frame || image?.texture));
        if (frame || image?.texture) {
          row.icon.setTexture(frame?.key ?? image.texture.key, frame?.frame ?? image.frame.name);
          row.icon.setScale(Math.min(44 / row.icon.width, 50 / row.icon.height));
        }
        y += 62;
      });
      const paged = expanded && pages > 1;
      pageButton.setVisible(paged);
      pageButton.input.enabled = paged;
      pageText.setVisible(paged);
      if (paged) {
        moveButton(pageButton, y + 26);
        pageText.setPosition(x, y + 26).setText(`Types ${page + 1}/${pages}  ›`);
        y += 68;
      }

      // Existing Focus/Attack targets retain priority over stale inspection.
      const orderedIds = [...scene.attackTargets.values()];
      const target = living.find(enemy => enemy.id === scene.focusTargetId)
        ?? living.find(enemy => enemy.id === orderedIds[orderedIds.length - 1])
        ?? living.find(enemy => enemy.id === scene.inspectedEnemyId);
      const showTarget = expanded && Boolean(target);
      [targetTitle, targetName, hpBack, hpFill, hpText].forEach(object => object.setVisible(showTarget));
      if (showTarget) {
        targetTitle.setY(y + 10);
        targetName.setY(y + 43);
        fit(targetName, `${target.name}${target.level ? ` · Lv ${target.level}` : ''}`);
        const ratio = Math.max(0, Math.min(1, target.hp / Math.max(1, target.maxHp)));
        hpBack.setY(y + 77);
        hpFill.setY(y + 77).setDisplaySize(contentWidth * ratio, 22).setVisible(ratio > 0);
        hpText.setPosition(x, y + 77).setText(`${Math.ceil(target.hp)} / ${Math.round(target.maxHp)}`);
        fit(hpText, hpText.text);
        y += 112;
      }
      const active = living.filter(enemy => !enemy.landing && enemy.pendingAction && enemy.pendingAction.name !== 'Attack');
      const dangerous = enemy => enemy.definition?.boss || Object.values(enemy.abilities ?? {})
        .some(ability => ability.name === enemy.pendingAction.name && (ability.telegraph || ability.responseHint));
      active.sort((a, b) => (a.pendingAction.startAt + a.pendingAction.duration)
        - (b.pendingAction.startAt + b.pendingAction.duration) || Number(dangerous(b)) - Number(dangerous(a)));
      const visibleCasts = active.slice(0, expanded ? 2 : 1);
      castTitle.setVisible(visibleCasts.length > 0).setY(y + 8);
      if (visibleCasts.length) {
        castTitle.setText(`CASTS${active.length > visibleCasts.length ? `  +${active.length - visibleCasts.length}` : ''}`);
        y += 36;
      }
      casts.forEach((entry, index) => {
        const enemy = visibleCasts[index];
        entry.enemy = enemy;
        entry.action = enemy?.pendingAction;
        [entry.button, entry.name, entry.ability, entry.bar].forEach(object => object.setVisible(Boolean(enemy)));
        entry.button.input.enabled = Boolean(enemy);
        if (!enemy) return;
        const action = enemy.pendingAction;
        const remaining = Math.max(0, action.startAt + action.duration - scene.time.now);
        const progress = Math.max(0, Math.min(1, 1 - remaining / Math.max(1, action.duration)));
        const urgent = remaining < 1000;
        moveButton(entry.button, y + 36);
        entry.name.setY(y + 12);
        entry.ability.setY(y + 40);
        entry.bar.setY(y + 66);
        fit(entry.name, `${enemy.name} · ${(remaining / 1000).toFixed(1)}s`);
        fit(entry.ability, action.name);
        entry.ability.setColor(urgent ? '#fca5a5' : '#fde68a');
        entry.button.setStrokeStyle(urgent ? 3 : 1, urgent ? 0xef7777 : 0x8b714b);
        entry.bar.setDisplaySize(contentWidth * progress, 6).setFillStyle(urgent ? 0xef7777 : 0xe8b75c);
        y += 96;
      });
      const desiredHeight = Math.max(96, y - top + 28);
      if (desiredHeight !== panelHeight) {
        panel?.destroy();
        panelHeight = desiredHeight;
        panel = combatPanel(scene, x, top + panelHeight / 2, panelWidth, panelHeight, 4599).setInteractive();
        panel.on('pointerdown', (pointer, lx, ly, event) => event.stopPropagation());
      }
    }
  };
}
