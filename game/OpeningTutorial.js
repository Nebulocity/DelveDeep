import GameState from './GameState.js';
import { saveProfile } from './GameStorage.js';
import { beginRecruitmentTutorial } from './RecruitmentTutorial.js';
import { usesAuthoredTutorial } from './TutorialPresentation.js';
import { selectedParty, partyCounts } from './PartySelection.js';
import { ownedEquipment, equipmentOwner, canEquipItem } from './Equipment.js';
import { emitGameplay, PLAYER_SOURCE } from './GameplayEvents.js';

export const OPENING_TUTORIAL = 'pineshire-first-adventure';
const sceneRule = sceneId => ({ type: 'scene.entered', source: 'system', sceneId });
const continued = { type: 'tutorial.continued', source: 'player' };
const legal = party => party.every(h => GameState.recruitedIds.includes(h.id)) && party.length === 5 && new Set(party.map(h => h.id)).size === 5
  && party.some(h => h.id === 'garrick') && partyCounts(party).Tank === 1
  && partyCounts(party).Healer >= 1 && partyCounts(party).Healer <= 2 && partyCounts(party).DPS <= 4;
const owned = () => GameState.recruitedIds.includes('garrick');
const sceneStep = (scene, targetId, instruction, destination, next) =>
  ({ scene, targetId, instruction, evidence: sceneRule(destination), next });
const card = (scene, instruction, next, extra = {}) =>
  ({ scene, instruction, presentation: 'card', evidence: continued, next, ...extra });
const enemyIds = scene => (scene.enemies ?? []).filter(e => e.alive && !e.landing).map(e => 'battle-enemy-' + e.id);
const battleControls = scene => ['battle-pause', 'battle-radial-SELECT', 'battle-radial-ACTION', 'battle-radial-ABILITIES',
  'battle-radial-gesture', 'battle-arena', 'selection-details-close', 'scroll-selection-details-body',
  ...(scene.radialHud?.options ?? []).filter(option => option.hit.name.startsWith('battle-ability-')).map(option => option.hit.name), ...['All', 'Tank', 'Healer', 'Melee', 'Ranged'].map(r => 'battle-role-' + r),
  ...['MOVE', 'HOLD', 'SPREAD', 'STACK', 'INTERRUPT'].map(c => 'battle-command-' + c),
  ...(scene.partyUnits ?? []).flatMap(h => ['battle-party-' + h.id, 'battle-card-' + h.id]), ...enemyIds(scene)];

// These are current gameplay tasks, not rewards or a separate practice encounter.
// Reconciliation only reads ownership, saved parties, checkpoints and settled victories.
export function openingDefinition() {
  const checkpoints = {
    welcome: card('TownScene', 'You are the Party Leader. Gather your adventurers here in Pineshire, then prepare to face the creatures threatening the Reach.', 'town-tavern'),
    'town-tavern': sceneStep('TownScene', 'town-tavern', 'There’s talk of a tank looking for adventure. Visit the Tavern.', 'TavernScene', 'hire-garrick'),
    'hire-garrick': { scene: 'TavernScene', targetId: 'tavern-hire', instruction: 'Garrick will join for free. Inspect his abilities if you like, then Hire for Free and confirm Hire.',
      evidence: { type: 'adventurer.recruited', source: 'player', actorId: 'garrick' }, next: 'prepare-heroes' },
    'prepare-heroes': sceneStep('HeroesScene', 'town-manage-party', 'Garrick is now in your roster. Open Manage Party and give him a place in the expedition.', 'PartySelectScene', 'party-fill'),
    'party-fill': { scene: 'PartySelectScene', targetId: 'party-adventurer-garrick', instruction: 'Choose Garrick, a healer and three damage dealers. Keep your selections, or use Auto-Select.', next: 'party-save' },
    'party-save': { scene: 'PartySelectScene', targetId: 'party-save', instruction: 'Five adventurers, ready for the road. Save Party to make this your expedition lineup.',
      evidence: { type: 'party.saved', source: 'player', validate: (event, state) => Array.isArray(event.memberIds) && legal(event.memberIds.map(id => state.roster.find(h => h.id === id)).filter(Boolean)) }, next: 'ready-map' },
    'ready-map': sceneStep('TownScene', 'town-world-map', 'The road is calling. Return to the World Map.', 'TitleScene', 'slime-select'),
    'slime-select': { scene: 'TitleScene', targetId: 'destination-slime-cave', targetIds: ['destination-slime-cave', 'map-location-slime-cave', 'map-landmark-slime-cave'],
      instruction: 'Something is stirring beneath the hills. Choose The Slime Cave.', evidence: { type: 'selection.changed', source: 'player', selectionId: 'slime-cave' }, next: 'slime-travel' },
    'slime-travel': sceneStep('TitleScene', 'destination-travel', 'Follow the road to the Slime Cave. Tap Travel, then let the party make the journey.', 'DelveSelectScene', 'slime-depart'),
    'slime-depart': sceneStep('DelveSelectScene', 'delve-depart', 'A six-wave expedition awaits, with camp before the boss. Your party is ready: Delve Deep!', 'BattleScene', 'battle-hud'),
    'battle-hud': card('BattleScene', 'Into the cave! Your party fights on its own. The left-hand cards show Health and Mana; you direct their tactics.', 'battle-select', { pause: true, targetId: 'tutorial-party-resources' }),
    'battle-select': { scene: 'BattleScene', targetId: 'battle-party-garrick', instruction: 'Select Garrick by tapping his card or his figure on the battlefield.', pause: true,
      evidence: { type: 'selection.changed', source: 'player', actorId: 'garrick' }, next: 'battle-move' },
    'battle-move': { scene: 'BattleScene', command: 'MOVE', instruction: 'A real warning is active. ACTION → Move, then choose clear ground for Garrick. Attack sends him back afterward.',
      evidence: { type: 'combat.movement.arrived', source: 'player' }, next: 'battle-attack' },
    'battle-attack': { scene: 'BattleScene', instruction: 'Send your selected hero back into the fight: tap a live enemy to Attack.',
      evidence: { type: 'combat.order.executed', source: 'player', command: 'ATTACK' }, next: 'first-find' },
    'first-find': { scene: 'BattleScene', presentation: 'ambient', instruction: '', next: 'camp' },
    camp: { scene: 'BattleScene', targetId: 'battle-camp-2',
      instruction: 'Camp: Leave keeps banked rewards; Farm repeats a cleared wave. Face Boss when you’re ready.', next: 'boss-interrupt' },
    'boss-interrupt': { scene: 'BattleScene', keepDuringWarning: true,
      instruction: 'ACTION → Interrupt → casting Sovereign.',
      evidence: { type: 'combat.interrupt.succeeded', source: 'player' }, next: 'victory' },
    victory: { scene: 'RewardScene', targetId: 'reward-world-map', instruction: 'The cave is cleared! Your real rewards and level gains are saved. Return to the World Map.',
      evidence: sceneRule('TitleScene'), next: 'return-select' },
    'return-select': { scene: 'TitleScene', targetId: 'destination-pineshire', targetIds: ['destination-pineshire', 'map-location-pineshire', 'map-landmark-pineshire'],
      instruction: 'Victorious, we return to Pineshire. Choose the town.', evidence: { type: 'selection.changed', source: 'player', selectionId: 'pineshire' }, next: 'return-travel' },
    'return-travel': sceneStep('TitleScene', 'destination-travel', 'Travel back to Pineshire. Your loot and earned experience stay with you.', 'TownScene', 'town-rewards'),
    'town-rewards': { scene: 'TownScene', presentation: 'ambient', instruction: '', next: 'complete' },
    complete: { scene: 'TownScene', presentation: 'ambient', instruction: 'Your first adventure is complete. Equipment compares your finds; ? offers optional help. Choose your next road.', next: null }
  };
  return { firstCheckpoint: 'welcome', checkpoints };
}

export default class OpeningTutorial {
  constructor(service) { this.service = service; service.define(OPENING_TUTORIAL, openingDefinition()); }
  active() { return this.service.guiding() && this.service.controller.progress.lessonId === OPENING_TUTORIAL; }
  start(scene, replay = false) {
    if (usesAuthoredTutorial) return { ok: false, message: 'This adventure uses the tutorial published from Tutorial Studio.' };
    const service = this.service, p = service.controller.progress;
    if (GameState.activeBattle && (p.lessonId !== OPENING_TUTORIAL || !['active', 'paused', 'retry'].includes(p.status) || replay))
      return { ok: false, message: 'Finish your active expedition before starting the tutorial.' };
    if (!replay && p.lessonId === OPENING_TUTORIAL && ['active', 'paused', 'retry'].includes(p.status)) {
      const result = p.status === 'retry' ? service.controller.retry(service.controller.capture()) : service.controller.resume(service.controller.capture());
      service.scene = scene; service.refresh();
      if (result.ok && p.checkpointId === 'welcome') this.enterPineshire(scene);
      return result;
    }
    const recruit = owned() && legal(selectedParty()) ? { ok: true } : beginRecruitmentTutorial();
    if (!recruit.ok) return recruit;
    const result = service.begin(OPENING_TUTORIAL, scene);
    if (result.ok) this.enterPineshire(scene);
    return result;
  }
  enterPineshire(scene) {
    if (scene.scene.key === 'TownScene') return;
    GameState.world.currentLocation = 'pineshire'; GameState.world.travel = null; saveProfile();
    scene.scene.start('TownScene', { townId: 'pineshire', townName: 'Pineshire' });
  }
  advance(next, reason) {
    const controller = this.service.controller;
    const id = controller.progress.checkpointId;
    const result = controller.commit(controller.capture(), progress => {
      progress.completed[id] = 'state:' + reason;
      if (next) controller.setCheckpoint(progress, next);
      else { progress.status = 'complete'; progress.targetId = null; progress.allowedInteractions = []; }
    }, ['active']);
    if (!result.ok) {
      this.service.saveBlocked = true;
      this.service.message = 'Tutorial progress could not be saved. Tap this message to retry, or Exit Tutorial.';
      this.service.releaseScope();
    }
    return result;
  }
  continue() {
    if (this.service.saveBlocked) {
      this.service.saveBlocked = false; this.service.message = ''; this.service.refresh(); return;
    }
    if (!this.active() || this.service.step()?.evidence?.type !== 'tutorial.continued') return;
    emitGameplay(this.service.scene, 'tutorial.continued', {}, PLAYER_SOURCE);
  }
  releasePause() {
    const scene = this.pausedScene;
    this.pausedScene = null;
    this.service.controller.progress.pauseOwnedEncounter = null;
    if (scene?.sys.isActive() && scene.combatPaused) {
      this.changingPause = true;
      try { scene.togglePause('tutorial'); } finally { this.changingPause = false; }
    }
  }
  leaderTarget(scene) {
    if (this.leaderTargetFrame === scene.game.loop.frame && this.leaderTargetScene === scene) return this.tapTarget;
    this.leaderTargetFrame = scene.game.loop.frame; this.leaderTargetScene = scene;
    const previous = this.tapTarget?.enemy;
    this.tapTarget = null;
    const regions = scene.partyLeaderTap.targeting.regions();
    const ordered = [...regions].sort((a, b) => Number(b.enemy === previous) - Number(a.enemy === previous));
    for (const region of ordered) for (const fy of [0.5, 0.25, 0.75]) for (const fx of [0.5, 0.25, 0.75]) {
      const b = region.core;
      const point = { x: b.left + (b.right - b.left) * fx, y: b.top + (b.bottom - b.top) * fy };
      if (scene.partyLeaderTap.targeting.resolve(point)?.enemy !== region.enemy) continue;

      // Use Phaser's real camera/hit ordering without dispatching a press. A valid
      // artwork center can still lie behind an ally or a HUD receiver.
      let top = null;
      for (const camera of scene.cameras.getCamerasBelowPointer(point)) {
        const hits = scene.input.manager.hitTest({ ...point }, scene.input._list, camera, []);
        if (!hits.length) continue;
        scene.input.sortGameObjects(hits, { ...point, camera }); top = hits[0]; break;
      }
      if (top !== region.enemy.hitZone && top?.name !== 'battle-arena') continue;
      this.tapTarget = { enemy: region.enemy, point };
      return this.tapTarget;
    }
    return null;
  }
  presentation(step) {
    if (!this.active() || !step) return step;
    const scene = this.service.scene;
    if (!scene) return step;
    const p = this.service.controller.progress;
    const result = { ...step };
    if (p.checkpointId === 'victory' && scene.scene.key === 'RewardScene') {
      return { ...result, presentation: 'ambient', suppressInstruction: true, rewardPresentation: true };
    }
    if (scene.scene.key === 'EncounterSummaryScene') return { ...result, presentation: undefined, targetId: 'Try Again', targetIds: undefined,
      instruction: 'The party was driven back. Cleared-wave rewards stay banked. Try Again to return to the saved expedition.', allowedInteractions: ['Return to World Map'] };
    if (scene.scene.key === 'BattleScene' && scene.battleOver) return scene.children.getByName('battle-result-confirm')
      ? { ...result, presentation: undefined, targetId: 'battle-result-confirm', targetIds: undefined,
        instruction: 'The expedition has ended. Confirm to review the result and choose your next step.', allowedInteractions: [] }
      : { ...result, presentation: 'ambient', targetId: null, targetIds: undefined,
        instruction: 'Victory! Your rewards are being saved. The expedition summary is coming up.', allowedInteractions: [] };

    if (['slime-travel', 'return-travel'].includes(p.checkpointId) && scene.destination) {
      return { ...result, presentation: 'ambient', targetId: null, instruction: 'Following the road. Your party will enter when it arrives.', allowedInteractions: [] };
    }
    if (step.scene === 'BattleScene' && ['TitleScene', 'DelveSelectScene'].includes(scene.scene.key)) {
      const targetId = scene.scene.key === 'DelveSelectScene' ? 'delve-depart'
        : scene.selectedMapPoi?.id === 'slime-cave' ? 'destination-travel' : 'destination-slime-cave';
      return { ...result, targetId, targetIds: undefined, presentation: scene.destination ? 'ambient' : undefined,
        instruction: 'Your combat lesson is saved. Return to the Slime Cave to resume the expedition.', allowedInteractions: [] };
    }
    const townRoute = ['town-tavern', 'hire-garrick', 'prepare-heroes', 'party-fill', 'party-save', 'town-rewards', 'complete'].includes(p.checkpointId);
    if (townRoute && scene.scene.key === 'TitleScene') {
      const targetId = scene.selectedMapPoi?.id === 'pineshire' ? 'destination-travel' : 'destination-pineshire';
      return { ...result, targetId, targetIds: undefined, presentation: scene.destination ? 'ambient' : undefined,
        instruction: 'Resume your saved lesson: return to Pineshire using the map and Travel.', allowedInteractions: [] };
    }
    if (['party-fill', 'party-save'].includes(p.checkpointId) && ['TownScene', 'HeroesScene'].includes(scene.scene.key))
      return { ...result, targetId: scene.scene.key === 'TownScene' ? 'town-heroes' : 'town-manage-party',
        instruction: 'Resume your saved party lesson: Heroes → Manage Party. Your saved lineup is intact.' };
    if (p.checkpointId === 'hire-garrick' && scene.scene.key === 'TownScene')
      return { ...result, targetId: 'town-tavern', instruction: 'Resume at the Tavern. Garrick is waiting.' };
    if (p.checkpointId === 'prepare-heroes' && scene.scene.key !== 'PartySelectScene') {
      result.targetId = scene.scene.key === 'TavernScene' ? 'feature-back'
        : scene.scene.key === 'TownScene' ? 'town-heroes' : 'town-manage-party';
      result.instruction = 'Garrick has joined! Back to Town → Heroes → Manage Party to assemble your team.';
    }
    if (p.checkpointId === 'ready-map' && scene.scene.key === 'HeroesScene') {
      result.targetId = 'feature-back'; result.instruction = 'Party saved. Back to Town, then World Map.';
    }
    if (p.checkpointId === 'first-find') {
      const find = p.find;
      result.instruction = find ? `First find: ${find.name} (${find.rarity}). Banked! Compare it later in Town → Equipment.` : '';
      result.suppressInstruction = !find || !!p.completed['first-find-presented'];
    }
    if (p.checkpointId === 'camp' && GameState.run.entry !== 'camp') {
      result.presentation = 'ambient'; result.suppressInstruction = true;
    } else if (p.checkpointId === 'camp') result.allowedInteractions = ['battle-camp-0', 'battle-camp-1'];
    if (p.checkpointId === 'victory' && scene.scene.key === 'BattleScene') {
      result.presentation = 'ambient'; result.suppressInstruction = true;
    }
    if (p.checkpointId === 'hire-garrick') {
      result.targetId = scene.selectedId === 'garrick' ? 'tavern-hire'
        : this.service.targets.resolve('tavern-character-garrick', scene) ? 'tavern-character-garrick' : 'tavern-filter-Tank';
      result.allowedInteractions = ['tavern-character-garrick', 'tavern-inspect', 'selection-details-close'];
      if (scene.selectionDetailsClose && !this.service.confirmations.size) {
        result.targetId = 'selection-details-close';
        result.allowedInteractions.push('scroll-guild-details-body');
        result.instruction = 'Garrick’s abilities are autonomous. Close the inspection when you’re ready to hire him.';
        result.suppressInstruction = true;
        result.exclusionBounds = [scene.selectionDetailsClose.tutorialBounds].filter(Boolean);
      }
    }
    if (p.checkpointId === 'party-fill') {
      result.allowedInteractions = ['party-auto-select', ...GameState.roster.map(h => 'party-adventurer-' + h.id)];
      result.targetId = !scene.selectedIds?.has('garrick') ? 'party-adventurer-garrick' : 'party-auto-select';
    }
    if (step.command === 'MOVE' && this.executingCheckpoint === p.checkpointId) {
      return { ...result, presentation: 'ambient', targetId: null, targetIds: undefined,
        instruction: 'Order sent. Watch the group move to your destination; they will hold there when they arrive.', allowedInteractions: ['battle-pause'] };
    }
    if (p.checkpointId === 'battle-select') result.targetIds = ['battle-party-garrick', 'battle-card-garrick'];
    if (step.command || p.checkpointId === 'battle-attack') {
      const selected = scene.getSelectedUnits?.().length;
      if (!selected) result.targetId = scene.radialHud?.openMenu === 'SELECT' ? 'battle-role-Melee' : 'battle-radial-SELECT';
      else if (p.checkpointId === 'battle-attack') {
        result.targetIds = enemyIds(scene); result.targetId = result.targetIds[0];
      } else if (scene.commandMode === step.command) result.targetId = 'battle-arena';
      else result.targetId = scene.radialHud?.openMenu === 'ACTION' ? 'battle-command-' + step.command : 'battle-radial-ACTION';
      result.allowedInteractions = ['battle-radial-gesture', 'battle-pause'];
    }
    if (result.presentation === 'ambient') {
      result.allowedInteractions = scene.scene.key === 'BattleScene' ? battleControls(scene) : [];
      result.targetId = null;
    }
    if (p.checkpointId === 'boss-interrupt') {
      const boss = this.interruptTarget(scene);
      if (!boss) return { ...result, presentation: 'ambient', targetId: null, suppressInstruction: true, allowedInteractions: battleControls(scene) };
      result.targetId = scene.commandMode === 'INTERRUPT' ? 'battle-enemy-' + boss?.id
        : scene.radialHud?.openMenu === 'ACTION' ? 'battle-command-INTERRUPT' : 'battle-radial-ACTION';
      result.allowedInteractions = [...battleControls(scene), 'battle-radial-gesture'];
    }
    if (result.targetId === 'battle-arena') {
      result.targetId = 'tutorial-battle-ground';
      result.allowedInteractions = [...(result.allowedInteractions ?? []), 'battle-arena'];
    }
    if (scene.scene.key === 'PartySelectScene') {
      result.allowedInteractions = [...(result.allowedInteractions ?? []), ...scene.columns.flatMap((c, i) =>
        ['party-scroll-' + (i + 1), ...['-up', '-down', '-track', '-thumb'].map(s => 'party-scroll-' + (i + 1) + s)])];
    }
    return result;
  }
  interruptTarget(scene) {
    return scene.interruptCooldownRemainingMs <= 0
      ? scene.enemies?.find(e => e.alive && !e.landing && !e.landingWaiting && !e.untargetable && e.targetable !== false
        && e.isBoss && e.pendingAction) : null;
  }
  townFind() {
    const items = ownedEquipment();
    const p = this.service.controller.progress;
    const record = p.lessonId === OPENING_TUTORIAL ? p : p.openingRecord;
    const earned = record?.find;
    const earnedIds = new Set((record?.finds ?? (earned ? [earned] : [])).map(find => find.instanceId));
    const candidates = items.filter(item => earnedIds.has(item.id) && !equipmentOwner(item.id));
    candidates.sort((a, b) => Number(b.id === earned?.instanceId) - Number(a.id === earned?.instanceId));
    for (const item of candidates) {
      const hero = GameState.roster.find(hero => canEquipItem(hero, item));
      if (hero) return { item, hero };
    }
    return null;
  }
  equipmentMessage() {
    const offer = this.townFind();
    return offer ? `${offer.item.name} (${offer.item.rarity}) fits ${offer.hero.name}. Equipment lets you compare it; compatible does not mean stronger. Keep your current gear if you prefer.`
      : 'Your finds are stored. No unequipped find fits your current heroes. Equipment is available whenever you want to look.';
  }
  defer(next, ids, reason) {
    const c = this.service.controller;
    const result = c.commit(c.capture(), p => {
      for (const id of ids) if (!p.completed[id]) p.completed[id] = 'deferred:' + reason;
      c.setCheckpoint(p, next);
    }, ['active']);
    if (!result.ok) { this.service.saveBlocked = true; this.service.releaseScope(); }
    this.releasePause();
    return result;
  }
  update(scene) {
    if (!this.active()) { this.releasePause(); return; }
    const service = this.service, controller = service.controller, p = controller.progress, id = p.checkpointId;
    const step = controller.definitions[OPENING_TUTORIAL].checkpoints[id];
    if (!step) { this.releasePause(); return; }
    if (['town-tavern', 'hire-garrick', 'prepare-heroes'].includes(id) && owned()) {
      if (legal(selectedParty())) return this.advance('ready-map', 'persisted-legal-party');
      if (['town-tavern', 'hire-garrick'].includes(id)) return this.advance('prepare-heroes', 'owned-garrick');
    }
    if (id === 'ready-map' && scene.scene.key === 'TitleScene' && !service.navigation && !service.transitioning)
      return this.advance('slime-select', 'already-on-world-map');
    if (id === 'party-fill' && scene.scene.key === 'PartySelectScene'
      && legal([...scene.selectedIds].map(key => GameState.roster.find(h => h.id === key)).filter(Boolean))) return this.advance('party-save', 'legal-selection');
    if ((['slime-select', 'slime-travel', 'slime-depart'].includes(id) || step.scene === 'BattleScene' && scene.scene.key === 'TitleScene') && GameState.world.clearedDelves.includes('slime-cave'))
      return this.defer('return-select', ['battle-select', 'battle-move', 'battle-attack', 'boss-interrupt'], 'already-cleared');
    if (id === 'town-rewards' && scene.scene.key === 'TownScene') {
      this.townOffer = this.townFind();
      this.closure = this.equipmentMessage();
      return this.advance('complete', 'optional-equipment-offer');
    }
    if (id === 'complete' && scene.scene.key === 'TownScene') {
      // Closure persists as a dismissible recap, without owning gameplay input.
      service.closureMessage = this.closure ?? 'Your first adventure is complete. Explore Town and choose your next road. ? offers optional help.';
      service.closureOffer = this.townOffer;
      return this.advance(null, 'free-exploration');
    }
    if (scene.scene.key === 'BattleScene') {
      if (p.encounterId !== scene.gameplayContext?.encounterId && scene.gameplayContext) {
        controller.bindEncounter(scene.gameplayContext.encounterId, 'campaign', controller.capture()); return;
      }
      if (scene.battleOver) { this.releasePause(); return; }
      this.registerEnemies(scene);
      if (['battle-select', 'battle-move', 'battle-attack', 'first-find'].includes(id) && GameState.run.entry === 'camp')
        return this.defer('camp', ['battle-move', 'battle-attack'], 'camp-reached');
      if (id === 'battle-move') {
        const warning = scene.activeTelegraphs?.some(t => !t.attacker?.isBoss && t.attacker?.alive);
        const blocked = scene.partyUnits.some(u => u.manualMovement?.blocked);
        if (!warning && this.lastCheckpoint !== id || blocked || scene.waveRetreating || !enemyIds(scene).length)
          return this.defer('first-find', ['battle-move', 'battle-attack'], blocked ? 'movement-blocked' : 'no-live-opportunity');
      }
      if (id === 'battle-attack' && (scene.waveRetreating || !enemyIds(scene).length))
        return this.defer('first-find', ['battle-attack'], 'encounter-resolved');
      if (id === 'first-find' && p.find && !p.completed['first-find-presented'] && scene.waveRewardText?.visible) {
        // The real reward renderer names this banked item. Presentation is not comprehension or equip evidence.
        controller.commit(controller.capture(), next => { next.completed['first-find-presented'] = 'presented:' + next.find.instanceId; }, ['active']);
        return;
      }
      if (id === 'first-find' && GameState.pineshireSettlements['slime-cave:1'] && (!scene.waveRewardText || GameState.run.entry === 'camp'))
        return this.advance('camp', 'banked-first-find');
      if (id === 'camp' && scene.currentWaveIndex === scene.bossWaveIndex && GameState.run.entry !== 'camp')
        return this.advance('boss-interrupt', 'face-boss');
      const practicing = ['battle-move', 'battle-attack'].includes(id) || id === 'boss-interrupt' && !!this.interruptTarget(scene);
      if (this.lastCheckpoint !== id) this.executingCheckpoint = null;
      if (practicing && scene.pendingLeaderOrders?.length) this.executingCheckpoint = id;
      const wantsPause = practicing ? this.executingCheckpoint !== id : !!step.pause;
      if (wantsPause) {
        if (!scene.combatPaused) {
          this.changingPause = true;
          try { scene.togglePause('tutorial'); } finally { this.changingPause = false; }
          this.pausedScene = scene; p.pauseOwnedEncounter = scene.gameplayContext?.encounterId;
        } else if (p.pauseOwnedEncounter === scene.gameplayContext?.encounterId) this.pausedScene = scene;
      }
      else if (!wantsPause) this.releasePause();
    }
    if (scene.scene.key === 'BattleScene' && !this.registeredScenes?.has(scene.gameplayObserverSessionId)) {
      this.registeredScenes ??= new Set();
      this.registeredScenes.add(scene.gameplayObserverSessionId);
      service.register(scene, 'tutorial-battle-ground', { bounds: () => ({ x: scene.battlefield.topLeftX, y: scene.battlefield.topY,
        width: scene.battlefield.bottomRightX - scene.battlefield.topLeftX, height: scene.battlefield.bottomY - scene.battlefield.topY }) });
      service.register(scene, 'tutorial-party-resources', { bounds: () => {
        const cards = scene.partyHud.map(h => service.targets.resolve('battle-card-' + h.unit.id, scene)?.bounds).filter(Boolean);
        if (!cards.length) return null;
        const x = Math.min(...cards.map(b => b.x)), y = Math.min(...cards.map(b => b.y));
        return { x, y, width: Math.max(...cards.map(b => b.x + b.width)) - x, height: Math.max(...cards.map(b => b.y + b.height)) - y };
      } });
      service.register(scene, 'tutorial-wave-reward', { bounds: () => {
        const b = scene.waveRewardText?.getBounds();
        return b ? { x: b.x, y: b.y, width: b.width, height: b.height } : null;
      } });
    }
    this.lastCheckpoint = id;
    if (scene.scene.key === 'RewardScene' && id !== 'victory')
      return this.defer('victory', ['battle-move', 'battle-attack', 'boss-interrupt'], 'genuine-victory');
    if (scene.scene.key !== step.scene && !service.navigation && !service.transitioning) {
      if (scene.scene.key === 'EncounterSummaryScene') return;
      if (id === 'prepare-heroes' && ['TavernScene', 'TownScene', 'HeroesScene'].includes(scene.scene.key)) return;
      if (id === 'ready-map' && scene.scene.key === 'HeroesScene') return;
      if (id === 'victory' && scene.scene.key === 'BattleScene') return;
      if (step.scene === 'BattleScene') return;
      // Navigation belongs to real gameplay controls. Resume never manufactures scene entry.
    }
  }
  registerEnemies(scene) {
    const controller = this.service.controller;
    this.registeredEnemies ??= new WeakSet();
    for (const enemy of scene.enemies ?? []) if (!this.registeredEnemies.has(enemy)) {
      this.registeredEnemies.add(enemy);
      this.service.register(scene, 'battle-enemy-' + enemy.id, { object: enemy.hitZone,
        available: () => enemy.alive && !enemy.landing,
        bounds: () => {
          if (controller.progress.checkpointId !== 'leader-tap') return undefined;
          const b = scene.partyLeaderTap.targeting.regions().find(r => r.enemy === enemy)?.core;
          return b ? { x: b.left, y: b.top, width: b.right - b.left, height: b.bottom - b.top } : null;
        } });
    }
  }
}
