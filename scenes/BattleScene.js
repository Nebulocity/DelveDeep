import { dialogFrame } from '../ui/DialogFrame.js';
import { scrollbarSurface } from '../ui/Scrollbar.js';
import { isMageClass } from '../config/characterProgression.js';
import LeaderOrderPlan from '../combat/LeaderOrderPlan.js';
import { beginGameplayEncounter, emitGameplay, requestOrder, acceptOrder, rejectOrder, executeOrder, cancelOrder, assignMovement,
  finishGameplayEncounter, warningStarted, warningResolved, targetedTacticUnits, tacticRecipients, PLAYER_SOURCE } from '../game/GameplayEvents.js';
import PartyLeaderTapCombat from '../combat/PartyLeaderTapCombat.js';
import { createPartyLeaderTapIcon } from '../ui/PartyLeaderTapIcon.js';
import { createTacticalPlanOverlay } from '../ui/TacticalPlanOverlay.js';
// This screen ties the battle together: units, waves, party orders, rewards and the HUD.
// Gameplay positions use the logical arena; HUD positions use our 2400 by 1080 canvas.
// Phaser's time.now and timer delays are milliseconds. Frame delta is also milliseconds,
// so movement converts it to seconds before applying a speed. The background battle uses
// the same combat methods, which is why drawing-only shortcuts must not skip gameplay
// changes.

import { fontPx, UI_FONT_SIZES, UI_FONT_FAMILIES, UI_FONT_WEIGHTS } from '../config/uiTypography.js';
import { abilityPower, hitAccuracy } from '../game/CharacterStats.js';
import { replacementMultiplier, replacementChance } from '../combat/ReplacementEffects.js';
import { installBattleClock } from '../combat/BattleClock.js';
import { preloadTeleportEffects } from '../data/teleportEffects.js';
import { startTeleportEffect, updateTeleportEffects } from '../combat/TeleportEffects.js';
import { createLevelUpEffect, updateLevelUpEffects, clearLevelUpEffects, LEVEL_UP_DURATION_MS } from '../combat/LevelUpEffect.js';
import { acknowledgeAbilityUnlockIds } from '../game/AbilityUnlockNotifications.js';
import { leaderAbilityDescription } from '../game/AbilityDescriptions.js';
import { showConfirmation } from '../ui/ConfirmationDialog.js';
import { bindButtonPress } from '../ui/ButtonPress.js';
import { showFeatureToast } from '../ui/FeatureToast.js';
import { playUiSound } from '../services/UiAudioService.js';
import { hallScroll } from '../ui/HallUI.js';
import { preloadCarvedStone, addStoneOrnaments, stoneText, stoneIcon, campStoneIcon, delveStoneTheme, STONE } from '../ui/CarvedStone.js';
import { preloadSlimeSprites } from '../data/slimeSprites.js';
import { preloadSlimeAbilityEffects } from '../data/slimeAbilityEffects.js';
import { preloadThornbriarAbilityEffects } from '../data/thornbriarAbilityEffects.js';
import { fadeSlimeTelegraph, playSlimeAbilityEffect, updateSlimeAbilityEffects, startSlimeGlobFlight, landSlimeGlobFlight } from '../combat/SlimeAbilityEffects.js';

import { chooseWaveLandings } from '../combat/WaveLanding.js';
import { createBossLandingEffect, updateBossLandingEffects, clearBossLandingEffects } from '../combat/BossLandingEffect.js';
import { bindSelectionDetails, characterDetails, showSelectionDetails } from '../ui/SelectionDetails.js';
import Phaser from 'phaser';
import { retireUmbralDecoy } from '../combat/UmbralDecoyEffects.js';
import ClassAbilitySystem from '../combat/ClassAbilitySystem.js';
import { preloadCharacterSprites } from '../data/characterSprites.js';
import { preloadEnemySprites } from '../data/enemySprites.js';
import { preloadVoidSprites } from '../data/voidSprites.js';
import { preloadSunkenWatchSprites } from '../data/sunkenWatchSprites.js';
import { preloadQuarrySprites } from '../data/quarrySprites.js';
import GameState from '../game/GameState.js';
import { STORY_WAVE_READY, storyWaveReadyId, storyWaveHasLanded } from '../game/StoryWaveStart.js';
import { preloadCombatHud, combatPanel, combatButton, combatText, combatHudLayout } from '../ui/CombatHudTheme.js';
import { createCombatPartyRoster } from '../ui/CombatPartyRoster.js';
import CombatRadials from '../ui/CombatRadials.js';
import { createCombatPauseMenu } from '../ui/CombatPauseMenu.js';

import { getEquippedAdventurer, equippedItem, consumePotionCharge } from '../game/Equipment.js';
import { getPotionDefinition, getMaterialDefinition, ITEM_RARITIES } from '../data/items.js';
import { applyPotionEffects, potionCooldownRemaining, potionEffectDescription, potionHasBenefit, startPotionCooldown } from '../game/Potions.js';
import { battleAbilities } from '../game/AdventurerAbilities.js';
import enemies from '../data/enemies.js';
import { thornbriarEnemyDefinition } from '../config/thornbriarBalance.js';
import { delveEnemyDefinition } from '../config/delveBalance.js';
import { prepareActiveMonster, syncActiveCombat } from '../config/activeCombatBalance.js';
import { createEncounterWaves } from '../data/encounters.js';
import { leaderAbilities } from '../game/LeaderProgression.js';
import { coordinatedTacticDamage } from '../data/leaderTactics.js';
import { applyExpandedTactic, expandedTacticHasBenefit, tacticCanRevive } from '../combat/LeaderTacticEffects.js';
import BattleUnit from '../combat/BattleUnit.js';

import BattlefieldGeometry from '../combat/BattlefieldGeometry.js';
import BattlefieldTerrain from '../combat/BattlefieldTerrain.js';
import BattlefieldTerrainEditor from '../combat/BattlefieldTerrainEditor.js';
import TacticsController from '../combat/TacticsController.js';
import CombatMovement from '../combat/CombatMovement.js';
import { updateVoidProjectiles } from '../combat/VoidProjectile.js';
import { clearThornbriarAbilityEffects, startThornbriarAbilityEffect, updateThornbriarAbilityEffects } from '../combat/ThornbriarAbilityEffects.js';
import { preloadAbilityEffects } from '../data/abilityEffects.js';
import { createAbilityEffect, updateAbilityEffects, createAbilityTelegraph, clearAbilityTelegraph } from '../combat/AbilityEffect.js';
import { startTravelingEffect, finishTravelingEffect } from '../combat/TravelingEffects.js';
import { rangedTravelProfile } from '../data/rangedTravelEffects.js';
import combatSpacing from '../config/combatSpacing.js';
import CombatLog from '../combat/CombatLog.js';

import HapticsService from '../services/HapticsService.js';
import { completeExpedition, failExpedition, fleeExpedition, formatDuration } from '../game/ExpeditionProgression.js';
import { saveProfile } from '../game/GameStorage.js';
import { awardOrdinaryWave, getDelveCheckpoint, isOrdinaryDelve, delveCampWaves, delveFarmWaveIndex, delveRewardEligibility, cappedDelveGold } from '../game/DelveCheckpoints.js';
import { equipmentPerkBonus } from '../game/EquipmentPerks.js';
import { awardEquipmentLoot, mergeEquipmentLoot } from '../game/EquipmentLoot.js';
import { awardPineshireBoss } from '../game/DelveCheckpoints.js';
import { getBattleLayout } from '../ui/Layout.js';
import { createCombatEncounterPanel } from '../ui/CombatEncounterPanel.js';
import { preloadEnvironment, createEnvironment, getDelveArena } from '../combat/LayeredEnvironment.js';
import { trackLoading, hideLoadingScreenAfterRender } from '../ui/LoadingScreen.js';

import { installBattlePersistence, restoreBattle } from '../combat/BattlePersistence.js';
import { cappedChance } from '../config/characterProgression.js';
import { canTankTaunt, INTERPOSE, INTERVENE, INTERCEPT_THREAT_FRACTION, reactiveTankThreat } from '../combat/TankMechanics.js';
import { advanceIdleBattle, resumeIdleBattle, recordIdleEvent } from '../combat/IdleBattle.js';
import { prepareDeathNotifications } from '../services/DeathNotifications.js';
import { idleRewardRows } from '../game/IdleSummary.js';
import { RESOURCE_GAIN_COLOR, rewardItemColor, rewardTextRows, firstFindReceipt } from '../ui/RewardDisplay.js';
import { advanceOfflineFarm, finishOfflineFarm } from '../combat/OfflineFarm.js';
import { recordFarmClear } from '../combat/FarmTiming.js';
import { migrateEncounterSnapshot, legacyPortalCheckpoint } from '../game/EncounterSaveMigration.js';

export default class BattleScene extends Phaser.Scene {

  // This helper registers BattleScene so the game can navigate to this screen.
  constructor() {

    super('BattleScene');
  }

  // Encounter visual data supplies only the assets needed by the selected delve. Other
  // delves retain the existing battlefield presentation.
  preload() {
    trackLoading(this);
    preloadCarvedStone(this);
    preloadCombatHud(this);
    preloadCharacterSprites(this);
    preloadEnemySprites(this);
    preloadAbilityEffects(this);
    preloadTeleportEffects(this);

    // These larger void atlases are only needed by portal encounters. Ordinary delves
    // avoid allocating their texture memory until the party enters a void battlefield.
    if (GameState.currentDelve?.type === 'void') preloadVoidSprites(this);

    // The persistent map ID also covers older saves that still name Thornbriar's template.
    const delve = GameState.currentDelve;
    if (delve?.id === 'verge-delves' || (delve?.encounterId ?? delve?.id) === 'sunken-watch') {
      preloadSunkenWatchSprites(this);
    }

    // Load Quarry sheets for both its current template and its persistent saved map ID.
    if (delve?.id === 'march-west-delves' || (delve?.encounterId ?? delve?.id) === 'old-quarry') {
      preloadQuarrySprites(this);
    }
    preloadSlimeSprites(this);

    // Ability sheets are small, so load them only for the encounter that uses them.
    if (GameState.currentDelve?.id === 'slime-cave'
      || GameState.currentDelve?.encounterId === 'slime-cave') preloadSlimeAbilityEffects(this);

    // Load Thornbriar's impact sheets only for its own encounter.
    if ((delve?.encounterId ?? delve?.id) === 'thornbriar-hollow') preloadThornbriarAbilityEffects(this);

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    const environment = GameState.currentDelve?.visuals?.environment;
    if (environment) preloadEnvironment(this, environment);
    const background = GameState.currentDelve?.visuals?.battlefieldBackground;

    if (background?.key && background?.url && !this.textures.exists(background.key)) {
      this.load.image(background.key, background.url);
    }
  }

  // This helper starts a new battle by resetting encounter state, creating the perspective
  // arena and combatants, and building the tactical controls. It also starts the combat
  // log and announces the first enemy wave.
  create() {
    installBattleClock(this);
    this.bossLandingEffects = [];
    this.bossLandingRumble = null;
    this.events.once('shutdown', () => clearBossLandingEffects(this));
    this.levelUpEffects = [];
    this.events.once('shutdown', () => clearLevelUpEffects(this));
    this.isThornbriarHollow = GameState.currentDelve?.id === 'thornbriar-hollow';
    this.events.once('shutdown', () => clearThornbriarAbilityEffects(this));
    this.classAbilitySystem = new ClassAbilitySystem(this);

    // The braces pull named fields into local variables. This reads those fields without
    // copying the whole source object.
    const { width, height } = this.scale;

    // Reset encounter flags, selections, movement orders, threat tables, and leader
    // cooldowns for a fresh battle.
    this.battleOver = false;
    beginGameplayEncounter(this);

    // A Set keeps each value once. has checks membership without searching a list for
    // duplicate entries.
    this.battleEvents = new Set();
    this.waveTransitioning = false;
    this.waveRetreating = false;
    this.farmStopRequested = false;

    // A Map pairs a key with a value. Unlike an array index, the key can be an ID or an
    // object; get/set read and write that same key.
    this.waveReturnPositions = new Map();
    this.waveReturnTargets = new Map();
    this.activeTelegraphs = [];
    this.currentWaveIndex = -1;
    this.enemySerial = 0;
    this.earnedGold = 0;
    this.enemyThreat = new Map();

    this.enemies = [];
    this.lastPotionUseAt = new Map();
    this.selectedUnitIds = new Set();
    this.manualTargets = new Map();
    this.attackTargets = new Map();
    this.healerPriorityTargets = new Map();
    this.heldUnitIds = new Set();

    this.commandMode = null;
    this.focusTargetId = null;
    this.inspectedEnemyId = null;
    this.interruptCooldownRemainingMs = 0;
    this.leaderAbilityCooldowns = new Map();
    this.assaultUntil = 0;
    this.braceUntil = 0;
    this.usedLeaderAbilities = new Set();
    this.pendingPausedTactics = [];
    this.pendingLeaderOrders = [];
    this.leaderOrderSerial = 0;

    this.awaitingRevive = false;
    this.idleSummary = null;
    this.idleSummaryOpen = false;
    this.idleSummaryResumePaused = undefined;
    this.idlePhaseRemainingMs = undefined;
    this.idleSimulation = null;
    this.idleSimulating = false;
    this.farmTiming = null;
    this.offlineFarm = null;

    // These bit operators work with 32-bit integers. >>> shifts in zero bits, while ^
    // mixes bits with XOR. They are different from ordinary multiplication or
    // exponentiation.
    this.combatRngState = (Date.now() >>> 0) || 1;
    this.battleLayout = getBattleLayout(width, height);
    this.combatPaused = false;
    this.time.paused = false;

    // The paused combat clock also measures time spent resting or waiting inside the Delve.
    this.delveTimerStartedAt = this.time.now;
    this.stoneTheme = delveStoneTheme(GameState.currentDelve);

    // Define the logical combat area and the screen-space perspective used to display its
    // arena and units.
    this.battlefield = new BattlefieldGeometry(this, {
      bottomLeftX: 310,
      bottomRightX: width - 310,
      topLeftX: width * 0.27,
      topRightX: width * 0.73,
      bottomY: height * 0.775,
      topY: this.battleLayout.arenaTop,
      logicalWidth: 1750,
      logicalHeight: 900,
      nearScale: 1.05,
      farScale: 0.74,
      ...(GameState.currentDelve?.visuals?.environment
        ? getDelveArena(GameState.currentDelve.visuals.environment, width, height) : {})
    });

    // Create the formation controller and copy the appropriate encounter wave definitions.
    this.terrain = new BattlefieldTerrain(this, this.battlefield, GameState.currentDelve?.terrain ?? []);

    // Uncomment this while authoring terrain to see blocked polygons over the art.
    this.terrainDebug = null;

    this.tactics = new TacticsController(this.battlefield, GameState.tactics);
    this.movement = new CombatMovement(this);
    this.waves = this.buildEncounterWaves();

    // Build the battlefield interface, register the combat log, and start the first wave.
    this.cameras.main.setBackgroundColor('#09080a');
    this.createHeader(width);
    this.createArena(width, height);
    this.partyLeaderTap = new PartyLeaderTapCombat(this);
    this.createParty();

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    this.combatLog = new CombatLog(GameState.currentDelve?.name ?? 'The Delve', this.partyUnits);
    this.combatLog.backgroundProgress = this.game.backgroundProgress;
    this.combatLog.setSimulationClock(() => this.time.now);
    this.combatLog.attachDiagnostics(this);
    this.combatLog.onEntry = entry => recordIdleEvent(this, entry);
    this.createArenaInteraction();
    this.createTacticsMenus(width, height);
    this.encounterPanel = createCombatEncounterPanel(this);
    this.createLeaderLoadoutBar(width);

    this.createHud(width, height);

    // Math.max chooses the largest value; pairing it with Math.min can keep a result
    // inside both a lower and an upper bound.
    // Abyss guardian waves also carry boss mechanics. Camp progression must aim at the
    // last boss, the Sovereign, rather than stopping at the first guardian stage.
    this.bossWaveIndex = Math.max(0, this.waves.findLastIndex((wave) => wave.boss));
    this.createFarmControls();
    void prepareDeathNotifications();

    if (GameState.activeBattle) {

      // The old Abyss portal had no checkpoints. Keep its reached wave on upgrade,
      // then remap earned farm/boss entries if another Delve gained more waves.
      const legacy = legacyPortalCheckpoint(GameState.activeBattle, GameState.currentDelve, this.bossWaveIndex);
      if (legacy && !GameState.delveCheckpoints[GameState.currentDelve.id]) {
        GameState.delveCheckpoints[GameState.currentDelve.id] = legacy;
      }
      GameState.activeBattle = migrateEncounterSnapshot(GameState.activeBattle, GameState.currentDelve,
        this.bossWaveIndex, getDelveCheckpoint(GameState.currentDelve, this.bossWaveIndex));
    }

    if (GameState.activeBattle?.scene.currentWaveIndex >= this.waves.length) GameState.activeBattle = null;
    if (GameState.activeBattle) {
      this.restoringBattle = true;

      // This queues a callback after the current synchronous code finishes and before the
      // next normal event task. It lets related changes finish before we save their
      // combined result.
      queueMicrotask(() => {
        restoreBattle(this, GameState.activeBattle);
        this.restoringBattle = false;
        installBattlePersistence(this);
        this.onForeground();
      });
      hideLoadingScreenAfterRender(this);

      return;
    }

    const checkpoint = getDelveCheckpoint(GameState.currentDelve, this.bossWaveIndex);
    const entry = GameState.run.entry;
    if (entry === 'camp' && checkpoint?.campUnlocked) this.showDelveCamp();
    else this.startWave(entry === 'boss' ? this.bossWaveIndex
      : entry === 'farm' ? delveFarmWaveIndex(GameState.currentDelve, this.bossWaveIndex) : checkpoint?.nextWave ?? 0);
    installBattlePersistence(this);
    hideLoadingScreenAfterRender(this);
  }


  // This helper adds a developer button for authoring blocked battlefield terrain.
  createTerrainEditorButton(width) {
    if (!GameState.development.toolsVisible) return;

    this.terrainEditor = new BattlefieldTerrainEditor(this, this.battlefield, this.terrain);

    // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
    // lower-depth objects. This gives the display object an input hit area. Visible
    // artwork alone does not make an object respond to a tap.
    this.terrainEditorButton = this.add.rectangle(155, 790, 220, 48, 0x292524)
      .setStrokeStyle(2, 0xfacc15).setInteractive({ useHandCursor: true }).setDepth(11000);

    // Origin is the anchor within the object: 0 is the left/top edge, 0.5 is the center
    // and 1 is the right/bottom edge. x/y place that anchor, not necessarily the object's
    // corner.
    this.terrainEditorButtonLabel = this.add.text(155, 790, 'EDIT TERRAIN', {
      fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('compact22'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#facc15'
    }).setOrigin(0.5).setDepth(11001);

    // on registers a callback for later events; it does not call that callback now.
    // Long-lived emitters need matching listener cleanup.
    this.terrainEditorButton.on('pointerdown', (pointer, localX, localY, event) => {

      // ?. only follows this link when the value exists; a missing optional value gives
      // undefined.
      event?.stopPropagation?.();
      this.terrainEditor.open();
    });
  }

  // This helper chooses the encounter waves and adds the depth milestone guardian.
  buildEncounterWaves() {

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    const waves = createEncounterWaves(GameState.currentDelve ?? {}, this.battlefield.logicalWidth);

    if (GameState.currentDelve) GameState.currentDelve.rooms = waves.length;
    return waves;
  }

  // This helper shows the delve title, tactical guidance, and encounter status.
  createHeader(width) {
    combatPanel(this, width / 2, 48, width, 96, 4500);

    this.encounterStatusText = combatText(this, 174, 32, '', 30, 4501);
    this.encounterTimerText = combatText(this, 174, 68, '', 28, 4501, { color: STONE.muted });
    this.delveTitleText = combatText(this, width / 2, 30, GameState.currentDelve?.name ?? 'The Delve', 36, 4501);
    if (this.delveTitleText.width > width - 1400) this.delveTitleText.setScale((width - 1400) / this.delveTitleText.width);
    this.waveTitleText = combatText(this, width / 2, 68, '', 27, 4501, { color: STONE.muted });
    const hintWidth = width - 800;
    this.battleMessageText = combatText(this, width / 2, this.battleLayout.messageY, '', 28, 5000,
      { wordWrap: { width: hintWidth - 48 }, align: 'center' });
    this.battleMessagePlaque = combatPanel(this, width / 2, this.battleLayout.messageY, hintWidth, 64, 4999).setVisible(false);

    this.battleMessageFade = null;

    // Keep recent player actions together in one readable place above the battlefield.
    this.createCombatAnnounceLog(width);
  }

  // This helper creates the compact combat feed in the upper-right arena corner.
  createCombatAnnounceLog(width) {

    this.combatAnnounceEntries = [];
    this.lastCombatAnnounceAt = -Infinity;
    this.combatAnnouncePanel = null;

    // Temporarily hide the on-screen feed while retaining the combat recording system.
    const showCombatFeed = false;
    if (!showCombatFeed) return;

    // Keep the transient action feed clear of the encounter panel and tactics row.
    const panelWidth = 590;
    const panelHeight = 130;
    const commandRailLeft = width - 356;
    const x = commandRailLeft - panelWidth / 2 - 16;
    const y = 270;
    this.combatAnnounceEntries = [];
    this.lastCombatAnnounceAt = -Infinity;
    this.combatAnnouncePanel = this.add.rectangle(x, y, panelWidth, panelHeight, 0x080d18, 0.78)
      .setStrokeStyle(2, 0x748093, 0.7).setDepth(4450);
  }

  // This helper adds an announce and keeps the newest three entries at the top.
  addCombatAnnounce(text, color = '#fbbf24', styledText = null) {

    // Replay has no live presentation, and can process many past events at once.
    if (this.game.backgroundProgress?.isReplaying || !this.combatAnnouncePanel) return;

    // Phaser Text accepts plain strings, so separate text objects supply the colored
    // parts. One container keeps their positions, opacity and cleanup together.
    const label = this.add.container(this.combatAnnouncePanel.x - 270, 230).setDepth(4451);
    const parts = styledText ?? [{ text, style: { color } }];
    const spans = parts.map(part => {
      const span = this.add.text(0, 0, part.text, {
        fontFamily: UI_FONT_FAMILIES.sans,
        fontSize: fontPx('body30'),
        fontStyle: UI_FONT_WEIGHTS.bold,
        color: part.style.color,
        stroke: '#000000',
        strokeThickness: 3
      }).setOrigin(0, 0.5);
      label.add(span);
      return { span, abbreviate: part.abbreviate ?? !styledText };
    });

    // Measure rendered pixels, including the font's stroke, rather than guessing from
    // character counts. Keep 25 pixels of breathing room inside each side of the panel.
    const availableWidth = this.combatAnnouncePanel.width - 50;
    const messageWidth = () => spans.reduce((sum, item) => sum + item.span.width, 0);
    while (messageWidth() > availableWidth) {
      const candidates = spans.filter(item => item.abbreviate
        && item.span.text.replace(/…$/, '').length > 1);
      if (!candidates.length) break;

      // Shorten the widest name or ability first, leaving connecting words readable.
      const widest = candidates.reduce((best, item) => item.span.width > best.span.width ? item : best);
      const original = widest.span.text.replace(/…$/, '');
      widest.span.setText(`${original.slice(0, -1).trimEnd()}…`);
    }

    let textX = 0;
    spans.forEach(({ span }) => {
      span.setX(textX);
      textX += span.width;
    });
    this.lastCombatAnnounceAt = this.time.now;
    this.combatAnnouncePanel.setAlpha(1);
    const entry = { label, createdAt: this.time.now, fadeStartedAt: null };
    this.combatAnnounceEntries.unshift(entry);

    // Discard the oldest row so this small display never grows beyond three entries.
    if (this.combatAnnounceEntries.length > 3) this.combatAnnounceEntries.pop().label.destroy();

    this.combatAnnounceEntries.forEach((current, index) => current.label.setY(230 + index * 35));
  }

  // This helper expires announces on combat time, which stops while the battle is paused.
  updateCombatAnnounceLog(time) {

    // The entire feed fades after two quiet combat seconds. A new message restores it.
    const quietAlpha = 1 - Math.min(1, Math.max(0, time - this.lastCombatAnnounceAt - 2000) / 600);
    this.combatAnnouncePanel?.setAlpha(quietAlpha);
    for (let index = (this.combatAnnounceEntries?.length ?? 0) - 1; index >= 0; index -= 1) {
      const entry = this.combatAnnounceEntries[index];
      if (entry.fadeStartedAt === null && time - entry.createdAt >= 3000) {
        entry.fadeStartedAt = time;
      }

      // The normal age fade is brief, so a quiet log clears one entry at a time.
      const fadeProgress = entry.fadeStartedAt === null
        ? 0 : Math.min(1, (time - entry.fadeStartedAt) / 260);
      const stackAlpha = 1 - index * 0.1125;
      entry.label.setAlpha(quietAlpha * stackAlpha * (1 - fadeProgress));

      if (fadeProgress >= 1) {
        entry.label.destroy();
        this.combatAnnounceEntries.splice(index, 1);
      }
    }

    // Remove entries from the end first so deleting one never skips its neighbor.
    this.combatAnnounceEntries?.forEach((entry, index) => entry.label.setY(230 + index * 35));
  }

  // This helper quickly fades the whole combat feed when a wave ends.
  fadeCombatAnnounceLog() {
    const now = this.time.now;
    this.combatAnnounceEntries?.forEach(entry => { entry.fadeStartedAt = now; });
  }

  // This helper draws the battlefield beneath its units and tactical controls.
  createArena(width, height) {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    const environment = GameState.currentDelve?.visuals?.environment;
    if (environment) {
      this.battlefieldVisualLayers = createEnvironment(this, environment);
      this.battlefield.drawArenaBorder(GameState.development.showArenaBorder !== false);
      return;
    }
    const background = GameState.currentDelve?.visuals?.battlefieldBackground;

    let staticBackground = null;
    if (background?.key && this.textures.exists(background.key)) {

      // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
      // lower-depth objects.
      staticBackground = this.add.image(width / 2, height / 2, background.key).setDepth(-1000);

      // Cover the complete game viewport without stretching the artwork.
      const scale = Math.max(width / staticBackground.width, height / staticBackground.height);
      staticBackground.setScale(scale);
    }

    // Future cave water, fog, scenery, and ambient effects can be inserted here: above the
    // static backdrop but below combat units and HUD layers.
    this.battlefieldVisualLayers = {
      staticBackground,
      scenery: this.add.container(0, 0).setDepth(90)
    };
    this.battlefield.drawArenaBorder(GameState.development.showArenaBorder !== false);
  }


  // This helper brings the chosen adventurers into combat and binds unit selection.
  createParty() {

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    const party = (GameState.activeParty.length > 0
      ? GameState.activeParty
      : GameState.roster.slice(0, 5)).filter(hero => GameState.recruitedIds.includes(hero.id));

    // map builds one output entry for each input entry, in the same order. The callback's
    // return value becomes that output entry.
    this.partyUnits = party.map((adventurer) => {

      // ?? uses the fallback only for null or undefined. A real zero or false stays
      // intact. find returns the first matching entry, or undefined when none matches.
      // Check for that missing result before using its fields.
      const hero = getEquippedAdventurer(GameState.roster.find((entry) => entry.id === adventurer.id) ?? adventurer);

      // ... copies the source's own fields into this object; fields listed later replace
      // earlier ones. This is a shallow copy, so nested objects are still shared.
      return new BattleUnit(this, {
        ...hero,
        abilities: battleAbilities(hero),
        battlefield: this.battlefield,
        arenaX: this.battlefield.logicalWidth / 2 - 200,
        arenaY: 110,
        isEnemy: false
      });
    });

    this.tactics.registerParty(this.partyUnits);
    this.partyUnits.forEach((unit, index) => {

      const spawn = this.tactics.getSpawnPosition(unit, index);
      unit.setArenaPosition(spawn.x, spawn.y);
      this.movement.validateUnitPosition(unit);
      this.waveReturnPositions.set(unit.id, { x: unit.arenaX, y: unit.arenaY });
    });

    this.partyUnits.forEach((unit) => {

      // This gives the display object an input hit area. Visible artwork alone does not
      // make an object respond to a tap.
      unit.hitZone.setInteractive({ useHandCursor: true });
      unit.hitZone.setName('battle-party-' + unit.id);

      // on registers a callback for later events; it does not call that callback now.
      // Long-lived emitters need matching listener cleanup.
      unit.hitZone.on('pointerdown', (pointer, localX, localY, event) => {

        // ?. only follows this link when the value exists; a missing optional value gives
        // undefined.
        event?.stopPropagation?.();
        // Temporarily reserve ally taps for explicit commands, so missed monster
        // taps cannot select an adventurer or redirect a selected ally to assist.
        if (this.commandMode) this.toggleUnitSelection(unit);
        else this.partyLeaderTap.tap(pointer);
      });

      bindSelectionDetails(this, unit.hitZone, () => characterDetails(unit));
      this.partyLeaderTap.bindSurface(unit.hitZone);
    });

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    // find returns the first matching entry, or undefined when none matches. Check for
    // that missing result before using its fields.
    this.tank = this.partyUnits.find((unit) => unit.role === 'Tank') ?? this.partyUnits[0];
    this.healer = this.partyUnits.find((unit) => unit.role === 'Healer');
  }

  // Compact left-side cards retain portrait details, resource updates and potion access.
  createHud() {
    createCombatPartyRoster(this);
  }

  // Card taps change selection only; battlefield ally taps retain their assist orders.
  selectRosterUnit(unit) {
    if (this.commandMode === 'REVIVE') {
      this.toggleUnitSelection(unit);
      return;
    }
    if (!unit.alive || this.battleOver) return;
    if (this.selectedUnitIds.has(unit.id)) this.selectedUnitIds.delete(unit.id);
    else this.selectedUnitIds = new Set([unit.id]);
    this.commandMode = null;
    this.setTargetingInputState(false);
    emitGameplay(this, 'selection.changed', { selection: 'character', subjectIds: [...this.selectedUnitIds] }, PLAYER_SOURCE);
    this.radialHud?.selectionChanged();
    this.refreshTacticsMenus();
    this.clearBattleMessage();
    HapticsService.tap();
  }

  // Battlefield taps retain their exact position rather than snapping to cells.
  createArenaInteraction() {

    // This gives the display object an input hit area. Visible artwork alone does not make
    // an object respond to a tap. Depth is drawing order, not distance or size.
    // Higher-depth objects draw on top of lower-depth objects.
    const hit = this.add.zone(this.scale.width / 2, this.scale.height / 2,
      this.scale.width, this.scale.height).setDepth(30).setName('battle-arena').setInteractive();
    this.partyLeaderTap.bindSurface(hit, true);

    // on registers a callback for later events; it does not call that callback now.
    // Long-lived emitters need matching listener cleanup.
    hit.on('pointerdown', pointer => {
      if (this.battleOver || (this.waveTransitioning && !this.combatPaused)) return;
      if (this.radialHud?.openMenu) {
        this.radialHud.close();
        this.partyLeaderTap.cancel();
        return;
      }
      if (!this.commandMode && !this.getSelectedUnits().length) return;
      const point = this.battlefield.screenToArena(pointer.worldX, pointer.worldY);
      if (point && !this.terrain.isBlocked(point.x, point.y)) this.handleArenaTap(point);
    });
  }

  // Floating thumb controls leave the battlefield visible between individual buttons.
  createTacticsMenus(width, height) {
    this.roleButtons = [];
    this.commandButtons = [];
    this.leaderOrderPlan = new LeaderOrderPlan(this);
    this.radialHud = new CombatRadials(this);
    this.tacticalPlanOverlay = createTacticalPlanOverlay(this);
    this.pauseMenu = createCombatPauseMenu(this);
    this.pauseButton = combatButton(this, width - 142, 48, 260, 84, 9000).setName('battle-pause');
    const pauseIcon = stoneIcon(this, width - 234, 48, 'PAUSE', 32, 9002);
    this.pauseButtonText = combatText(this, width - 118, 48, 'PAUSE', 30, 9002);
    bindButtonPress(this, this.pauseButton, [this.pauseButtonText, pauseIcon], () => this.togglePause());
    this.refreshTacticsMenus();
  }

  // Cancellation queues a return to camp without ending or resetting the current fight.
  createFarmControls() {
    this.farmCancelButton = combatButton(this, 500, 48, 310, 84, 4600, 0x50432e);
    this.farmCancelText = combatText(this, 500, 48, '', UI_FONT_SIZES.support28, 4602, { align: 'center' });
    bindButtonPress(this, this.farmCancelButton, [this.farmCancelText], () => this.confirmFarmStop());
    this.refreshFarmControls();
  }

  // Ask to stop farming without skipping the current wave or losing its banked reward.
  requestFarmStop() {
    if (!isOrdinaryDelve() || GameState.run.entry !== 'farm' || this.battleOver || this.farmStopRequested) return false;
    this.farmStopRequested = true;
    this.refreshFarmControls();
    HapticsService.tap();

    return true;
  }

  // Queue the confirmed farm cancellation and restore the proper pause state.
  confirmFarmStop() {
    if (!isOrdinaryDelve() || GameState.run.entry !== 'farm' || this.battleOver || this.farmStopRequested) return;
    showConfirmation(this, {
      title: 'Stop Farm?',
      description: 'Finish the current combat, collect its rewards, and return to camp?',
      confirmLabel: 'STOP FARMING',

      // Run the committed action after the player confirms this decision.
      onConfirm: () => this.requestFarmStop()
    });
  }

  // Confirm retreat while preserving the previous pause state on dismissal.
  confirmRetreat() {
    if (this.battleOver) return;

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    showConfirmation(this, {
      title: 'Retreat?',
      description: isOrdinaryDelve()
        ? 'Leave this combat? Cleared wave rewards stay banked.'
        : 'Leave this combat? This encounter resets and its rewards are lost.',
      confirmLabel: 'RETREAT',

      // Run the committed action after the player confirms this decision.
      onConfirm: () => this.fleeBattle()
    });
  }

  // Match the visible cancel label to farm mode and the pending stop request.
  refreshFarmControls() {
    const farming = isOrdinaryDelve() && GameState.run.entry === 'farm' && !this.battleOver;

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    this.farmCancelButton?.setVisible(farming);

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    this.farmCancelText?.setVisible(farming).setText(this.farmStopRequested
      ? 'STOPPING FARM\nAfter this wave' : 'STOP FARM\nAfter this wave');
    if (this.farmCancelButton?.input) this.farmCancelButton.input.enabled = farming && !this.farmStopRequested;
    this.terrainEditorButton?.setVisible(!farming);
    this.terrainEditorButtonLabel?.setVisible(!farming);
  }

  // This helper exposes the equipped leadership abilities above the arena.
  createLeaderLoadoutBar(width) {

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    const equipped = (GameState.leader?.battleLoadout ?? []).slice(0, 5);
    const hud = combatHudLayout(this);
    const count = Math.max(1, equipped.length);
    const buttonWidth = Math.min(290, (hud.right - hud.left - 12 * (count - 1)) / count);
    const total = count * buttonWidth + 12 * (count - 1);
    const layout = { buttonY: hud.tacticsY, buttonHeight: hud.tacticsHeight, buttonWidth,
      positions: Array.from({ length: count }, (_, index) =>
        (hud.left + hud.right - total) / 2 + buttonWidth / 2 + index * (buttonWidth + 12)) };
    this.leaderButtons = [];

    // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
    // lower-depth objects. Origin is the anchor within the object: 0 is the left/top edge,
    // 0.5 is the center and 1 is the right/bottom edge. x/y place that anchor, not
    // necessarily the object's corner.
    // Keep one centered line inside the carved border. Reserve a separate right
    // slot for readiness or cooldown so status text cannot crowd the ability name.
    equipped.forEach((id, index) => {

      // find returns the first matching entry, or undefined when none matches. Check for
      // that missing result before using its fields.
      const ability = leaderAbilities.find((entry) => entry.id === id);
      if (!ability) return;
      const x = layout.positions[index];
      const box = combatButton(this, x, layout.buttonY, layout.buttonWidth, layout.buttonHeight, 4700);

      // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
      // lower-depth objects. Origin is the anchor within the object: 0 is the left/top
      // edge, 0.5 is the center and 1 is the right/bottom edge. x/y place that anchor, not
      // necessarily the object's corner.
      const inset = 32;
      const statusWidth = 66;
      const statusX = x + layout.buttonWidth / 2 - inset - statusWidth / 2;
      const nameWidth = layout.buttonWidth - inset * 2 - statusWidth - 12;
      const name = this.add.text(x - layout.buttonWidth / 2 + inset, layout.buttonY, ability.shortName, {
        fontFamily: UI_FONT_FAMILIES.serif, fontSize: fontPx('body32'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#ffda8b'
      }).setOrigin(0, 0.5).setDepth(4701);
      name.setScale(Math.min(1, nameWidth / name.width, (layout.buttonHeight - 40) / name.height));
      const status = this.add.text(statusX, layout.buttonY, '', {
        fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('compact25'), color: '#d6d3d1'
      }).setOrigin(0.5).setDepth(4701);
      const readyIcon = this.add.graphics().setPosition(statusX, layout.buttonY).setDepth(4701);
      readyIcon.lineStyle(2, 0xe8bf70, 0.85).strokeCircle(0, 0, 13);
      readyIcon.lineStyle(3, 0xbfe0a4, 1).beginPath().moveTo(-7, 0).lineTo(-2, 5).lineTo(8, -6).strokePath();
      bindSelectionDetails(this, box, () => ({ title: ability.name,
        description: leaderAbilityDescription(ability, this.partyUnits) }), () => this.useLeaderAbility(id));

      bindButtonPress(this, box, [name, status, readyIcon]);
      this.leaderButtons.push({ ability, box, status, readyIcon, statusWidth });
    });

    this.updateLeaderLoadoutBar();
  }

  // This helper shows readiness, remaining cooldown, and spent one-use tactics without
  // placing extra labels outside their button boundaries.
  updateLeaderLoadoutBar() {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    this.leaderButtons?.forEach(({ ability, box, status, readyIcon, statusWidth }) => {

      const used = ability.oncePerEncounter && this.usedLeaderAbilities.has(ability.id);

      // ?. only follows this link when the value exists; a missing optional value gives
      // undefined.
      const queued = this.pendingPausedTactics?.some(entry => (entry.id ?? entry) === ability.id);

      // Math.max chooses the largest value; pairing it with Math.min can keep a result
      // inside both a lower and an upper bound. ?? uses the fallback only for null or
      // undefined. A real zero or false stays intact.
      const remaining = Math.max(0, (ability.cooldown ?? 0) - (this.time.now - (this.leaderAbilityCooldowns.get(ability.id) ?? -Infinity)));

      // The condition before ? chooses the first value when true and the value after :
      // when false. Math.ceil rounds upward to the next integer, including when the value
      // has a fractional part.
      const ready = !queued && !used && remaining <= 0;
      readyIcon.setVisible(ready);
      status.setVisible(!ready).setText(queued ? 'QUEUED' : used ? 'USED' : remaining > 0 ? Math.ceil(remaining / 1000) + 's' : '').setScale(1);
      if (status.width > statusWidth) status.setScale(statusWidth / status.width);
      box.setFillStyle(queued || used || remaining > 0 ? 0x1c1917 : 0x292524);
    });
  }

  // This helper selects a tapped adventurer or deselects it on a second tap.
  toggleUnitSelection(unit) {
    if (this.combatPaused && this.commandMode !== 'REVIVE') {
      this.selectRosterUnit(unit);
      return;
    }


    // A character tap anchors the whole party's Spread around that ally.
    if (unit?.alive && this.commandMode === 'SPREAD') {
      this.selectedUnitIds = new Set(this.partyUnits.filter(ally => ally.alive).map(ally => ally.id));
      this.handleArenaTap({ x: unit.arenaX, y: unit.arenaY }, unit);
      return;
    }

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    if (!unit?.alive && this.commandMode !== 'REVIVE') return;

    if (this.commandMode === 'REVIVE' && !unit.alive) {

      if (this.battleOver || this.waveTransitioning || unit.delvesUsed?.honorSacrifice) return;

      // Targeted tactics store the chosen ID while paused; revival happens on Resume.
      if (this.combatPaused) {
        this.queuePausedTactic('revive', unit.id);
        this.commandMode = null;
        return;
      }

      // find returns the first matching entry, or undefined when none matches. Check for
      // that missing result before using its fields.
      const ability = leaderAbilities.find(entry => entry.id === 'revive');
      if (!this.commitTargetedTactic('revive')) return;
      const order = requestOrder(this, 'TACTIC:revive', [unit], { targetId: unit.id });
      acceptOrder(this, order);
      unit.revive(ability.healthFraction, ability.manaFraction);
      emitGameplay(this, 'combat.order.executed', { ...order, phase: 'effect' }, PLAYER_SOURCE);
      this.commandMode = null;
      this.updateHud();
      this.showBattleMessage(`REVIVE! - ${unit.name} restored`, '#fde68a');

      this.refreshTacticsMenus();
      this.updateLeaderLoadoutBar();
      return;
    }

    if (this.assignAllyTarget(unit)) return;

    if (this.selectedUnitIds.has(unit.id)) {
      this.selectedUnitIds.delete(unit.id);
      this.commandMode = null;
      this.refreshTacticsMenus();
      this.setTargetingInputState(false);

      const remaining = this.getSelectedUnits();
      if (remaining.length === 0) {
        this.clearBattleMessage();
      } else {
        this.showBattleMessage(`${remaining.length} selected - tap ground to move, an ally to assist, or an enemy to attack`, '#93c5fd', true);
      }
    } else {

      // A Set keeps each value once. has checks membership without searching a list for
      // duplicate entries.
      this.selectedUnitIds = new Set([unit.id]);
      this.commandMode = null;
      this.refreshTacticsMenus();
      this.setTargetingInputState(false);
      this.showBattleMessage(`${unit.name} - tap ground to move, an ally to assist, or an enemy to attack`, '#93c5fd', true);
    }

    emitGameplay(this, 'selection.changed', { selection: 'character', subjectIds: [...this.selectedUnitIds] }, PLAYER_SOURCE);
    HapticsService.tap();
  }

  // Ally taps command the existing selection, including mixed role groups.
  assignAllyTarget(target) {
    const selected = this.getSelectedUnits();

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    if (!target?.alive || selected.length === 0 || (selected.length === 1 && selected[0] === target)) return false;

    // filter keeps entries whose callback returns true. It builds a new list and leaves
    // the original list in place.
    if (this.combatPaused) return this.leaderOrderPlan.prepare('ASSIST', { target });

    const order = requestOrder(this, 'ASSIST', selected, { targetId: target.id });
    acceptOrder(this, order);
    const movers = selected.filter((unit) => unit !== target);
    const positions = this.movement.getFormationPositions(movers, { x: target.arenaX, y: target.arenaY });

    // ??= fills a missing value once. It leaves an existing value, including zero or
    // false, alone. A Map pairs a key with a value. Unlike an array index, the key can be
    // an ID or an object; get/set read and write that same key.
    this.healerPriorityTargets ??= new Map();
    selected.forEach((unit) => {

      // The condition before ? chooses the first value when true and the value after :
      // when false.
      const raw = unit === target ? { x: target.arenaX, y: target.arenaY } : positions[movers.indexOf(unit)];
      const point = this.terrain.nearestSafeUnitPoint(unit, raw.x, raw.y, combatSpacing.terrainFootRadius);
      unit.spacingMode = 'normal';
      executeOrder(this, order, unit);
      unit.finishAction('cancelled', 'movement_cancelled', 'Leader ally regroup order', { cause: { ...PLAYER_SOURCE, commandId: order.commandId } });
      this.attackTargets.delete(unit.id);
      this.healerPriorityTargets.delete(unit.id);

      if (unit.role === 'Healer') {
        this.heldUnitIds.delete(unit.id);
        if (target.hp < target.maxHp) {
          this.healerPriorityTargets.set(unit.id, target.id);
          this.manualTargets.delete(unit.id);
        } else this.manualTargets.set(unit.id, point);
      } else {
        this.manualTargets.set(unit.id, point);
        this.heldUnitIds.add(unit.id);
      }
      if (this.manualTargets.has(unit.id)) assignMovement(this, unit, point, order);
    });

    this.commandMode = null;
    this.setTargetingInputState(false);
    this.refreshTacticsMenus();

    // The condition before ? chooses the first value when true and the value after : when
    // false. some stops with true as soon as one entry passes the check; an empty list
    // gives false.
    this.showBattleMessage(`Move to ${target.name}${movers.some(unit => unit.role === 'Healer') ? ' / heal if injured' : ''}`, '#86efac', true);
    this.completePartyCommand('ASSIST');
    HapticsService.confirm();
    return true;
  }

  // Healing priorities are encounter-only and end automatically when their target is full
  // health, defeated, or no longer in the party.
  // Candidate comparisons may inspect the order without clearing or changing it.
  getHealerPriorityTarget(healer, remember = true) {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    const targetId = this.healerPriorityTargets?.get(healer.id);

    // find returns the first matching entry, or undefined when none matches. Check for
    // that missing result before using its fields.
    const target = this.partyUnits.find((unit) => unit.id === targetId && unit.alive);
    if (!target || target.hp >= target.maxHp || this.heldUnitIds.has(healer.id)
      || this.attackTargets.has(healer.id) || this.manualTargets.has(healer.id)) {
      if (remember) this.healerPriorityTargets?.delete(healer.id);
      return null;
    }

    return target;
  }

  // This helper selects a role or the whole living party for a shared command.
  selectRole(role) {

    // filter keeps entries whose callback returns true. It builds a new list and leaves
    // the original list in place.
    const matching = this.partyUnits.filter((unit) => unit.alive
      && (role === 'All' || unit.role === role || unit.role === `${role} DPS`));

    this.selectedUnitIds = new Set(matching.map((unit) => unit.id));
    this.commandMode = null;
    this.setTargetingInputState(false);

    emitGameplay(this, 'selection.changed', { selection: 'role', role, subjectIds: matching.map(u => u.id) }, PLAYER_SOURCE);
    this.radialHud?.selectionChanged(role === 'Healer' ? 'Healers' : role);
    if (!matching.length) this.showBattleMessage(`No living ${role}`, '#fca5a5');
    else this.clearBattleMessage();

    this.refreshTacticsMenus();
    HapticsService.tap();
  }

  // This helper restricts commands to selected adventurers who are still alive.
  getSelectedUnits() {

    // filter keeps entries whose callback returns true. It builds a new list and leaves
    // the original list in place.
    return this.partyUnits.filter((unit) => unit.alive && this.selectedUnitIds.has(unit.id));
  }

  // Release the recipients only after an order has been accepted, including pause plans.
  completePartyCommand(action) {
    this.selectedUnitIds = new Set();
    this.radialHud?.selectionChanged();
    this.radialHud?.completed(action);
    this.refreshPartySelection();
  }

  // This helper checks whether a player order should prevent automatic repositioning.
  isPositionLocked(unit) {

    return this.heldUnitIds.has(unit.id);
  }

  // This helper prepares an order for targeting or applies Hold to the current selection.
  armCommand(label) {

    if (label === 'INTERRUPT' && this.interruptCooldownRemainingMs > 0) {
      rejectOrder(this, requestOrder(this, label), 'interrupt_cooldown');
      this.showInterruptCooldown();
      return;
    }

    const selected = this.getSelectedUnits();
    if (this.battleOver) return;
    const needsSelection = ['MOVE', 'HOLD', 'SPREAD', 'STACK', 'ATTACK'].includes(label);

    // A second press cancels a target-selection mode before it can affect the party. This
    // is particularly useful for an accidentally armed Attack.
    if (this.commandMode === label) {
      this.commandMode = null;
      this.setTargetingInputState(false);
      this.refreshTacticsMenus();
      this.showBattleMessage(`${label} canceled`, '#a8a29e');
      HapticsService.tap();

      return;
    }

    // Reject movement and formation commands until the player chooses units or a role.
    if (needsSelection && selected.length === 0) {
      rejectOrder(this, requestOrder(this, label), 'no_selected_actors');
      this.showBattleMessage('SELECT AN ADVENTURER OR ROLE FIRST', '#fca5a5', true);
      HapticsService.tap();
      return;
    }

    // Between waves the party still returns to its home positions. Arm Hold now, then
    // use the normal command path when the next wave begins so the return stays intact.
    if (label === 'HOLD' && this.combatPaused) {
      this.leaderOrderPlan.prepare('HOLD');
      return;
    }
    if (label === 'HOLD' && this.waveTransitioning) {
      this.commandMode = 'HOLD';
      this.setTargetingInputState(false);
      this.refreshTacticsMenus();
      this.showBattleMessage('HOLD READY - applies when the next wave starts', '#93c5fd', true);
      HapticsService.tap();
      return;
    }

    // Hold confirms a destination already assigned by Move, or holds the current position.
    // Other commands wait for a target tap.
    if (label === 'HOLD') {
      const order = requestOrder(this, label, selected);
      acceptOrder(this, order);
      this.combatLog?.diagnostics?.command('HOLD', selected);

      // Confirm the same order for each selected adventurer.
      selected.forEach((unit) => {
        executeOrder(this, order, unit, { preserveMovement: this.manualTargets.has(unit.id) });

        // Keep a pending Move destination. Hold confirms the order rather than toggling it off.
        if (!this.manualTargets.has(unit.id)) {
          this.manualTargets.set(unit.id, { x: unit.arenaX, y: unit.arenaY });
        }
        this.attackTargets.delete(unit.id);
        unit.finishAction('cancelled', 'movement_cancelled', 'Leader Hold order', { cause: { ...PLAYER_SOURCE, commandId: order.commandId } });
        this.heldUnitIds.add(unit.id);
      });
      this.commandMode = null;

      this.refreshTacticsMenus();
      this.showBattleMessage('HOLD ORDER SET', '#93c5fd');
      this.completePartyCommand('HOLD');
      this.setTargetingInputState(false);
      HapticsService.tap();

      return;
    }

    // Attack is a persistent order after an enemy is chosen. Pressing it again with that
    // same group selected releases a mistaken attack target.
    if (!this.combatPaused && label === 'ATTACK' && selected.some((unit) => this.attackTargets.has(unit.id))) {
      selected.forEach((unit) => {
        if (unit.leaderCommand) cancelOrder(this, unit.leaderCommand, 'released', [unit.id]);
        unit.leaderCommand = null;
        this.attackTargets.delete(unit.id);
      });
      this.commandMode = null;
      this.setTargetingInputState(false);
      this.refreshTacticsMenus();
      this.showBattleMessage('ATTACK ORDER CANCELED', '#a8a29e');
      HapticsService.tap();

      return;
    }

    this.commandMode = label;
    this.setTargetingInputState(['ATTACK', 'FOCUS', 'INTERRUPT'].includes(label));
    this.refreshTacticsMenus();

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    const prompt = this.waveTransitioning
      ? `${label} READY - choose a target when the next wave starts`
      : label === 'ATTACK' ? 'FOCUS - tap an enemy for selected adventurers'
      : label === 'INTERRUPT' ? 'INTERRUPT - tap the enemy you want to interrupt'
        : `${label} - tap a destination`;
    this.showBattleMessage(prompt, '#fbbf24', true);
    HapticsService.tap();
  }

  // This helper routes taps to enemies when an order needs an enemy target.
  setTargetingInputState(targetingEnemies) {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    this.partyUnits?.forEach((unit) => {

      if (targetingEnemies) unit.hitZone.disableInteractive();
      else if (unit.alive) unit.hitZone.setInteractive({ useHandCursor: true });
    });

    this.enemies?.forEach((enemy) => {

      if (!enemy.alive || enemy.landing) return;

      // Keep enemy inspection available even before allies are selected.
      enemy.hitZone.setInteractive({ useHandCursor: true });
    });
  }

  // This helper shows the selected units and the currently armed order.
  refreshTacticsMenus() {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    this.roleButtons?.forEach(({box,role})=>{

      // ?? uses the fallback only for null or undefined. A real zero or false stays
      // intact. ?. only follows this link when the value exists; a missing optional value
      // gives undefined. filter keeps entries whose callback returns true. It builds a new
      // list and leaves the original list in place.
      const living = this.partyUnits?.filter((unit) => unit.alive) ?? [];

      // The condition before ? chooses the first value when true and the value after :
      // when false. every requires all entries to pass the check; an empty list gives
      // true. some stops with true as soon as one entry passes the check; an empty list
      // gives false.
      const selected = role === 'All'
        ? living.length > 0 && living.every((unit) => this.selectedUnitIds.has(unit.id))
        : living.some((unit) => (unit.role === role || unit.role === `${role} DPS`) && this.selectedUnitIds.has(unit.id));
      box.setFillStyle(selected?0x243b53:0x1f2937).setStrokeStyle(3,selected?STONE.gold:STONE.edge);
    });

    this.commandButtons?.forEach(({box,label})=>{

      const active=this.commandMode===label;

      // The condition before ? chooses the first value when true and the value after :
      // when false.
      box.setFillStyle(active?0x3b321d:0x1f2937).setStrokeStyle(3,active?STONE.gold:STONE.edge);
    });

    this.roleSummaryText?.setText(this.getSelectedUnits().length
      ? `${this.getSelectedUnits().length} SELECTED  ›` : 'SELECT UNITS  ›');
    this.refreshInterruptControl();
    this.refreshPartySelection();
  }

  showInterruptCooldown() {
    playUiSound(this, 'failure');
    HapticsService.tap();
    showFeatureToast(this, `Interrupt is ready in ${Math.ceil(this.interruptCooldownRemainingMs / 1000)} seconds.`, { centered: true });
  }

  // Keep the full caption readable; the countdown shares the icon row inside the button.
  refreshInterruptControl() {
    const control = this.commandButtons?.find(entry => entry.label === 'INTERRUPT');
    if (!control) return;
    const cooling = this.interruptCooldownRemainingMs > 0;
    for (const visual of [...control.box.pressVisuals, control.text, control.icon]) visual.setAlpha(cooling ? 0.45 : 1);
    control.icon.x = control.text.x - (cooling ? 22 : 0);
    control.cooldownText.setVisible(cooling).setText(cooling ? `${Math.ceil(this.interruptCooldownRemainingMs / 1000)}s` : '');
    control.box.uiSound = cooling ? 'failure' : 'click';
  }

  // Refresh card selection, including fallen allies.
  refreshPartySelection() {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    this.partyUnits?.forEach((u) => u.body.setStrokeStyle(
      this.selectedUnitIds.has(u.id) ? 7 : 4,
      this.selectedUnitIds.has(u.id) ? 0x60a5fa : 0x1c1917,
      this.selectedUnitIds.has(u.id) || !u.spriteVisual ? 1 : 0
    ));
    this.partyHud?.forEach(({ unit, cardHighlight }) => {
      const selected = unit.alive && this.selectedUnitIds.has(unit.id);
      const prompted = unit.alive && this.time.now < (this.radialHud?.promptUntil ?? 0);
      cardHighlight.setVisible(selected || prompted).setAlpha(selected ? 1 : 0.6);
    });
  }

  // A slow opacity pulse marks player selections without hiding their names. Advance
  // only during visible combat so pauses and historical catch-up cannot run the pulse.
  updateSelectedNames(delta) {
    for (const unit of [...(this.partyUnits ?? []), ...(this.enemies ?? [])]) {
      if (!unit.label?.active) continue;
      const selected = unit.alive && !unit.landing && (unit.isEnemy
        ? unit.id === this.inspectedEnemyId : this.selectedUnitIds.has(unit.id));
      if (!selected) {
        unit.selectionNameElapsed = 0;
        unit.label.setAlpha(1);
        continue;
      }
      unit.selectionNameElapsed ??= 0;
      if (!this.combatPaused && !this.battleOver) unit.selectionNameElapsed += Math.max(0, delta);

      // One cycle takes 1.4 combat seconds; opacity stays between 70% and 100%.
      unit.label.setAlpha(0.85 + 0.15 * Math.cos(unit.selectionNameElapsed * Math.PI * 2 / 1400));
    }
  }

  // This helper interprets a battlefield tap using the current command. It locates targets
  // for Attack, Focus Fire, and Interrupt, or assigns movement destinations and keeps the
  // selected units under Hold.
  handleArenaTap(center, anchor = null) {

    this.highlightArenaPoint(center);

    // A floor tap with selected units defaults to Move. With no selection, show guidance
    // instead of moving the whole party.
    if (!this.commandMode) {
      if (this.getSelectedUnits().length > 0) {
        this.commandMode = 'MOVE';
      } else {
        this.showBattleMessage('SELECT A UNIT OR ROLE FIRST', '#d6a85f');
        HapticsService.tap();
        return;
      }
    }

    // Find a living enemy near the tapped point for commands that need an enemy target.
    if (['ATTACK', 'FOCUS', 'INTERRUPT', 'COORDINATED_ATTACK', 'LUNAR_ASSAULT'].includes(this.commandMode)) {

      // find returns the first matching entry, or undefined when none matches. Check for
      // that missing result before using its fields.
      const enemy = this.getLivingEnemies().find(candidate =>
        Math.hypot(candidate.arenaX - center.x, candidate.arenaY - center.y) <= 100);

      if (!enemy) {
        this.showBattleMessage('No enemy there - tap the enemy you want', '#fca5a5', true);
        return;
      }

      this.handleEnemyTap(enemy);
      return;
    }

    const units = this.getSelectedUnits();
    const order = requestOrder(this, this.commandMode, units, { destination: center });
    if (units.length === 0) {
      rejectOrder(this, order, 'no_selected_actors');
      this.commandMode = null;
      this.refreshTacticsMenus();
      this.showBattleMessage('SELECT AN ADVENTURER OR ROLE FIRST', '#fca5a5');

      return;
    }

    // A pending non-movement command must never fall through to Move.
    if (!['MOVE', 'SPREAD', 'STACK'].includes(this.commandMode)) {
      rejectOrder(this, order, 'invalid_command_target');
      this.showBattleMessage('Choose a valid command target', '#fca5a5');
      return;
    }
    if (this.combatPaused) {
      this.leaderOrderPlan.prepare(this.commandMode, { point: center, anchorId: anchor?.id, observation: order });
      return;
    }

    acceptOrder(this, order);

    // Place selected units around the tapped point using a wide spread or a tight stack,
    // then hold those positions.
    if (this.commandMode === 'SPREAD' || this.commandMode === 'STACK') {
      const formationMode = this.commandMode;
      this.combatLog?.diagnostics?.command(formationMode, units);
      const mode = formationMode.toLowerCase();
      const positions = this.movement.getFormationPositions(units, center, mode, anchor);

      units.forEach((unit, index) => {

        const rawPoint = positions[index];
        const point = this.terrain.nearestSafeUnitPoint(unit, rawPoint.x, rawPoint.y, combatSpacing.terrainFootRadius);
        unit.spacingMode = mode;
        unit.finishAction('cancelled', 'movement_cancelled', `Leader ${formationMode} order`, { cause: { ...PLAYER_SOURCE, commandId: order.commandId } });
        executeOrder(this, order, unit);
        assignMovement(this, unit, point, order);
        this.manualTargets.set(unit.id, point);
        this.attackTargets.delete(unit.id);
        this.heldUnitIds.add(unit.id);
      });

      this.showBattleMessage(`${formationMode} FORMATION SET`, '#93c5fd');
      this.completePartyCommand(formationMode);
      this.commandMode = null;
      this.setTargetingInputState(false);
      this.refreshTacticsMenus();

      return;
    }

    this.combatLog?.diagnostics?.command('MOVE', units);
    const positions = this.movement.getFormationPositions(units, center);
    units.forEach((unit, index) => {

      const rawPoint = positions[index];
      const point = this.terrain.nearestSafeUnitPoint(unit, rawPoint.x, rawPoint.y, combatSpacing.terrainFootRadius);
      unit.spacingMode = 'normal';

      unit.finishAction('cancelled', 'movement_cancelled', 'Leader Move order', { cause: { ...PLAYER_SOURCE, commandId: order.commandId } });
      if (unit.classAbilities && !this.combatPaused) {

        // ??= fills a missing value once. It leaves an existing value, including zero or
        // false, alone.
        this.classAbilitySystem ??= new ClassAbilitySystem(this);
        this.classAbilitySystem.move(unit, point, this.time.now);
      }

      executeOrder(this, order, unit);
      assignMovement(this, unit, point, order);
      this.manualTargets.set(unit.id, point);

      this.attackTargets.delete(unit.id);

      // Make direct movement a persistent Hold immediately so AI, dodging, cannot override
      // the player's destination. Personal space still applies.
      this.heldUnitIds.add(unit.id);
    });

    this.showBattleMessage('MOVE + HOLD ORDER', '#93c5fd');
    this.completePartyCommand('MOVE');
    this.commandMode = null;
    this.setTargetingInputState(false);
    this.refreshTacticsMenus();
  }

  // This helper sends selected adventurers to attack a tapped enemy by default. Explicit
  // movement still uses the enemy's position as a destination; Focus Fire and Interrupt
  // retain their separate targeting behavior.
  handleEnemyTap(enemy) {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    const command = this.commandMode ?? 'ATTACK';
    const observing = !['MOVE', 'SPREAD', 'STACK'].includes(this.commandMode)
      && (this.commandMode || this.getSelectedUnits().length);
    const intended = ['COORDINATED_ATTACK', 'LUNAR_ASSAULT'].includes(command) ? targetedTacticUnits(this, command) : this.getSelectedUnits();
    const order = observing ? requestOrder(this, command, intended, { intendedRecipientIds: intended.map(unit => unit.id), targetId: enemy?.id ?? null, castId: enemy?.pendingAction?.castId ?? null }) : null;
    if (!enemy?.alive || enemy.landing || this.battleOver || this.waveTransitioning) { if (order) rejectOrder(this, order, 'enemy_unavailable'); return; }
    if (this.commandMode === 'INTERRUPT' && this.interruptCooldownRemainingMs > 0) {
      rejectOrder(this, order, 'interrupt_cooldown');
      this.showInterruptCooldown();
      return;
    }
    this.inspectedEnemyId = enemy.id;
    if (!this.commandMode && !this.getSelectedUnits().length) return;

    // Choose each tactic's target now, so several paused tactics can retain different targets.
    const tacticId = { FOCUS: 'focusFire', COORDINATED_ATTACK: 'coordinatedAttack',
      LUNAR_ASSAULT: 'lunarAssault' }[this.commandMode];
    if (tacticId && (this.battleOver || this.waveTransitioning)) return;
    if (this.combatPaused && tacticId) {
      this.queuePausedTactic(tacticId, enemy.id, order);
      this.commandMode = null;
      this.setTargetingInputState(false);
      this.refreshTacticsMenus();
      return;
    }

    // Opening targeting reserves nothing. Recheck the party at the actual target tap,
    // since a required damage dealer may have fallen while the player was choosing.
    if (tacticId && !this.commitTargetedTactic(tacticId)) {
      rejectOrder(this, order, 'tactic_unavailable', tacticRecipients(order, targetedTacticUnits(this, command)));
      return;
    }

    if (['MOVE', 'SPREAD', 'STACK'].includes(this.commandMode)) {
      this.handleArenaTap({ x: enemy.arenaX, y: enemy.arenaY });
      this.refreshTacticsMenus();

      return;
    }

    if (this.combatPaused) {
      const type = this.commandMode ?? 'ATTACK';
      this.leaderOrderPlan.prepare(type, { target: enemy, observation: order });
      return;
    }

    this.combatLog?.diagnostics?.command(this.commandMode ?? 'ATTACK', this.getSelectedUnits(), enemy);
    if (!this.commandMode || this.commandMode === 'ATTACK') {
      const units = this.getSelectedUnits();
      if (units.length === 0) { rejectOrder(this, order, 'no_selected_actors'); return; }
      acceptOrder(this, order);

      // Repeating the active Attack order preserves its windup, including support casts.
      // A different target or an intervening Move, Hold or formation order is an override.
      units.forEach((unit) => {
        const redundant = this.attackTargets.get(unit.id) === enemy.id
          && !this.manualTargets.has(unit.id) && !this.heldUnitIds.has(unit.id)
          && unit.spacingMode === 'normal';
        if (redundant) {
          emitGameplay(this, 'combat.order.unchanged', { ...order, subjectIds: [unit.id], redundant: true }, PLAYER_SOURCE);
          return;
        }
        executeOrder(this, order, unit);

        this.manualTargets.delete(unit.id);
        this.heldUnitIds.delete(unit.id);
        unit.spacingMode = 'normal';
        this.attackTargets.set(unit.id, enemy.id);
        unit.finishAction('cancelled', 'action_replaced', 'Leader Attack order', { cause: { ...PLAYER_SOURCE, commandId: order.commandId } });
      });

      this.showBattleMessage(`ATTACK: ${enemy.name}`, '#fb923c');
      this.completePartyCommand('ATTACK');
      HapticsService.tap();
    } else if (this.commandMode === 'FOCUS') {
      acceptOrder(this, order);
      emitGameplay(this, 'combat.order.executed', { ...order, subjectIds: [], affectedRecipientIds: [],
        affectedTargetIds: [enemy.id], effectScope: 'party_target', outcome: 'applied', phase: 'effect' }, PLAYER_SOURCE);
      this.focusTargetId = enemy.id;
      this.focusDamageTargetId = enemy.id;

      // ?? uses the fallback only for null or undefined. A real zero or false stays
      // intact. find returns the first matching entry, or undefined when none matches.
      // Check for that missing result before using its fields.
      this.focusDamageUntil = this.time.now + (leaderAbilities.find(entry => entry.id === 'focusFire')?.duration ?? 10000);
      this.showBattleMessage(`FOCUS SET: ${enemy.name}`, '#fb923c');
    } else if (this.commandMode === 'COORDINATED_ATTACK') {

      // filter keeps entries whose callback returns true. It builds a new list and leaves
      // the original list in place.
      const melee = targetedTacticUnits(this, 'COORDINATED_ATTACK');
      const recipients = tacticRecipients(order, melee);
      const effectResults = [];
      acceptOrder(this, order, false, recipients);
      if (melee.length) {
        melee.forEach(unit => {
          executeOrder(this, { ...order, ...recipients }, unit, { reportExecution: false });
          this.manualTargets.delete(unit.id);
          this.heldUnitIds.delete(unit.id);
          unit.spacingMode = 'normal';
          unit.finishAction('cancelled', 'action_replaced', 'Leader Coordinated Attack order', { cause: { ...PLAYER_SOURCE, commandId: order.commandId } });
          this.attackTargets.set(unit.id, enemy.id);
        });

        // reduce carries an accumulated result from one entry to the next. The callback
        // returns the accumulator for the next step; the final argument supplies its
        // starting value.
        const damage = coordinatedTacticDamage(leaderAbilities.find(ability => ability.id === 'coordinatedAttack'), melee);
        const rootBefore = enemy.status.rootedUntil ?? 0;
        const dealt = this.resolveDamage(melee[0], enemy, damage, 'melee', 1, 'Coordinated Attack!', false);
        if (enemy.alive) enemy.status.rootedUntil = Math.max(enemy.status.rootedUntil ?? 0, this.time.now + 6000);
        effectResults.push({ targetId: enemy.id, damage: dealt, rootChanged: (enemy.status.rootedUntil ?? 0) !== rootBefore });
      }

      emitGameplay(this, 'combat.order.executed', { ...order, ...recipients,
        affectedRecipientIds: melee.map(unit => unit.id), effectResults,
        affectedTargetIds: effectResults.filter(result => result.damage > 0 || result.rootChanged).map(result => result.targetId),
        outcome: melee.length ? 'applied' : 'no_effect', phase: 'effect' }, PLAYER_SOURCE);
      this.showBattleMessage(`COORDINATED ATTACK - ${enemy.name} rooted`, '#bef264');
    } else if (this.commandMode === 'LUNAR_ASSAULT') {
      const mages = targetedTacticUnits(this, 'LUNAR_ASSAULT');
      const recipients = tacticRecipients(order, mages);
      const effectResults = [];
      acceptOrder(this, order, false, recipients);
      const radius = leaderAbilities.find(ability => ability.id === 'lunarAssault').radius;
      const targets = this.getLivingEnemies().filter(target => Math.hypot(target.arenaX - enemy.arenaX, target.arenaY - enemy.arenaY) <= radius);
      if (mages.length && targets.length) {
        mages.forEach(unit => {
          executeOrder(this, { ...order, ...recipients }, unit, { reportExecution: false });
          this.manualTargets.delete(unit.id);
          this.heldUnitIds.delete(unit.id);
          unit.finishAction('cancelled', 'action_replaced', 'Leader Lunar Assault order', { cause: { ...PLAYER_SOURCE, commandId: order.commandId } });
          this.attackTargets.set(unit.id, enemy.id);
        });
        const damage = coordinatedTacticDamage(leaderAbilities.find(ability => ability.id === 'lunarAssault'), mages);

        targets.forEach(target => {
          const rootBefore = target.status.rootedUntil ?? 0;
          const dealt = this.resolveDamage(mages[0], target, damage, 'spell', 1, 'Lunar Assault!', false);
          if (target.alive) target.status.rootedUntil = Math.max(target.status.rootedUntil ?? 0, this.time.now + 8000);
          effectResults.push({ targetId: target.id, damage: dealt, rootChanged: (target.status.rootedUntil ?? 0) !== rootBefore });
        });
      }

      emitGameplay(this, 'combat.order.executed', { ...order, ...recipients,
        affectedRecipientIds: targets.length ? mages.map(unit => unit.id) : [],
        effectResults, affectedTargetIds: effectResults.filter(result => result.damage > 0 || result.rootChanged).map(result => result.targetId),
        outcome: mages.length && targets.length ? 'applied' : 'no_effect', phase: 'effect' }, PLAYER_SOURCE);
      this.showBattleMessage('LUNAR ASSAULT - enemies rooted', '#c4b5fd');
    } else if (this.commandMode === 'INTERRUPT') {
      emitGameplay(this, 'combat.interrupt.attempted', { ...order, castId: enemy.pendingAction?.castId ?? null }, PLAYER_SOURCE);
      this.combatLog?.diagnostics?.control(enemy, { name: 'INTERRUPT' }, 'explicit_interrupt', !!enemy.pendingAction, enemy.pendingAction ? 'applied' : 'no_active_action');
      if (enemy.pendingAction) {
        acceptOrder(this, order);
        const castId = enemy.pendingAction.castId;
        emitGameplay(this, 'combat.order.executed', { ...order, castId, phase: 'interrupt' }, PLAYER_SOURCE);
        enemy.finishAction('interrupted', 'explicit_interrupt', 'Party Leader interrupt command', { cause: { kind: 'player', actorId: 'party_leader', ability: 'INTERRUPT', commandId: order.commandId } });
        emitGameplay(this, 'combat.interrupt.succeeded', { ...order, castId }, PLAYER_SOURCE);

        // Spend the command cooldown only when an active cast was actually interrupted.
        this.interruptCooldownRemainingMs = 15000;

        // Remove canceled area warnings immediately so the floor shows current danger.
        // The delayed hit also checks the canceled action before doing any damage.
        this.activeTelegraphs.filter(telegraph => telegraph.attacker === enemy)
          .forEach(telegraph => this.removeTelegraph(telegraph));
        this.showBattleMessage(`INTERRUPTED: ${enemy.name}`, '#fde68a');
        this.completePartyCommand('INTERRUPT');
      } else {
        rejectOrder(this, order, 'no_active_cast');
        this.showBattleMessage(`${enemy.name} is not casting`, '#a8a29e');
      }
    }

    this.commandMode = null;
    this.setTargetingInputState(false);
    this.refreshTacticsMenus();
    if (tacticId) this.updateLeaderLoadoutBar();
  }

  // A brief ring marks the exact movement destination.
  highlightArenaPoint(point) {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    this.destinationHighlight?.destroy();
    const screen = this.battlefield.arenaToScreen(point.x, point.y);

    // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
    // lower-depth objects.
    const marker = this.add.ellipse(screen.x, screen.y, 40, 18, 0x60a5fa, 0.16)
      .setStrokeStyle(3, 0x60a5fa, 0.95).setDepth(35);
    this.destinationHighlight = marker;

    // The delay is in milliseconds. Phaser calls the supplied function later on this
    // scene's clock, so pause and cleanup affect when it can run.
    this.time.delayedCall(650, () => marker.destroy());
  }

  // This helper advances toward player destinations while retaining held positions.
  applyManualMovement(unit, deltaSeconds) {

    const target = this.manualTargets.get(unit.id);
    if (!target || unit.isBusy(this.time.now)) {
      return false;
    }

    if (unit.classAbilities) {

      // ??= fills a missing value once. It leaves an existing value, including zero or
      // false, alone.
      this.classAbilitySystem ??= new ClassAbilitySystem(this);
      this.classAbilitySystem.move(unit, target, this.time.now);
    }

    if (unit.distanceToPoint(target.x, target.y) > combatSpacing.arrivalTolerance) {
      const start = { x: unit.arenaX, y: unit.arenaY };
      const moved = unit.moveToward(target.x, target.y, deltaSeconds, combatSpacing.arrival);
      const movement = unit.manualMovement;
      if (movement) {
        if (moved) {
          unit.manualMovementSerial = (unit.manualMovementSerial ?? 0) + 1;
          if (!movement.started) {
            movement.started = true;
            emitGameplay(this, 'combat.movement.started', { actorId: unit.id, ...movement }, PLAYER_SOURCE);
          }
          for (const warning of this.activeTelegraphs) {
            const evidence = warning.action?.warningEvidence;
            if (!evidence) continue;
            const g = evidence.geometry;
            if (Math.hypot(start.x - g.x, start.y - g.y) <= g.radius && unit.distanceToPoint(g.x, g.y) > g.radius) {
              unit.manualWarningEscapes ??= {};
              unit.manualWarningEscapes[evidence.castId] = { serial: unit.manualMovementSerial, commandId: movement.commandId, tutorial: movement.tutorial };
            }
          }
        } else if (!movement.blocked) {
          movement.blocked = true;
          emitGameplay(this, 'combat.movement.blocked', { actorId: unit.id, ...movement }, PLAYER_SOURCE);
        }
      }
      return true;
    }

    if (unit.manualMovement && !unit.manualMovement.arrived) {
      unit.manualMovement.arrived = true;
      emitGameplay(this, 'combat.movement.arrived', { actorId: unit.id, ...unit.manualMovement }, PLAYER_SOURCE);
    }
    if (!this.isPositionLocked(unit)) {
      this.manualTargets.delete(unit.id);
    }

    return false;
  }

  // This helper triggers the chosen leadership effect under its battle cooldown.
  useLeaderAbility(id) {

    const targeted = ['focusFire', 'coordinatedAttack', 'lunarAssault', 'revive'].includes(id);
    const intended = targeted ? [] : this.leaderOrderPlan.membersForTactic(id)
      .map(id => this.partyUnits.find(unit => unit.id === id));
    const observation = targeted ? null : requestOrder(this, 'TACTIC:' + id, intended,
      { intendedRecipientIds: intended.map(unit => unit.id) });
    if (this.battleOver || this.waveTransitioning) {
      if (observation) rejectOrder(this, observation, 'encounter_unavailable');
      return;
    }
    if (this.combatPaused) {

      // Targeted tactics need a battlefield tap before joining the Resume queue.
      const mode = { focusFire: 'FOCUS', coordinatedAttack: 'COORDINATED_ATTACK',
        lunarAssault: 'LUNAR_ASSAULT', revive: 'REVIVE' }[id];
      if (mode && this.isLeaderAbilityReady(id)) {
        this.commandMode = mode;
        this.setTargetingInputState(mode !== 'REVIVE');
        this.showBattleMessage(mode === 'REVIVE' ? 'REVIVE! - tap a fallen character' : `${mode} - tap an enemy`, '#bef264', true);
      } else this.queuePausedTactic(id, null, observation);
      return;
    }

    // find returns the first matching entry, or undefined when none matches. Check for
    // that missing result before using its fields.
    const ability = leaderAbilities.find((entry) => entry.id === id);
    if (!ability || !this.isLeaderAbilityReady(id)) {
      if (observation) rejectOrder(this, observation, 'tactic_unavailable');
      this.showBattleMessage('Tactic unavailable or recharging', '#a8a29e');
      return;
    }

    // Work with the currently living party members for this step. Fallen adventurers
    // remain in the party records for deaths, inspection and revival, but they do not move
    // or act as living units.
    const living = this.partyUnits.filter((unit) => unit.alive);
    const fallen = this.partyUnits.filter((unit) => !unit.alive && !unit.delvesUsed?.honorSacrifice);
    if (['arise', 'revive'].includes(id) && fallen.length === 0) {
      if (observation) rejectOrder(this, observation, 'no_eligible_actors');
      this.showBattleMessage('No fallen adventurers to revive', '#a8a29e');
      return;
    }

    if (!tacticCanRevive(ability) && living.length === 0) {
      if (observation) rejectOrder(this, observation, 'no_eligible_actors');
      return;
    }

    if (ability.effects && !expandedTacticHasBenefit(this, ability)) {
      if (observation) rejectOrder(this, observation, 'no_effect');
      this.showBattleMessage('Tactic has no eligible effect yet', '#fff1d2');
      return;
    }

    // some stops with true as soon as one entry passes the check; an empty list gives
    // false.
    if (id === 'encouragement' && !living.some((unit) => unit.hp < unit.maxHp)) {
      if (observation) rejectOrder(this, observation, 'no_effect');
      this.showBattleMessage('The party is already at full health', '#a8a29e');
      return;
    }

    if (id === 'manaVortex' && !living.some(unit => unit.maxMana > unit.mana)) { rejectOrder(this, observation, 'no_effect'); return; }
    if (id === 'shieldWall' && !living.some(unit => unit.role === 'Tank')) { rejectOrder(this, observation, 'no_effect'); return; }
    if (id === 'coordinatedAttack' && !living.some(unit => unit.role === 'Melee DPS')) return;

    if (id === 'lunarAssault' && !living.some(unit => isMageClass(unit.className))) return;
    if (id === 'supplies' && !living.some(unit => {

      // find returns the first matching entry, or undefined when none matches. Check for
      // that missing result before using its fields.
      const hero = GameState.roster.find(entry => entry.id === unit.id);
      return Boolean(equippedItem(hero, 'potion'));
    })) { if (observation) rejectOrder(this, observation, 'no_eligible_recipients'); return; }

    if (id === 'revive') {
      this.commandMode = 'REVIVE';
      this.showBattleMessage('REVIVE! - tap a fallen character', '#fde68a', true);
      return;
    }

    if (['focusFire', 'coordinatedAttack', 'lunarAssault'].includes(id)) {

      // A target prompt does not start the cooldown or spend a once-per-encounter use.
      // The enemy tap commits the tactic after a valid target has been selected.
      this.commandMode = { focusFire: 'FOCUS', coordinatedAttack: 'COORDINATED_ATTACK',
        lunarAssault: 'LUNAR_ASSAULT' }[id];
      this.setTargetingInputState(true);
      this.showBattleMessage(`${ability.name} - tap an enemy`, '#bef264', true);
      HapticsService.tap();
      return;
    }

    const order = observation;
    acceptOrder(this, order);
    const validRecipients = this.leaderOrderPlan.membersForTactic(id).map(id => this.partyUnits.find(unit => unit.id === id));
    const affectedRecipientIds = [];

    // Immediate tactics start their cooldown and usage when their effect is applied.
    const now = this.time.now;
    this.leaderAbilityCooldowns.set(id, now);
    if (ability.oncePerEncounter) this.usedLeaderAbilities.add(id);
    HapticsService.confirm();

    let expandedResult = null;
    if (ability.effects) {
      expandedResult = applyExpandedTactic(this, ability);
      affectedRecipientIds.push(...expandedResult.affectedRecipientIds);
      this.showBattleMessage(ability.name, '#fff1d2', false, 1.5);
    } else if (id === 'fightOn') {
      this.assaultUntil = now + ability.duration;
      this.assaultBonus = ability.damageBonus;
      affectedRecipientIds.push(...living.map(unit => unit.id));
      this.showBattleMessage('FIGHT ON! - +10% damage for 6 seconds', '#bef264', false, 1.5);
    } else if (id === 'brace') {
      this.braceUntil = now + ability.duration;
      this.braceReduction = ability.damageReduction;
      affectedRecipientIds.push(...living.map(unit => unit.id));
      this.showBattleMessage('BRACE! - 30% less damage for 8 seconds', '#bef264', false, 1.5);
    } else if (id === 'shieldWall') {
      living.filter(unit => unit.role === 'Tank').forEach(unit => {
        affectedRecipientIds.push(unit.id);
        unit.status.leaderBlockBonus = ability.blockBonus;
        unit.status.leaderBlockUntil = now + ability.duration;
      });
      this.showBattleMessage('SHIELD WALL! - tanks gain Block', '#bef264', false, 1.5);
    } else if (id === 'encouragement') {
      living.forEach((unit) => {

        const before = unit.hp;
        unit.heal(Math.round(unit.maxHp * ability.healFraction));
        if (unit.hp !== before) affectedRecipientIds.push(unit.id);
        this.createFloatingText(unit.x, unit.y - 80, '+' + Math.round(unit.hp - before), '#86efac');
      });
      this.showBattleMessage('ENCOURAGE! - party healed', '#bef264', false, 1.5);
    } else if (id === 'arise') {
      fallen.forEach((unit) => {

        executeOrder(this, order, unit, { reportExecution: false });
        unit.revive(ability.healthFraction, ability.manaFraction);
        if (unit.alive) affectedRecipientIds.push(unit.id);
        this.manualTargets.delete(unit.id);
        this.attackTargets.delete(unit.id);
        this.heldUnitIds.delete(unit.id);
        this.announceAbility(unit, 'ARISE!', '#fde68a');
      });

      this.awaitingRevive = false;
      this.commandMode = null;
      this.setTargetingInputState(false);
      this.updateHud();
      this.showBattleMessage('ARISE! - fallen allies restored', '#fde68a', false, 1.5);
    } else if (id === 'manaVortex') {
      living.forEach(unit => {
        if (unit.mana !== unit.maxMana) affectedRecipientIds.push(unit.id);
        unit.mana = unit.maxMana;
      });
      this.showBattleMessage('MANA VORTEX! - mana restored', '#c4b5fd', false, 1.5);
    } else if (id === 'regen') {
      living.forEach(unit => {
        affectedRecipientIds.push(unit.id);
        unit.status.leaderRegenUntil = now + ability.duration;
        unit.status.leaderRegenNext = now + ability.healInterval;
        unit.status.leaderRegenAmount = ability.healAmount;
      });
      this.showBattleMessage('REGEN! - healing over time', '#86efac', false, 1.5);
    } else if (id === 'supplies') {
      living.forEach(unit => {

        // find returns the first matching entry, or undefined when none matches. Check for
        // that missing result before using its fields.
        const hero = GameState.roster.find(entry => entry.id === unit.id);
        const item = equippedItem(hero, 'potion');
        const definition = item && getPotionDefinition(item.itemId);

        if (definition) {
          if (item.charges !== definition.uses) affectedRecipientIds.push(unit.id);
          item.charges = definition.uses;
        }
      });

      this.showBattleMessage('SUPPLIES! - potion uses restored', '#bef264', false, 1.5);
    } else if (id === 'ready') {
      living.forEach(unit => { affectedRecipientIds.push(unit.id); unit.status.nextAbilityCrit = true; });
      this.showBattleMessage('READY! - next abilities critically hit', '#fde68a', false, 1.5);
    }

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    emitGameplay(this, 'combat.order.executed', { ...order, intendedRecipientIds: order.intendedRecipientIds ?? order.subjectIds,
      validRecipientIds: validRecipients.map(unit => unit.id), subjectIds: affectedRecipientIds, affectedRecipientIds,
      ...(expandedResult ? { affectedTargetIds: expandedResult.affectedTargetIds } : {}),
      outcome: affectedRecipientIds.length ? 'applied' : 'no_effect', phase: 'effect' }, PLAYER_SOURCE);
    this.combatLog?.add('tactic', ability.name + ' used', { wave: this.currentWaveIndex + 1, ability: ability.name });
    this.refreshTacticsMenus();
    this.updateLeaderLoadoutBar();
  }

  // Spend a targeted tactic only when its selected recipient can receive the effect.
  commitTargetedTactic(id) {
    if (this.combatPaused || this.battleOver || this.waveTransitioning || !this.isLeaderAbilityReady(id)) return false;
    const living = this.partyUnits.filter(unit => unit.alive);
    if (id === 'focusFire' && living.length === 0) return false;
    if (id === 'coordinatedAttack' && !living.some(unit => unit.role === 'Melee DPS')) return false;
    if (id === 'lunarAssault' && !living.some(unit => isMageClass(unit.className))) return false;

    // time.now uses the paused combat clock, so the full countdown begins at selection.
    const ability = leaderAbilities.find(entry => entry.id === id);
    this.leaderAbilityCooldowns.set(id, this.time.now);
    if (ability.oncePerEncounter) this.usedLeaderAbilities.add(id);
    this.combatLog?.add('tactic', ability.name + ' used', { wave: this.currentWaveIndex + 1, ability: ability.name });
    HapticsService.confirm();
    return true;
  }

  // Commands and tactics share planning metadata while execution stays in existing paths.
  queuePausedTactic(id, targetId = null, observation = null) {

    // find returns the first matching entry, or undefined when none matches. Check for
    // that missing result before using its fields.
    observation ??= requestOrder(this, 'TACTIC:' + id, [], { targetId });
    const ability = leaderAbilities.find((entry) => entry.id === id);
    if (!ability || !this.isLeaderAbilityReady(id)) {
      rejectOrder(this, observation, 'tactic_unavailable');
      this.showBattleMessage('Tactic unavailable or recharging', '#a8a29e');
      return;
    }

    // filter keeps entries whose callback returns true. It builds a new list and leaves
    // the original list in place.
    const living = this.partyUnits.filter((unit) => unit.alive);
    const fallen = this.partyUnits.filter((unit) => !unit.alive);

    // some stops with true as soon as one entry passes the check; an empty list gives
    // false.
    if ((!tacticCanRevive(ability) && living.length === 0)
      || (['arise', 'revive'].includes(id) && fallen.length === 0)
      || (id === 'encouragement' && !living.some((unit) => unit.hp < unit.maxHp))) {

      // The condition before ? chooses the first value when true and the value after :
      // when false.
      rejectOrder(this, observation, 'no_effect');
      this.showBattleMessage(id === 'arise' ? 'No fallen adventurers to revive' : 'Tactic has no effect yet', '#a8a29e');
      return;
    }

    this.leaderOrderPlan.prepareTactic(id, targetId, observation);
  }

  // Resume submits every prepared order through its existing validated execution path.
  flushPausedTactics() {
    this.leaderOrderPlan.flush();
  }

  // This helper validates the equipped tactic, its unlock, and encounter usage before
  // either the UI or last-chance resurrection can use it.
  isLeaderAbilityReady(id) {

    // find returns the first matching entry, or undefined when none matches. Check for
    // that missing result before using its fields.
    const ability = leaderAbilities.find((entry) => entry.id === id);
    const leader = GameState.leader;

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined. ?? uses the fallback only for null or undefined. A real zero or false
    // stays intact.
    return Boolean(ability && leader?.unlockedAbilities.includes(id)
      && leader.battleLoadout.includes(id)
      && !(ability.oncePerEncounter && this.usedLeaderAbilities.has(id))
      && this.time.now - (this.leaderAbilityCooldowns.get(id) ?? -Infinity) >= (ability.cooldown ?? 0));
  }

  // This helper announces the next enemy group before it enters the arena.
  startWave(index) {
    this.partyLeaderTap?.reset();

    if (index >= this.waves.length) {
      this.finishVictory();
      return;
    }

    this.gameplayContext.waveSerial++;
    this.currentWaveIndex = index;
    GameState.currentRoom = index;

    // A fresh farm countdown starts the first cycle's partial-time credit. Later clears
    // provide the full cycle measurements, including the return and rest between fights.
    if (GameState.run.entry === 'farm') {
      this.farmTiming ??= { samples: [] };
      this.farmTiming.startedAt = this.time.now;
    }
    this.refreshFarmControls();
    const wave = this.waves[index];
    this.waveTransitioning = true;
    this.updateEncounterStatus();

    // Farming repeats a cleared encounter, so announce its next repetition without
    // implying that the party is advancing to another numbered progression wave.
    this.showWaveAnnouncement(GameState.run.entry === 'farm' ? 'NEXT WAVE' : `WAVE ${index + 1}`, Boolean(wave.boss));

    this.updateWaveCountdown(3);
    this.scheduleBattleEvent(1000, { kind: 'countdown', index, secondsRemaining: 3 });
  }

  // Gameplay timers carry data so their remaining delay survives a restart.
  scheduleBattleEvent(delay, data, callback = null) {

    // ??= fills a missing value once. It leaves an existing value, including zero or
    // false, alone. A Set keeps each value once. has checks membership without searching a
    // list for duplicate entries.
    this.battleEvents ??= new Set();
    const event = { data, timer: null };

    // The delay is in milliseconds. Phaser calls the supplied function later on this
    // scene's clock, so pause and cleanup affect when it can run.
    event.timer = this.time.delayedCall(delay, () => {
      this.battleEvents.delete(event);
      if (callback) callback();
      else this.resolveBattleEvent(data);
    });
    this.battleEvents.add(event);

    return event.timer;
  }

  // Build the stable unit IDs and action identity needed to resolve a scheduled action
  // later. unit is the live combatant, with current resources and arena position.
  actionEvent(kind, unit, target, details = {}) {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined. The condition before ? chooses the first value when true and the value
    // after : when false. ... copies the source's own fields into this object; fields
    // listed later replace earlier ones. This is a shallow copy, so nested objects are
    // still shared.
    return { kind, unitId: unit.id, targetId: target?.id, point: target?.id ? null : target,
      actionId: unit.pendingAction.id, actionStartAt: unit.pendingAction.startAt,
      actionName: unit.pendingAction.name, ...details };
  }

  // Dispatch a typed saved event to the appropriate gameplay handler.
  resolveBattleEvent(data) {
    if (data.kind === 'countdown') {
      if (this.battleOver) return;
      const secondsRemaining = data.secondsRemaining - 1;
      if (secondsRemaining > 0) {
        this.updateWaveCountdown(secondsRemaining);

        // ... copies the source's own fields into this object; fields listed later replace
        // earlier ones. This is a shallow copy, so nested objects are still shared.
        this.scheduleBattleEvent(1000, { ...data, secondsRemaining });
      } else {
        this.clearWaveAnnouncement();
        this.spawnWave(data.index);
      }

      return;
    }

    if (data.kind === 'pendingLandings') return this.retryPendingLandings();
    const units = [...this.partyUnits, ...this.enemies, ...(this.abilityDecoys ?? [])];

    // find returns the first matching entry, or undefined when none matches. Check for
    // that missing result before using its fields.
    const unit = units.find(entry => entry.id === data.unitId);
    if (!unit) return;
    if (data.kind === 'bossDrop') return this.startBossDrop(unit);
    if (data.kind === 'landing') return this.finishEnemyLanding(unit);
    const action = unit.pendingAction;

    if (!action || action.id !== data.actionId || action.startAt !== data.actionStartAt || action.name !== data.actionName) return;

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    const target = data.targetId ? units.find(entry => entry.id === data.targetId) : data.point;
    if (data.targetId && !target) {
      unit.finishAction('cancelled', 'state_invalidated', 'Saved action target no longer exists');
      return;
    }
    if (data.kind === 'attack') this.resolveBasicAttack(unit, action, target, data.attackType);
    else if (data.kind === 'heal') this.resolveBasicHeal(unit, action, target);
    else if (data.kind === 'enemyAbility') this.resolveEnemyAbility(unit, action, target, unit.abilities[data.key]);
    else if (data.kind === 'classAbility') this.classAbilitySystem.resolveCast(unit, action, target, data.ability);
    else if (data.kind === 'groundSlam') {
      const telegraph = this.activeTelegraphs.find(entry => entry.attacker === unit);
      this.resolveGroundSlam(unit, action, data.center, data.ability, telegraph);
    }
  }

  // Keep the wave number and countdown readable over bright or detailed arenas.
  showWaveAnnouncement(title, isBoss = false) {

    // Reload and idle catch-up can restore this panel without calling startWave.
    // Apply the farm wording here too, so those paths cannot restore a wave number.
    if (GameState.run.entry === 'farm') title = 'NEXT WAVE';

    // The braces pull named fields into local variables. This reads those fields without
    // copying the whole source object.
    const { width, height } = this.scale;
    const centerX = width / 2;

    // Keep the compact countdown below the tactics row and above the party's heads.
    const centerY = height * 0.28;

    // Math.min chooses the smallest value; pairing it with Math.max can keep a result
    // inside both a lower and an upper bound.
    const panelWidth = Math.min(880, width - 660);
    const backdrop = combatPanel(this, 0, 0, panelWidth, 180);

    // Origin is the anchor within the object: 0 is the left/top edge, 0.5 is the center
    // and 1 is the right/bottom edge. x/y place that anchor, not necessarily the object's
    // corner. The condition before ? chooses the first value when true and the value after
    // : when false.
    const labelText = this.add.text(0, -56, isBoss ? 'BOSS WAVE' : '', {
      fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('compact24'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#d8b761'
    }).setOrigin(0.5);
    const titleText = this.add.text(0, isBoss ? -9 : -22, title, {
      fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('display51'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#fff1cc',
      stroke: '#211606', strokeThickness: 2, align: 'center'
    }).setOrigin(0.5);

    titleText.setScale(Math.min(1, (panelWidth - 96) / titleText.width));
    const divider = this.add.rectangle(0, 31, panelWidth - 100, 2, 0x9c7c39, 0.65);
    this.waveCountdownText = this.add.text(0, 59, '', {
      fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('support28'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#e6d9b8'
    }).setOrigin(0.5);

    // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
    // lower-depth objects.
    this.waveAnnouncement = this.add.container(centerX, centerY,
      [backdrop, labelText, titleText, divider, this.waveCountdownText]).setDepth(9000);
  }

  // Refresh the displayed countdown as each scheduled second elapses.
  updateWaveCountdown(secondsRemaining) {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined. The condition before ? chooses the first value when true and the value
    // after : when false.
    this.waveCountdownText?.setText(`IN ${secondsRemaining} ${secondsRemaining === 1 ? 'SECOND' : 'SECONDS'}`);
  }

  // Remove the wave heading and countdown display after its announcement finishes.
  clearWaveAnnouncement() {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    this.waveAnnouncement?.destroy();
    this.waveAnnouncement = null;
    this.waveCountdownText = null;
  }

  // This helper creates the announced enemies once the countdown ends.
  spawnWave(index) {

    // Finished enemy records cannot affect the next wave and must not accumulate in saves.
    this.enemyThreat.clear();
    for (const unit of this.enemies) {
      this.movement.slots.delete(unit);
      this.movement.rangeStates.delete(unit);
    }
    const wave = this.waves[index];

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    this.combatLog?.diagnostics?.waveStart();
    this.combatLog?.add('wave', `Wave ${index + 1} started`, { wave: index + 1 });

    const landings = chooseWaveLandings(wave, this.battlefield, this.terrain, this.partyUnits, () => this.combatRandom());
    this.pendingWaveSpawns = [];

    // filter keeps entries whose callback returns true. It builds a new list and leaves
    // the original list in place. map builds one output entry for each input entry, in the
    // same order. The callback's return value becomes that output entry.
    this.enemies = wave.enemies.map((spawn, spawnIndex) => {
      const landing = landings[spawnIndex];
      if (!landing) {
        this.pendingWaveSpawns.push({ spawn, spawnIndex });
        return null;
      }

      return this.createEnemy(spawn.type, landing, spawnIndex);
    }).filter(Boolean);

    this.enemies.forEach(enemy => this.queueEnemyLanding(enemy));
    if (this.pendingWaveSpawns.length > 0) this.schedulePendingLandings();
    this.attackTargets.clear();
    this.setTargetingInputState(['ATTACK', 'FOCUS', 'INTERRUPT'].includes(this.commandMode));
    this.waveTransitioning = false;
    if (this.commandMode === 'HOLD') {
      this.commandMode = null;
      this.armCommand('HOLD');
    }
    this.leaderOrderPlan.flush();
  }

  // This helper builds an enemy from its definition and registers its combat targeting.
  createEnemy(type, spawn, spawnIndex) {

    // Ordinary Thornbriar waves first receive their level-5 farming totals. The shared
    // local tuning then scales this encounter and its final boss, including escorts.
    const encounterId = GameState.currentDelve?.encounterId ?? GameState.currentDelve?.id;
    const bossWave = this.currentWaveIndex === this.bossWaveIndex;
    const definition = delveEnemyDefinition(thornbriarEnemyDefinition(type, enemies[type], encounterId,
      bossWave), GameState.currentDelve, bossWave);
    const serial = this.enemySerial++;

    // ... copies the source's own fields into this object; fields listed later replace
    // earlier ones. This is a shallow copy, so nested objects are still shared.
    const enemy = new BattleUnit(this, {
      ...definition,
      id: `${definition.id}-${this.currentWaveIndex}-${spawnIndex}-${serial}`,
      spriteId: type,
      battlefield: this.battlefield,
      arenaX: spawn.x,
      arenaY: spawn.y,
      isEnemy: true
    });

    enemy.enemyType = type;
    enemy.definition = definition;
    enemy.rewarded = false;

    // Only ordinary monsters gain visible-play pressure. Save their idle baseline so
    // leaving and returning to the app can switch stats without resetting the fight.
    prepareActiveMonster(enemy, this, GameState.currentDelve);

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    this.combatMembershipRevision = (this.combatMembershipRevision ?? 0) + 1;
    if (!this.idleSimulating) this.bindEnemyInput(enemy);
    this.movement.validateUnitPosition(enemy);

    // A Map pairs a key with a value. Unlike an array index, the key can be an ID or an
    // object; get/set read and write that same key.
    this.enemyThreat.set(enemy.id, new Map(this.partyUnits.map((unit) => [unit.id, 0])));
    return enemy;
  }

  // Connect enemy taps and held inspection to the current battle commands.
  bindEnemyInput(enemy) {
    enemy.hitZone.setName('battle-enemy-' + enemy.id);
    enemy.hitZone.disableInteractive();

    bindSelectionDetails(this, enemy.hitZone, () => characterDetails(enemy),
      pointer => {
        if (!this.commandMode && !this.getSelectedUnits().length && !this.combatPaused) {
          this.partyLeaderTap.tap(pointer);
          return;
        }
        this.handleEnemyTap(enemy);
      }, () => {
        if (!enemy.alive || enemy.landing) return;
        this.inspectedEnemyId = enemy.id;
        showSelectionDetails(this, characterDetails(enemy));
      });
    this.partyLeaderTap.bindSurface(enemy.hitZone);
  }

  // Combat rolls use saved state, independently of presentation or other scenes.
  combatRandom() {

    // These bit operators work with 32-bit integers. >>> shifts in zero bits, while ^
    // mixes bits with XOR. They are different from ordinary multiplication or
    // exponentiation.
    let value = this.combatRngState >>> 0 || 1;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.combatRngState = value >>> 0;

    return this.combatRngState / 4294967296;
  }

  // Retry crowded waves as characters move, without losing any monsters.
  schedulePendingLandings() {
    this.scheduleBattleEvent(300, { kind: 'pendingLandings' });
  }

  // Retry enemies waiting for a legal spawn point as battlefield space becomes available.
  retryPendingLandings() {
    if (this.battleOver || this.pendingWaveSpawns.length === 0) return;

    // map builds one output entry for each input entry, in the same order. The callback's
    // return value becomes that output entry.
    const wave = { enemies: this.pendingWaveSpawns.map(({ spawn }) => spawn) };

    // filter keeps entries whose callback returns true. It builds a new list and leaves
    // the original list in place.
    const reserved = this.enemies.filter(enemy => enemy.alive).map(enemy => ({
      x: enemy.arenaX, y: enemy.arenaY, clearance: enemy.definition?.boss ? 190 : 125
    }));
    const landings = chooseWaveLandings(wave, this.battlefield, this.terrain,
      this.partyUnits, () => this.combatRandom(), reserved);
    this.pendingWaveSpawns = this.pendingWaveSpawns.filter(({ spawn, spawnIndex }, index) => {
      if (!landings[index]) return true;
      const enemy = this.createEnemy(spawn.type, landings[index], spawnIndex);
      this.enemies.push(enemy);
      this.queueEnemyLanding(enemy);

      return false;
    });

    if (this.pendingWaveSpawns.length > 0) this.schedulePendingLandings();
  }

  // Keep combat and targeting paused for each monster until its feet bounce onto the
  // floor.
  queueEnemyLanding(enemy) {
    if (!enemy.definition?.boss) return this.animateEnemyLanding(enemy);

    // A hidden, untargetable boss still reserves its floor position. The saved timer
    // and optional unit flag survive reloads without recreating or rewarding the boss.
    enemy.landing = true;
    enemy.landingWaiting = true;
    this.combatMembershipRevision = (this.combatMembershipRevision ?? 0) + 1;
    enemy.container.setVisible(false);
    this.scheduleBattleEvent(900, { kind: 'bossDrop', unitId: enemy.id });
  }

  // Wait until every escort has landed, including escorts in the crowded-spawn queue.
  startBossDrop(enemy) {
    if (this.battleOver || !enemy.landingWaiting) return;
    const escortsPending = this.pendingWaveSpawns?.some(({ spawn }) => !enemies[spawn.type]?.boss);
    const escortsFalling = this.enemies.some(unit => !unit.definition?.boss && unit.landing);
    if (escortsPending || escortsFalling) {
      this.scheduleBattleEvent(300, { kind: 'bossDrop', unitId: enemy.id });
      return;
    }
    enemy.landingWaiting = false;
    enemy.container.setVisible(true);
    this.animateEnemyLanding(enemy);
  }

  // Ordinary mobs bounce for 720 ms. Bosses fall heavily over 480 ms, then emit dust.
  animateEnemyLanding(enemy) {

    enemy.landing = true;

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    this.combatMembershipRevision = (this.combatMembershipRevision ?? 0) + 1;
    const duration = enemy.definition?.boss ? 480 : 720;

    // Deferred sprites retain their foot metadata. Record the same fall timestamps
    // during background play so returning halfway through a drop can draw its pose.
    enemy.landingStartedAt = this.time.now;
    enemy.landingDuration = duration;
    const scale = this.battlefield.getUnitScale(enemy.arenaY);
    const screen = this.battlefield.arenaToScreen(enemy.arenaX, enemy.arenaY);
    if (this.idleSimulating) {
      enemy.landingFloorY = enemy.spriteVisual?.definition?.footY ?? 0;
      enemy.landingStartY = enemy.landingFloorY - (screen.y - this.battlefield.topY + 220) / scale;
      this.scheduleBattleEvent(duration, { kind: 'landing', unitId: enemy.id });
      return;
    }

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    const visual = enemy.spriteVisual?.image ?? enemy.body;
    const floorY = visual.y;
    enemy.landingFloorY = floorY;
    visual.y = floorY - (enemy.container.y - this.battlefield.topY + 220) / scale;
    enemy.landingStartY = visual.y;

    for (const label of [enemy.label, enemy.targetLabel, enemy.actionLabel,
      enemy.hpBack, enemy.hpFill, enemy.castBack, enemy.castFill]) label.setAlpha(0);
    this.scheduleBattleEvent(duration, { kind: 'landing', unitId: enemy.id });
  }

  // Use the combat clock for the fall itself, so Pause freezes feet as well as impact.
  drawEnemyLandings() {
    if (this.idleSimulating || this.game.backgroundProgress?.isReplaying) return;
    for (const enemy of this.enemies) {
      if (enemy.landingWaiting) {
        enemy.container.setVisible(false);
        continue;
      }
      if (!enemy.landing || enemy.landingStartedAt === undefined) continue;

      // Restored views may have been visible before catch-up began. Hide labels until
      // the saved landing timer hands this monster back to normal combat.
      for (const label of [enemy.label, enemy.targetLabel, enemy.actionLabel,
        enemy.hpBack, enemy.hpFill, enemy.castBack, enemy.castFill]) label.setAlpha(0);
      const progress = Math.max(0, Math.min(1,
        (this.time.now - enemy.landingStartedAt) / enemy.landingDuration));
      const eased = enemy.definition?.boss ? progress * progress : Phaser.Math.Easing.Bounce.Out(progress);
      const visual = enemy.spriteVisual?.image ?? enemy.body;
      visual.y = enemy.landingStartY + (enemy.landingFloorY - enemy.landingStartY) * eased;
    }
  }

  // End the landing state and hand the newly arrived enemy to normal combat updates.
  finishEnemyLanding(enemy) {
    if (!enemy.container.active) return;
    if (enemy.landing && enemy.definition?.boss) createBossLandingEffect(this, enemy);
    enemy.landing = false;
    enemy.landingWaiting = false;
    enemy.container.setVisible(true);

    // Timer callbacks can precede the last drawing frame. Put feet exactly on the floor.
    const visual = enemy.spriteVisual?.image ?? enemy.body;
    if (enemy.landingFloorY !== undefined) visual.y = enemy.landingFloorY;

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    this.combatMembershipRevision = (this.combatMembershipRevision ?? 0) + 1;

    // This gives the display object an input hit area. Visible artwork alone does not make
    // an object respond to a tap.
    enemy.hitZone.setInteractive({ useHandCursor: true });
    for (const label of [enemy.label, enemy.targetLabel, enemy.actionLabel,
      enemy.hpBack, enemy.hpFill, enemy.castBack, enemy.castFill]) label.setAlpha(1);
  }

  // Keep the mode refresh callable separately from rendering and combat decisions.
  syncActiveCombatBalance() {
    syncActiveCombat(this);
  }

  // This helper advances one frame of combat while the encounter is active. It updates
  // resources and actions, runs party and enemy decisions, separates crowded units, and
  // checks for a cleared wave or defeated party.
  update(time, delta) {
    time = this.time.now;
    if (this.restoringBattle || this.idleSummaryOpen) return;

    // Remaining combat milliseconds persist with the battle and freeze during Pause.
    if (!this.combatPaused && !this.battleOver) {
      this.interruptCooldownRemainingMs = Math.max(0, (this.interruptCooldownRemainingMs ?? 0) - Math.max(0, delta));
    }
    if (!this.game.backgroundProgress?.isReplaying) this.refreshInterruptControl();

    // Refresh mode-dependent stats before this frame's AI and damage use them.
    this.syncActiveCombatBalance();

    // Refresh before transition returns so the header timer keeps ticking between waves.
    this.updateEncounterStatus();
    if (!this.game.backgroundProgress?.isReplaying) this.encounterPanel?.update();

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    const replaying = this.game.backgroundProgress?.isReplaying === true;
    if (!replaying) this.updateSelectedNames(delta);
    this.updateBattleMessageFade(time, replaying);
    if (!replaying && !this.combatPaused) this.updateCombatAnnounceLog(time);

    // Real knockback advances once per frame for both sides, including saved-battle
    // catch-up. Sprite drawing below only adds the height of each bounce.
    if (!this.combatPaused) [...this.partyUnits, ...this.enemies].forEach(unit => {
      if (unit.container?.active !== false) unit.updateCriticalRecoil?.(delta);
    });

    // Sheet bolts use combat time, including Pause and background cleanup.
    updateVoidProjectiles(this, delta, replaying);
    updateAbilityEffects(this, delta, replaying);
    updateThornbriarAbilityEffects(this);
    updateSlimeAbilityEffects(this, delta);
    updateLevelUpEffects(this);
    updateBossLandingEffects(this);
    updateTeleportEffects(this, replaying);
    this.classAbilitySystem?.replacement?.drawZones(time);

    this.classAbilitySystem?.syncChargeTweens?.(this.combatPaused);

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    if (this.focusTargetId && time >= (this.focusDamageUntil ?? 0)) {
      this.focusTargetId = null;
      this.focusDamageTargetId = null;
    }

    if (!replaying) this.updatePotionHud();
    if (!this.combatPaused) this.enemies?.filter(enemy => enemy.container?.active !== false).forEach((enemy) => {
      if (!replaying) {
        enemy.spriteVisual?.update(delta);
      }
      if (replaying && enemy.deathElapsed !== undefined) enemy.deathElapsed += Math.max(0, delta);
      else enemy.updateDeathPresentation?.(delta);
    });
    this.drawEnemyLandings();

    if (this.waveRetreating && !this.combatPaused && !this.battleOver) {

      // Math.min chooses the smallest value; pairing it with Math.max can keep a result
      // inside both a lower and an upper bound.
      this.updateWaveRetreat(time, Math.min(delta / 1000, 0.05), delta);
      return;
    }

    // Wait for queued spawns and every landing, then let story dialogue pause before
    // this frame's combat decisions. Historical catch-up never opens a lesson.
    if (!replaying && storyWaveHasLanded(this) && this.storyReadyWave !== storyWaveReadyId(this)) {
      this.storyReadyWave = storyWaveReadyId(this);
      this.game.events.emit(STORY_WAVE_READY, this);
    }

    if (this.battleOver || this.waveTransitioning || this.combatPaused) {

      // Finish a fall even when its lethal hit ended the battle or wave.
      if (!this.combatPaused && !replaying) this.partyUnits?.forEach(unit => {

        // ?. only follows this link when the value exists; a missing optional value gives
        // undefined.
        unit.spriteVisual?.update(delta);
      });

      return;
    }

    if (this.awaitingRevive) {
      this.updateLeaderLoadoutBar();
      return;
    }

    // Cap the movement timestep so a slow frame does not cause a large position jump.
    const deltaSeconds = Math.min(delta / 1000, 0.05);

    this.partyUnits.forEach((unit) => {

      unit.updateActionBar(time);
      unit.regenMana(deltaSeconds);
      while (unit.alive && unit.status.leaderRegenNext <= time
        && unit.status.leaderRegenNext <= unit.status.leaderRegenUntil) {
        const before = unit.hp;
        unit.heal(unit.status.leaderRegenAmount);
        if (unit.hp > before) this.createFloatingText(unit.x, unit.y - 80, `+${Math.round(unit.hp - before)}`, '#86efac');
        unit.status.leaderRegenNext += 3000;
      }
    });

    this.enemies.forEach((enemy) => enemy.updateActionBar(time));

    const livingEnemies = this.getLivingEnemies();
    if (livingEnemies.length === 0) {
      if (this.pendingWaveSpawns?.length > 0) {
        this.partyUnits.forEach(unit => this.updatePartyUnit(unit, time, deltaSeconds));
      } else if (!this.enemies.some(enemy => enemy.alive && enemy.landing)) this.completeWave();

      return;
    }

    // Decisions move only their own actor through swept collision checks.
    this.classAbilitySystem ??= new ClassAbilitySystem(this);
    this.classAbilitySystem.tickWorld(time);
    this.partyUnits.forEach((unit) => this.updatePartyUnit(unit, time, deltaSeconds));
    this.updateEnemies(time, deltaSeconds);
    this.combatLog?.diagnostics?.sample();

    if (!replaying) this.partyUnits.forEach((unit) => {
      unit.spriteVisual?.update(delta);
    });

    if (!replaying) this.updateHud();

    // every requires all entries to pass the check; an empty list gives true.
    if (this.partyUnits.every((unit) => !unit.alive)) {
      if (leaderAbilities.some(ability => tacticCanRevive(ability) && this.isLeaderAbilityReady(ability.id)
        && this.partyUnits.some(unit => !unit.alive && !unit.delvesUsed?.honorSacrifice))) {
        this.awaitingRevive = true;
        this.showBattleMessage('PARTY DOWN - use a revival tactic or FLEE', '#fde68a', true);
      } else {
        this.finishDefeat();
      }
    }
  }


  // This helper excludes defeated enemies from active combat decisions.
  getLivingEnemies() {

    // filter keeps entries whose callback returns true. It builds a new list and leaves
    // the original list in place.
    return this.enemies.filter((enemy) => enemy.alive && !enemy.landing);
  }

  // Decoys use existing character art, but stay outside party and enemy reward lists.
  // Their saved model is rebuilt separately after the real units have been restored.
  createAbilityDecoy(owner, template, point, health, until, restoredId = null) {
    this.abilityDecoys ??= [];
    if (!restoredId) {
      for (const old of this.abilityDecoys.filter(unit => unit.decoyOwnerId === owner.id)) retireUmbralDecoy(this, old);
      this.abilityDecoys = this.abilityDecoys.filter(unit => unit.decoyOwnerId !== owner.id);
    }
    this.abilityDecoySerial = (this.abilityDecoySerial ?? 0) + 1;
    const decoy = new BattleUnit(this, {
      ...template, id: restoredId ?? `decoy-${this.abilityDecoySerial}`, name: `${template.name}'s Image`,
      maxHp: Math.max(1, Math.round(health)), maxMana: 0, manaRegen: 0, abilities: {},
      classAbilities: false, isEnemy: false, battlefield: this.battlefield, spriteId: template.spriteId ?? template.id
    });
    decoy.isDecoy = true;
    decoy.decoyOwnerId = owner.id;
    decoy.decoyUntil = until;
    decoy.decoyWave = this.currentWaveIndex;
    decoy.setArenaPosition(point.x, point.y);
    decoy.hitZone.disableInteractive();
    this.abilityDecoys.push(decoy);
    return decoy;
  }

  // This helper honors Focus first, then favors bosses and nearby enemies.
  // Read-only queries use the same precedence and stickiness without remembering a choice.
  getPrimaryTarget(unit, remember = true) {

    // filter keeps entries whose callback returns true. It builds a new list and leaves
    // the original list in place.
    const living = this.getLivingEnemies();
    if (living.length === 0) {
      return null;
    }

    // find returns the first matching entry, or undefined when none matches. Check for
    // that missing result before using its fields.
    const focused = living.find((enemy) => enemy.id === this.focusTargetId);
    const ordered = this.getLivingEnemies().find((enemy) => enemy.id === this.attackTargets.get(unit.id));
    if (ordered) return ordered;
    if (remember) this.attackTargets.delete(unit.id);

    if (focused) return focused;

    // Rescue an ally before building more threat on a safely controlled boss. Explicit
    // Attack and Focus orders above still select exactly the enemy the player chose.
    if (unit.role === 'Tank') {
      const cluster = this.classAbilitySystem?.replacement?.roarPursuitTarget(unit, this.time.now);
      if (cluster) {
        if (remember) unit.autoTargetId = cluster.id;
        return cluster;
      }
      const endangered = living.filter(enemy => enemy.currentTargetId && enemy.currentTargetId !== unit.id
        && this.partyUnits.some(ally => ally.id === enemy.currentTargetId && ally.alive && ally.role !== 'Tank'));
      if (endangered.length) {
        endangered.sort((a, b) => {
          const first = this.partyUnits.find(ally => ally.id === a.currentTargetId);
          const second = this.partyUnits.find(ally => ally.id === b.currentTargetId);
          return first.hp / first.maxHp - second.hp / second.maxHp || unit.distanceTo(a) - unit.distanceTo(b);
        });
        if (remember) unit.autoTargetId = endangered[0].id;
        return endangered[0];
      }
    }

    // sort rearranges this array in place. A negative comparator result puts a before b;
    // positive puts it after; zero keeps them tied.
    const best = living.sort((a, b) => {

      const guardians = ['elderSlime', 'voidKeeperGuardian'];
      const bossPriority = Number(b.isBoss || guardians.includes(b.enemyType))
        - Number(a.isBoss || guardians.includes(a.enemyType));
      if (bossPriority !== 0) {
        return bossPriority;
      }

      return unit.distanceTo(a) - unit.distanceTo(b);
    })[0];

    // Keep an automatic target unless an equally important enemy is meaningfully closer.
    // Small distance changes in a melee crowd should not send a unit back and forth.
    const previous = living.find(enemy => enemy.id === unit.autoTargetId);
    const priority = enemy => Number(enemy.isBoss || ['elderSlime', 'voidKeeperGuardian'].includes(enemy.enemyType));
    const target = previous && priority(previous) >= priority(best)
      && unit.distanceTo(previous) <= unit.distanceTo(best) + 80 ? previous : best;
    if (remember) unit.autoTargetId = target.id;
    return target;
  }

  // This helper chooses what one living adventurer does next. Passive effects run first,
  // followed by player-directed movement and eligible hazard avoidance; the remaining
  // decisions come from the unit's combat role.
  updatePartyUnit(unit, time, deltaSeconds) {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    if (!unit?.alive) return;

    // ??= fills a missing value once. It leaves an existing value, including zero or
    // false, alone.
    this.classAbilitySystem ??= new ClassAbilitySystem(this);
    this.classAbilitySystem.tick(unit, time);
    if (unit.pendingAction?.intervene) return;
    if (this.applyManualMovement(unit, deltaSeconds)) return;

    if (!this.isPositionLocked(unit) && this.tryEvadeTelegraph(unit, deltaSeconds)) return;

    // Take a short escape step before deciding an action. Ready spells should not keep
    // a fragile unit stationary forever, and escape still permits an urgent heal.
    const escaped = !this.isPositionLocked(unit) && unit.canStartAction(time)
      && (this.movement.tryEscapeCrowd(unit, deltaSeconds)
        || this.movement.tryReturnToInterior?.(unit, time, deltaSeconds));
    this.classAbilitySystem.update(unit, time, deltaSeconds, escaped);
  }

  // Melee reach is measured from centers in the combat data. Extend it only by the shared
  // visual-clearance allowance so a readable melee slot can still resolve its attack
  // without changing ranged combat ranges.
  isWithinAttackReach(attacker, target, padding = 0) {

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    const meleePadding = this.movement.isMeleeUnit(attacker) ? combatSpacing.meleeReachPadding : 0;
    return attacker.distanceTo(target) <= attacker.attackRange + meleePadding + padding;
  }

  // This helper raises the tank above each target's existing threat and redirects it
  // immediately. Canceling its old action prevents a queued attack from still hitting the
  // ally the taunt just protected.
  applyTankTaunt(tank, enemies, key, time, commit = true, resolvedAbility = tank.abilities[key]) {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    tank.spriteVisual?.play('block', enemies[0]);

    if (commit) {
      tank.markAbilityUsed(key, time);
      this.announceAbility(tank, tank.abilities[key].name, '#fde68a');
    }
    const affected = [];
    enemies.forEach((enemy) => {

      const table = this.enemyThreat.get(enemy.id);
      if (!table || !enemy.alive) return;

      // Immunity prevents the threat lift, forced target and action release together.
      // Ordinary offensive/intent threat has its own path and remains legal on bosses.
      if (!canTankTaunt(enemy)) {
        this.combatLog?.diagnostics?.control(enemy, resolvedAbility, 'taunt', false, 'taunt_immune', 0, tank);
        return;
      }
      affected.push(enemy);

      // Math.max chooses the largest value; pairing it with Math.min can keep a result
      // inside both a lower and an upper bound. ... expands these entries into the new
      // list or call. It does not deep-copy the objects inside.
      const highest = Math.max(0, ...table.values());

      // ?? uses the fallback only for null or undefined. A real zero or false stays
      // intact.
      table.set(tank.id, highest * (1 + (resolvedAbility.threatBonus ?? 0)) + 1);
      enemy.engagedByTank = true;
      if (resolvedAbility.duration) {
        enemy.status.forcedApproach = resolvedAbility.farthest === true;
        enemy.status.forcedTargetId = tank.id;
        enemy.status.forcedTargetUntil = time + resolvedAbility.duration;
      }

      const tauntCause = this.combatLog?.diagnostics?.control(enemy, resolvedAbility, 'taunt', true, 'taunt_applied', resolvedAbility.duration ?? 0, tank);
      enemy.finishAction('cancelled', 'target_changed', 'Taunt explicitly releases the previous action', { cause: tauntCause });

      // filter keeps entries whose callback returns true. It builds a new list and leaves
      // the original list in place.
      this.activeTelegraphs.filter((telegraph) => telegraph.attacker === enemy)
        .forEach((telegraph) => this.removeTelegraph(telegraph));
      this.setEnemyTarget(enemy, tank, 'taunt_applied');
    });
    return affected;
  }

  // This helper drives enemy targeting, abilities, movement, and basic attacks.
  updateEnemies(time, deltaSeconds) {

    this.getLivingEnemies().forEach((enemy) => {

      enemy.regenMana(deltaSeconds);

      // ?? uses the fallback only for null or undefined. A real zero or false stays
      // intact.
      if (time < (enemy.status.stunnedUntil ?? 0)) return;
      const target = this.getHighestThreatTarget(enemy);
      if (!target) {
        this.setEnemyTarget(enemy, null);
        return;
      }

      if (!enemy.isBusy(time)) this.setEnemyTarget(enemy, target, 'highest threat');

      if (enemy.status.forcedApproach && time < enemy.status.forcedTargetUntil && enemy.distanceTo(target) > 90) {
        if (!enemy.isBusy(time)) enemy.moveToward(target.arenaX, target.arenaY, deltaSeconds, 85);
        return;
      }

      // Ranged monsters can take a safety step before choosing a spell, just like the
      // party. Melee monsters keep their shared approach slots instead of fleeing.
      const escaped = enemy.canStartAction(time) && this.movement.tryEscapeCrowd?.(enemy, deltaSeconds);

      // Check skills in priority order. Only a monster with the authored boss flag gets
      // the third slot. A skipped or cooling-down skill lets the next slot be considered.
      const abilityKeys = enemy.isBoss ? ['primary', 'secondary', 'tertiary'] : ['primary', 'secondary'];

      // Recovery takes precedence when allies are actually injured. Damage skills keep
      // their authored slot order whenever no useful healing opportunity exists.
      if (this.getLivingEnemies().some(ally => ally.hp / ally.maxHp < 0.85)) {
        abilityKeys.sort((a, b) => Number(enemy.abilities[b]?.effect === 'heal')
          - Number(enemy.abilities[a]?.effect === 'heal'));
      }
      for (const key of abilityKeys) {
        if (this.tryEnemyAbility(enemy, target, key, time)) return;
      }

      if (!escaped) this.movement.moveToCombatPosition(enemy, target, time, deltaSeconds);

      if (this.isWithinAttackReach(enemy, target, 8) && enemy.canAttack(time)) {

        // The condition before ? chooses the first value when true and the value after :
        // when false.
        this.beginBasicAttack(enemy, target, time, enemy.basicAttackDamageType === 'spell' ? 'spell' : 'enemy');
      }
    });
  }

  // Start one ready monster skill using its effect and targeting data. Returning true
  // prevents the enemy from starting another skill or a basic attack in the same update.
  tryEnemyAbility(enemy, target, key, time) {
    const ability = enemy.abilities?.[key];
    if (!ability || !enemy.abilityReady(key, time)) return false;

    if (ability.effect === 'heal') {

      // Compare injured health fractions, so a large boss is not favored just because
      // its missing health is a bigger number. Full-health and dead enemies are skipped.
      // filter builds the injured list; sort puts the smallest hp / maxHp fraction first.
      const injured = this.getLivingEnemies().filter(unit => unit.hp / unit.maxHp < 0.85
        && enemy.distanceTo(unit) <= (ability.castRange ?? Number.MAX_SAFE_INTEGER)
        && this.getLivingEnemies().reduce((sum, other) => sum
          + (other.pendingAction?.healingReservations?.[unit.id] ?? 0), 0) < unit.maxHp - unit.hp)
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (!injured) { this.combatLog?.diagnostics?.reject(enemy, ability, 'no_eligible_injured_recipient'); return false; }
      this.beginEnemyAbility(enemy, injured, key, time);
    } else if (ability.telegraph) {

      // castRange is measured in logical arena units. Existing ground attacks keep their
      // 220-unit reach when no override is authored. Each slot pays its own cooldown.
      if (enemy.distanceTo(target) > (ability.castRange ?? 220)) { this.combatLog?.diagnostics?.reject(enemy, ability, 'target_out_of_range'); return false; }
      this.beginGroundSlam(enemy, target, time, ability, key);
    } else {

      // Explicit cast reach gates short strikes. Skills without it still track a target
      // anywhere in the arena, as the workbook's no-range-gate attacks request.
      if (enemy.distanceTo(target) > (ability.castRange ?? Number.MAX_SAFE_INTEGER)) { this.combatLog?.diagnostics?.reject(enemy, ability, 'target_out_of_range'); return false; }
      this.beginEnemyAbility(enemy, target, key, time);
    }

    return true;
  }

  // This helper checks the exact action instance before a delayed effect resolves. Dead
  // targets release the actor, while callbacks from canceled actions cannot finish or
  // resolve a newer action with the same name.
  isActionCurrent(unit, action, target = null) {

    if (unit.pendingAction !== action) return false;

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    if (!unit.alive || this.battleOver || this.time.now < (unit.status?.stunnedUntil ?? 0) || (target && (!target.alive || (unit.isEnemy && target.stealthed)))) {
      unit.finishAction('cancelled', !unit.alive ? 'caster_died' : this.battleOver ? 'state_invalidated' : this.time.now < (unit.status?.stunnedUntil ?? 0) ? 'stun' : !target?.alive ? 'target_died' : 'state_invalidated', 'Delayed action validity check rejected the pending action');
      return false;
    }

    return true;
  }

  // This helper winds up a basic attack and rechecks its target before the hit.
  beginBasicAttack(attacker, target, time, attackType) {

    // some stops with true as soon as one entry passes the check; an empty list gives
    // false.
    if (attacker.role === 'Healer' && this.partyUnits.some(unit => unit.alive && unit.hp / unit.maxHp < 0.8)) return;
    if (!attacker.startAction('Attack', time, attacker.attackWindup, target, { id: 'basic_attack' })) {
      return;
    }

    attacker.lastAttackAt = time;
    attacker.pendingAction.replacementBasic = this.classAbilitySystem?.replacement?.basicPreparation(attacker);

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    attacker.spriteVisual?.play(attacker.id === 'valtheris' && attackType === 'spell' ? 'cast' : 'attack', target);
    if (attacker.isEnemy) this.setEnemyTarget(attacker, target, 'highest threat');
    this.logActionStart(attacker, target, 'Attack');
    const action = attacker.pendingAction;

    // Ranged basic attacks travel during the existing windup, arriving at the
    // scheduled hit. Melee attacks do not acquire a projectile just from range.
    this.startRangedTravel(attacker, target, { name: 'Attack', attackType }, action);
    this.scheduleBattleEvent(attacker.attackWindup, this.actionEvent('attack', attacker, target, { attackType }),
      () => this.resolveBasicAttack(attacker, action, target, attackType));
  }

  // Detect paused or decision states that should not accumulate autonomous combat work.
  isWaitingForPlayer() {
    return this.battleOver || this.combatPaused || this.awaitingRevive || GameState.run.entry === 'camp';
  }

  // Resolve the scheduled basic hit only if its action and target remain valid.
  resolveBasicAttack(attacker, action, target, attackType) {
    this.finishRangedTravel(attacker, action);

    if (!this.isActionCurrent(attacker, action, target)) return;

    // some stops with true as soon as one entry passes the check; an empty list gives
    // false.
    if (attacker.role === 'Healer' && this.partyUnits.some(unit => unit.alive && unit.hp / unit.maxHp < 0.8)) {
      attacker.finishAction('cancelled', 'state_invalidated', 'Healer prioritizes an injured ally over its pending attack');
      return;
    }

    const diagnosticInReach = this.isWithinAttackReach(attacker, target, 28);
    if (diagnosticInReach) {

      // The condition before ? chooses the first value when true and the value after :
      // when false.
      const forced = attacker.status.replacementForcedAttack;
      const power = forced?.until > this.time.now ? attacker.attackPower * forced.fraction
        : attacker.isEnemy && attacker.basicAttackDamageType === 'spell' ? (attacker.spellPower ?? attacker.spellDamage) : attacker.attackPower;
      this.resolveDamage(attacker, target, power * (action.replacementBasic?.multiplier ?? 1), attackType, attacker.threatMultiplier, 'Attack', true,
        { hasArtwork: this.hasRangedTravel(attacker, 'Attack') });
      if (forced) attacker.status.replacementForcedAttack = null;
    }
    attacker.finishAction(diagnosticInReach ? 'resolved' : 'failed', diagnosticInReach ? 'completed' : 'target_out_of_range', 'Basic attack resolution callback completed; damage event establishes whether a hit occurred');
  }

  // A healer's basic action pays Mana to restore a small amount to one injured ally.
  beginBasicHeal(healer, target, time) {
    if (!target.alive || target.hp >= target.maxHp || !healer.canHeal(time)
      || this.classAbilitySystem.distance(healer, target) > healer.basicHealRange
      || !healer.startAction('Mend', time, healer.healWindup, target, { id: 'basic_heal' })) return;


    // Pay once when Mend starts, just like a class spell. Resolution and restored
    // pending actions do not pay again, and an interruption does not refund the cost.
    healer.spendMana(healer.basicHealManaCost ?? 0);
    healer.lastHealAt = time;

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    healer.spriteVisual?.play('block', target);
    this.logActionStart(healer, target, 'Mend');
    const action = healer.pendingAction;

    // Basic Mend sends a small healing light to the ally on the same paused clock.
    this.startRangedTravel(healer, target, { name: 'Mend', recipient: target }, action);

    // Expected healing belongs to this action, so cancellation or death releases it.
    action.healingReservations = { [target.id]: Math.min(target.maxHp - target.hp,
      abilityPower(healer, {}, healer.basicHealPower, true)) };
    this.scheduleBattleEvent(healer.healWindup, this.actionEvent('heal', healer, target),
      () => this.resolveBasicHeal(healer, action, target));
  }

  // Resolve the scheduled heal against the eligible ally and record actual restored HP.
  resolveBasicHeal(healer, action, target) {
    this.finishRangedTravel(healer, action);
    if (!this.isActionCurrent(healer, action, target)) return;
    const diagnosticCanHeal = target.hp < target.maxHp && this.classAbilitySystem.distance(healer, target) <= healer.basicHealRange;
    if (diagnosticCanHeal) {
      this.resolveHeal(healer, target, abilityPower(healer, {}, healer.basicHealPower, true), 'Mend', true, healer !== target);
    }
    healer.finishAction(diagnosticCanHeal ? 'resolved' : 'failed', diagnosticCanHeal ? 'completed' : target.hp >= target.maxHp ? 'no_missing_health' : 'target_out_of_range', 'Mend resolution eligibility checked');
  }

  // This helper announces an enemy cast and resolves it if the action remains valid.
  beginEnemyAbility(attacker, target, key, time) {

    const ability = attacker.abilities[key];
    if (!ability || !attacker.startAction(ability.name, time, ability.windup, target, ability)) {
      return;
    }

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.

    // The supplied void boards distinguish ranged casting and leaping from melee.
    // This chooses only the visible clip; the existing windup and damage still apply.
    attacker.spriteVisual?.play(ability.animation ?? 'attack', target);
    this.announceAbility(attacker, ability.name, '#c084fc');

    // Long boss casts use the shared banner while the normal cast bar counts down.
    // Include authored response guidance when the ability supplies it.
    this.announceBossCast(attacker, ability, ability.windup);
    if (ability.effect !== 'heal') this.setEnemyTarget(attacker, target, 'highest threat');
    this.logActionStart(attacker, target, ability.name);
    attacker.markAbilityUsed(key, time);

    const action = attacker.pendingAction;
    if (ability.effect === 'heal') action.healingReservations = {
      [target.id]: Math.min(target.maxHp - target.hp, abilityPower(attacker, ability, ability.power, true))
    };

    // The glob flies during this existing windup and arrives when the scheduled hit resolves.
    if (!this.add?.image || !startSlimeGlobFlight(this, attacker, target, ability, action)) {
      this.startRangedTravel(attacker, target, ability, action);
    }
    this.scheduleBattleEvent(ability.windup, this.actionEvent('enemyAbility', attacker, target, { key }),
      () => this.resolveEnemyAbility(attacker, action, target, ability));
  }

  // Apply the scheduled enemy skill through the shared targeting and combat effect rules.
  resolveEnemyAbility(attacker, action, target, ability) {
    this.finishRangedTravel(attacker, action);

    if (!this.isActionCurrent(attacker, action, target)) return;

    if (this.slimeGlobFlights?.length) landSlimeGlobFlight(this, attacker, action);

    // Thornbriar and Slime Cave use their own skill art; other delves keep shared feedback.
    const hasThornbriarImpact = this.isThornbriarHollow
      && ['Whip Lash', 'Bramble Shroud', 'Briar Bolt'].includes(ability.name);
    if (hasThornbriarImpact) startThornbriarAbilityEffect(this, attacker, target, ability, 'impact');
    else if (this.add?.image && playSlimeAbilityEffect(this, ability.name, target,
      ability.name === 'Crushing Slime Slam' ? 100 : 0)) {

      // The glob splashes on contact; the Sovereign's short slam stays a close ground impact.
    }
    else if (ability.animation === 'leap') this.createMeleePulse(target, 0xa855f7);
    else if (!this.hasRangedTravel(attacker, ability.name)) this.createMeleePulse(target, 0xa855f7);
    if (ability.effect === 'heal') {
      this.resolveHeal(attacker, target, abilityPower(attacker, ability, ability.power, true), ability.name);
    } else {

      // The condition before ? chooses the first value when true and the value after :
      // when false.
      this.resolveDamage(attacker, target, abilityPower(attacker, ability),
        ability.damageType === 'physical' ? 'enemy' : 'spell', 1, ability.name, true,
        { hasArtwork: hasThornbriarImpact || this.hasRangedTravel(attacker, ability.name) });
    }

    attacker.finishAction('resolved', 'completed', 'Enemy ability resolution completed');
  }

  // Start an enemy area attack and draw a warning at its authored center. After the
  // warning delay, damage living party members still inside that fixed area.
  beginGroundSlam(attacker, target, time, ability, key = 'primary') {

    if (!attacker.startAction(ability.name, time, ability.telegraph, target, ability)) {
      return;
    }

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.

    // Area clips show the creature gathering energy while the warning is active.
    // Monsters without a separate area sheet keep their established attack clip.
    attacker.spriteVisual?.play(ability.animation ?? 'attack', target);
    this.announceAbility(attacker, ability.name, '#f87171');

    // Keep the response instructions separate from the ability name used in combat logs.
    this.announceBossCast(attacker, ability, ability.telegraph);
    this.setEnemyTarget(attacker, target, 'highest threat');
    this.logActionStart(attacker, target, ability.name);

    // Existing callers default to primary. Other slots must record their own cooldown
    // and mana cost so they remain independent during visible and saved idle combat.
    attacker.markAbilityUsed(key, time);

    // areaCenter: 'caster' surrounds the monster, as Consume does. The default still
    // surrounds the threat target. Capture the cast-start position so players can leave
    // the warning. Windup and telegraph describe this same cast, not two added waits.
    const origin = ability.areaCenter === 'caster' ? attacker : target;
    const center = { arenaX: origin.arenaX, arenaY: origin.arenaY };
    if (this.isThornbriarHollow) startThornbriarAbilityEffect(this, attacker, target, ability, 'cast',
      this.battlefield.arenaToScreen(center.arenaX, center.arenaY));
    const telegraph = this.createSlamTelegraph(attacker, ability, center, ability.telegraph);
    const action = attacker.pendingAction;
    this.startRangedTravel(attacker, { ...center, alive: true, groundDestination: true }, ability, action);
    this.scheduleBattleEvent(ability.telegraph, this.actionEvent('groundSlam', attacker, null, { center, ability }),
      () => this.resolveGroundSlam(attacker, action, center, ability, telegraph));
  }

  // Draw the warning area for the pending slam so the player can move before it resolves.
  createSlamTelegraph(attacker, ability, center, duration) {
    const screenCenter = this.battlefield.arenaToScreen(center.arenaX, center.arenaY);
    const radii = this.battlefield.getGroundEllipseRadii(ability.radius, center.arenaY);

    // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
    // lower-depth objects.
    const warning = this.add.ellipse(screenCenter.x, screenCenter.y, radii.width * 2, radii.height * 2, 0xef4444, 0.14)
      .setStrokeStyle(8, 0xf87171, 0.88)
      .setDepth(40 + screenCenter.y);
    const inner = this.add.ellipse(screenCenter.x, screenCenter.y, 32, 16, 0xf87171, 0.35)
      .setDepth(41 + screenCenter.y);

    // Register the warning in arena coordinates for automatic hazard avoidance.
    const telegraph = {
      arenaX: center.arenaX,
      arenaY: center.arenaY,
      radius: ability.radius,

      // Most warnings allow normal mechanic avoidance. Authored boss mechanics can ask
      // for a player response by disabling automatic dodging while keeping manual movement.
      autoAvoid: ability.autoAvoid ?? true,
      warning,
      inner,
      attacker,
      action: attacker.pendingAction,
      ability,
      duration
    };

    this.activeTelegraphs.push(telegraph);
    if (!this.restoringBattle) warningStarted(this, telegraph);

    // The Sovereign lobs its glob at the saved warning center, so movement can escape it.
    startSlimeGlobFlight(this, attacker, null, ability, attacker.pendingAction, center);

    if (!['Slime Slam', 'Crushing Slime Slam', 'Toxic Glob', 'Consume'].includes(ability.name)) {
      this.tweens.add({
        targets: inner,
        displayWidth: radii.width * 2,
        displayHeight: radii.height * 2,
        alpha: 0.08,
        duration,
        ease: 'Linear'
      });
    }

    return telegraph;
  }

  // Resolve a saved strike against current positions and remove its warning.
  resolveGroundSlam(attacker, action, center, ability, telegraph) {
    this.finishRangedTravel(attacker, action);

    if (!this.isActionCurrent(attacker, action)) {
      this.removeTelegraph(telegraph);
      return;
    }

    warningResolved(this, action);
    const hasThornbriarImpact = this.isThornbriarHollow
      && startThornbriarAbilityEffect(this, attacker, attacker, ability, 'impact',
      this.battlefield.arenaToScreen(center.arenaX, center.arenaY));

    landSlimeGlobFlight(this, attacker, action);

    // Start the impact before damage can end the battle, including a lethal boss glob.
    const hasSlimeImpact = playSlimeAbilityEffect(this, ability.name, center, ability.radius);

    // filter keeps entries whose callback returns true. It builds a new list and leaves
    // the original list in place.
    this.partyUnits.filter((unit) => unit.alive).forEach((unit) => {

      if (unit.distanceToPoint(center.arenaX, center.arenaY) <= ability.radius) {

        // The condition before ? chooses the first value when true and the value after :
        // when false.
        this.resolveDamage(attacker, unit, abilityPower(attacker, ability),
          ability.damageType === 'physical' ? 'enemy' : 'spell', 1, ability.name, ability.allowCrit ?? false,
          { area: true, hasArtwork: hasThornbriarImpact || hasSlimeImpact });

        // Stomp and Belch stun surviving characters for three seconds. Use the unit's
        // shared status timer so pause, saved battles and idle catch-up see the same stun.
        if (unit.alive && ability.stunDuration) {
          const stunCause = this.combatLog?.diagnostics?.control(unit, ability, 'stun', true, 'applied', ability.stunDuration, attacker);
          unit.status.stunnedUntil = Math.max(unit.status.stunnedUntil ?? 0, this.time.now + ability.stunDuration);
          unit.finishAction('interrupted', 'stun', 'Ground attack applied stun', { cause: stunCause });
        }
      }
    });

    const screenCenter = this.battlefield.arenaToScreen(center.arenaX, center.arenaY);
    const radii = this.battlefield.getGroundEllipseRadii(ability.radius, center.arenaY);

    // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
    // lower-depth objects.
    if (!hasSlimeImpact && !hasThornbriarImpact) {
      const burst = this.add.ellipse(screenCenter.x, screenCenter.y, radii.width * 0.8, radii.height * 0.8, 0xef4444, 0.42)
        .setDepth(45 + screenCenter.y);
      this.tweens.add({
        targets: burst,
        displayWidth: radii.width * 2.6,
        displayHeight: radii.height * 2.6,
        alpha: 0,
        duration: 260,

        // Finish this animation's remaining work when the tween reaches its end.
        onComplete: () => burst.destroy()
      });
    }

    this.removeTelegraph(telegraph);
    attacker.finishAction('resolved', 'completed', 'Area attack resolution completed');
  }

  // This helper lets eligible units abandon their action to escape a ground warning.
  tryEvadeTelegraph(unit, deltaSeconds) {

    if (!this.tactics.shouldAvoidMechanics(unit) || !unit.alive || this.activeTelegraphs.length === 0) {
      return false;
    }

    // find returns the first matching entry, or undefined when none matches. Check for
    // that missing result before using its fields.
    // Missing autoAvoid fields in older saved warnings retain the usual avoidance rule.
    const danger = this.activeTelegraphs.find((telegraph) => telegraph.autoAvoid !== false
      && unit.distanceToPoint(telegraph.arenaX, telegraph.arenaY) < telegraph.radius + 40);
    if (!danger) {
      return false;
    }

    unit.finishAction('cancelled', 'movement_cancelled', 'AI abandons action to evade a ground warning');
    const warnings = this.activeTelegraphs.filter(warning => warning.autoAvoid !== false);
    const destination = this.movement.getEscapePoint(unit, warnings);
    return destination ? unit.moveToward(destination.x, destination.y, deltaSeconds, 6) : false;
  }

  // This helper retires a ground warning from both the display and hazard tracking.
  removeTelegraph(telegraph) {
    if (!telegraph) return;

    this.tweens.killTweensOf(telegraph.inner);

    // filter keeps entries whose callback returns true. It builds a new list and leaves
    // the original list in place.
    this.activeTelegraphs = this.activeTelegraphs.filter((item) => item !== telegraph);
    for (const unit of this.partyUnits) if (unit.manualWarningEscapes)
      delete unit.manualWarningEscapes[telegraph.action?.castId];

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    if (!fadeSlimeTelegraph(this, telegraph)) {
      telegraph.warning?.destroy();
      telegraph.inner?.destroy();
    }
  }

  // This helper rolls the attacker critical chance when the action allows it.
  rollCritical(attacker, allowCrit = true, target = null) {

    // The condition before ? chooses the first value when true and the value after : when
    // false. ?? uses the fallback only for null or undefined. A real zero or false stays
    // intact.
    const bonus = this.time.now < (attacker.status.abilityCritUntil ?? 0) ? attacker.status.abilityCritBonus ?? 0 : 0;

    // Math.min chooses the smallest value; pairing it with Math.max can keep a result
    // inside both a lower and an upper bound.
    return allowCrit && this.combatRandom() < Math.min(attacker.statProgressionVersion === 2 ? 0.4 : 0.95,
      (attacker.critChance ?? 0) + bonus + equipmentPerkBonus(attacker, 'crit', target) + replacementChance(attacker, 'crit', this.time.now)
        + (attacker.pendingAction?.replacementBasic?.criticalBonus ?? 0));
  }

  // This helper resolves an attack from its base damage through critical hits, status
  // effects, and the target defenses. It updates combat timestamps, threat, visual
  // feedback, and the log, then handles any resulting defeat.
  resolveDamage(attacker, target, baseAmount, attackType, threatMultiplier = 1, abilityName = 'Attack', allowCrit = true, contact = null) {

    // Optional cosmetic feedback distinguishes a dodge from a shielded hit, which
    // both return zero damage. Existing callers still receive the same damage value.
    if (contact) contact.hit = false;

    // Area hits and delayed attacks can reach untouched enemies. Their actual damage
    // contributes threat below, whether or not the tank has made contact yet.
    const now = this.time.now;

    // Resolve blindness before damage modifiers; a miss stops the rest of the hit
    // processing.
    const accuracy = Math.max(0, hitAccuracy(attacker) + replacementChance(attacker, 'hit', now));

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    if (attackType !== 'reflection' && !contact?.periodic && !contact?.redirected && (accuracy < (target.minimumAccuracy ?? 0) || accuracy < 1 && this.combatRandom() >= accuracy
      || now < (attacker.status.blindUntil ?? 0) && this.combatRandom() < (attacker.status.blindChance ?? 0))) {
      this.createFloatingText(target.x, target.y - 82, 'MISS', '#cbd5e1', false, 'miss');

      // ?. only follows this link when the value exists; a missing optional value gives
      // undefined.
      this.combatLog?.add('miss', `${attacker.name}'s ${abilityName} missed ${target.name}`, {
        wave: this.currentWaveIndex + 1,
        actorId: attacker.id, targetId: target.id,
        sourceActionId: this.combatLog?.diagnostics?.context?.sourceActionId ?? null,
        actor: attacker.name,
        target: target.name,
        ability: abilityName
      });

      return;
    }

    const interceptor = target.status.interceptSource;

    // Replacement interception redirects one ordinary target hit. Area hits retain
    // every recipient, and the redirect keeps the original confirmed accuracy check.
    const guard = target.status.replacementIntercept;
    const guardUnit = guard && this.partyUnits.find(unit => unit.id === guard.ownerId && unit.alive);
    if (attacker.isEnemy && guardUnit && guardUnit !== target && guard.until > now && !contact?.area && !contact?.redirected) {
      guard.until = 0;
      const intercepted = { ...contact, redirected: true, interceptReduction: guard.reduction };
      const redirectedDamage = this.resolveDamage(attacker, guardUnit, baseAmount, attackType, threatMultiplier, abilityName, allowCrit,
        intercepted) ?? 0;
      if ([INTERPOSE, INTERVENE].includes(guard.abilityId) && intercepted.hit) {
        const threat = reactiveTankThreat(this, guardUnit, attacker, intercepted.preMitigationDamage ?? 0, INTERCEPT_THREAT_FRACTION);
        this.combatLog?.diagnostics?.emit('tank_interception', { actorId: guardUnit.id, targetId: target.id,
          attackerId: attacker.id, abilityId: guard.abilityId, sourceActionId: guard.sourceActionId ?? null,
          reduction: guard.reduction, damage: redirectedDamage, threat, cause: this.combatLog?.diagnostics?.context });
      }
      return 0;
    }
    if (attacker.isEnemy && interceptor?.alive && interceptor !== target
      && now < (target.status.interceptUntil ?? 0)) {
      target.status.interceptUntil = 0;
      target.status.interceptSource = null;
      this.resolveDamage(attacker, interceptor, baseAmount, attackType, threatMultiplier, abilityName, allowCrit);

      return 0;
    }

    // Roll the critical result and apply outgoing damage bonuses or penalties.
    const guaranteedAbilityCritical = allowCrit && attacker.status.nextAbilityCrit === true && abilityName !== 'Attack';
    const critical = guaranteedAbilityCritical || this.rollCritical(attacker, allowCrit, target);
    if (guaranteedAbilityCritical) attacker.status.nextAbilityCrit = false;

    if (attacker.status.abilityCritOnce) {
      attacker.status.abilityCritUntil = 0;
      attacker.status.abilityCritOnce = false;
    }

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    let amount = Math.round(baseAmount * (critical ? attacker.critMultiplier : 1));
    const physicalPower = ['melee', 'ranged', 'enemy', 'reflection'].includes(attackType);

    // Basic attacks and spell hits remain separate scopes. Reflections are already
    // derived from another hit and must not collect the outgoing bonus twice.
    amount *= 1 + equipmentPerkBonus(attacker, 'damage', target, this.partyUnits, {
      basic: abilityName === 'Attack' && !contact?.periodic,
      spell: !physicalPower, reflection: attackType === 'reflection'
    });
    amount *= Math.max(0, 1 - equipmentPerkBonus(target, 'reduction'));

    // A reflected or damage-linked amount is already measured from a resolved hit.
    // Scaling it by the power stat again would change its stated percentage of that hit.
    if (!contact?.measured) amount *= Math.max(0, replacementMultiplier(attacker, physicalPower ? 'attack' : 'spell', now));
    amount *= Math.max(0, replacementMultiplier(attacker, 'damage', now));
    if (attackType !== 'reflection' && attacker.status.nextAttackBoost) {
      amount = Math.round(amount * (1 + attacker.status.nextAttackBoost));
      attacker.status.nextAttackBoost = 0;
    }

    if (attackType !== 'reflection' && !attacker.isEnemy && now < (attacker.status.damageBoostUntil ?? 0)) {
      amount = Math.round(amount * (1 + (attacker.status.damageBoost ?? 0)));
    }

    if (attacker.isEnemy && now < (attacker.status.outgoingDamageReductionUntil ?? 0)) {

      // Math.max chooses the largest value; pairing it with Math.min can keep a result
      // inside both a lower and an upper bound.
      amount = Math.round(amount * Math.max(0, 1 - (attacker.status.outgoingDamageReduction ?? 0)));
    }

    if (now < (attacker.status.enrageUntil ?? 0)) amount = Math.round(amount * attacker.status.enrageDamage);
    else if (now < (attacker.status.exhaustedUntil ?? 0)) amount = Math.round(amount * attacker.status.exhaustedDamage);
    if (attackType !== 'reflection' && now < (attacker.status.honorDamageUntil ?? 0)) amount = Math.round(amount * (1 + attacker.status.honorDamageBoost));

    if (!attacker.isPartyLeader && attackType !== 'reflection' && !attacker.isEnemy && now < this.assaultUntil) amount = Math.round(amount * (1 + this.assaultBonus));
    if (!attacker.isPartyLeader && !attacker.isEnemy && attacker.role !== 'Healer' && target.id === this.focusDamageTargetId
      && now < (this.focusDamageUntil ?? 0)) {
      amount = Math.round(amount * 1.05);
    }

    if (attacker.isEnemy && !target.isEnemy && now < this.braceUntil) amount = Math.max(1, Math.round(amount * (1 - this.braceReduction)));

    // This echo is a fraction of damage already dealt by the basic hit. Do not apply
    // the wielder's outgoing bonuses again; the recipient still has its own defenses.
    if (contact?.runicEcho) amount = baseAmount;

    // Let the target apply its defenses, then measure actual health loss for the combat
    // log.
    const ranged = attackType === 'spell' || attackType === 'ranged' || attacker.attackRange > 180;
    if (now < (target.status.immuneUntil ?? 0)) {
      this.createFloatingText(target.x, target.y - 82, 'IMMUNE', '#fde68a');
      return 0;
    }
    const temporaryDodge = attacker.isEnemy && now < (target.status.abilityDodgeUntil ?? 0)
      && (!target.status.abilityDodgeRangedOnly || attackType === 'ranged' || attackType === 'spell' || attacker.attackRange > 180)
      ? target.status.abilityDodgeChance ?? 0 : 0;

    if (attackType !== 'reflection' && attacker !== target && target.statProgressionVersion === 2
      && !contact?.periodic && this.combatRandom() < Math.min(0.3, (target.dodge ?? 0) + temporaryDodge + equipmentPerkBonus(target, 'dodge') + replacementChance(target, 'dodge', now))) {
      this.createFloatingText(target.x, target.y - 82, 'DODGE', '#cbd5e1', false, 'miss');
      return 0;
    }

    if (target.statProgressionVersion !== 2 && attacker.isEnemy && now < (target.status.abilityDodgeUntil ?? 0)
      && (!target.status.abilityDodgeRangedOnly || attackType === 'ranged' || attackType === 'spell' || attacker.attackRange > 180)
      && this.combatRandom() < (target.status.abilityDodgeChance ?? 0)) return 0;

    if (attacker.isEnemy && this.classAbilitySystem?.tryParry(target, attacker, amount, now)) return 0;
    const physical = ['melee', 'ranged', 'enemy', 'reflection'].includes(attackType);
    const leaderBlock = now < (target.status.leaderBlockUntil ?? 0) ? target.status.leaderBlockBonus ?? 0 : 0;
    const armorBlocked = physical && attackType !== 'reflection' && attacker !== target
      && target.statProgressionVersion === 2 && this.combatRandom() < cappedChance('block', (target.block ?? 0) + leaderBlock + equipmentPerkBonus(target, 'block') + replacementChance(target, 'block', now));
    const hpBefore = target.hp;

    // Accuracy, dodge and parry checks have passed. The projectile touched its target
    // even if the defenses below absorb all of the damage.
    if (contact) { contact.hit = true; contact.preMitigationDamage = amount; }
    target.takeDamage(amount, { time: now, ranged, attacker, physical, armorBlocked,
      periodic: contact?.periodic, reflection: attackType === 'reflection',
      suppressHitReaction: contact?.suppressHitReaction,
      armorPiercing: contact?.armorPiercing, interceptReduction: contact?.interceptReduction,
      blocked: armorBlocked || (!target.isEnemy && now < this.braceUntil)
        || now < (target.status.shieldUntil ?? 0)
        || now < (target.status.damageReductionUntil ?? 0) });

    const actualDamage = hpBefore - target.hp;

    // Only a critical that actually takes HP starts the shock animation. Misses,
    // immunity and fully absorbed hits do not bounce. Replayed background hits keep
    // their real damage but skip historical visual reactions when catching up.
    if (critical && actualDamage > 0 && !contact?.suppressKnockback) target.playCriticalHit?.(attacker);
    else if (critical) this.combatLog?.diagnostics?.emit('knockback_not_attempted', {
      actorId: attacker.id, targetId: target.id, attempted: false, displaced: false,
      cancelsAction: false, reasonCode: contact?.suppressKnockback ? 'ability_no_control' : 'no_hp_damage', cause: this.combatLog?.diagnostics?.context });
    if (actualDamage > 0 && target.isEnemy && attacker.status.nextPoisonPower) {
      target.status.poison = {
        caster: attacker,
        power: attacker.status.nextPoisonPower,
        interval: 2000,
        next: now + 2000,
        until: now + 6000
      };

      attacker.status.nextPoisonPower = 0;
    }

    // Record recent combat interaction timestamps.
    if (amount > 0) {
      attacker.lastCombatActionAt = now;
      target.lastCombatActionAt = now;
      attacker.lastDealtDamageAt = now;
      target.lastTakenDamageAt = now;
    }

    if (target.isEnemy && now < (target.status.stunnedUntil ?? 0) && now >= (target.status.hardStunUntil ?? 0) && amount > 0) {
      target.status.stunnedUntil = 0;
      this.createFloatingText(target.x, target.y - 96, 'UNFROZEN', '#cbd5e1');
    }

    if (attacker.isEnemy && !target.isEnemy) {
      this.flashPartyHudName(target);
    }

    const flashColor = contact?.partyLeaderTap ? 0xfbbf24 : attackType === 'spell'
      ? 0x60a5fa
      : attackType === 'holy'
        ? 0xfde68a
        : attackType === 'enemy'
          ? 0xf87171
          : 0xffffff;

    target.flash(flashColor);

    if (!attacker.isEnemy && !attacker.isPartyLeader) {
      const threatReduction = now < (attacker.status.threatReductionUntil ?? 0) ? 1 - (attacker.status.threatReduction ?? 0) : 1;
      const preparedThreat = attacker.status.nextThreatBonus ?? 1;
      const normalThreat = amount * threatMultiplier * threatReduction * preparedThreat;
      if (contact) contact.normalThreat = normalThreat;
      this.getLivingEnemies().forEach((enemy) => {

        if (enemy === target) {

          // The condition before ? chooses the first value when true and the value after :
          // when false. ?? uses the fallback only for null or undefined. A real zero or
          // false stays intact.
          this.addThreat(enemy, attacker, normalThreat);
          attacker.status.nextThreatBonus = 1;
        }
      });
    }

    // Record the actual health change alongside the ability, critical result, and current
    // threat snapshot.
    this.combatLog?.add('damage', `${attacker.name} used ${abilityName} on ${target.name} for ${actualDamage}${critical ? ' critical' : ''} damage`, {
      wave: this.currentWaveIndex + 1,
      actorId: attacker.id, targetId: target.id,
      sourceActionId: this.combatLog?.diagnostics?.context?.sourceActionId ?? null,
      actor: attacker.name,
      target: target.name,
      ability: abilityName,
      amount: actualDamage,
      preMitigationDamage: amount,
      effectId: this.combatLog?.diagnostics?.context?.effectId ?? null,
      targetSide: target.isDecoy ? 'decoy' : target.isEnemy ? 'enemy' : 'party',
      critical,
      targetHp: target.hp,
      targetMaxHp: target.maxHp,
      threat: target.isEnemy ? this.getThreatSnapshot(target) : undefined
    });

    if (attacker.isEnemy && target.status.bramble && amount > 0) {
      const bramble = target.status.bramble;
      target.status.bramble = null;
      if (attacker.alive) this.resolveDamage(bramble.caster, attacker, bramble.power, 'spell', 1, 'Bramble Mend', false);
    }

    // Supplied artwork replaces the generic pulse/bolt for these named class skills.
    // Ordinary attacks and skills without authored art keep their familiar feedback.
    if (!contact?.hasArtwork && !this.hasRangedTravel(attacker, abilityName)
      && abilityName === 'Attack' && (attackType === 'spell' || attackType === 'holy' || attackType === 'ranged')) {
      this.createProjectile(attacker, target, attackType === 'holy' ? 0xfde68a : 0x60a5fa);
    } else if (!contact?.hasArtwork && !this.hasRangedTravel(attacker, abilityName)) {
      this.createMeleePulse(target, critical ? 0xfbbf24 : 0xffffff);
    }

    const prefix = critical ? 'CRIT ' : '';

    // Math.ceil rounds the displayed damage up to a whole number without changing combat calculations or logs.
    this.createFloatingText(target.x, target.y - 82,
      contact?.partyLeaderTap ? `${Math.ceil(actualDamage)}` : `${prefix}${Math.ceil(amount)}`,
      contact?.partyLeaderTap ? '#fbbf24' : '#ef4444', critical, contact?.partyLeaderTap ? 'leaderTap' : 'damage');

    // Award a defeated enemy once and record the death after the damage event.
    if (!target.alive && target.isEnemy) {
      this.handleEnemyDeath(target);
    }

    if (hpBefore > 0 && !target.alive) {
      this.combatLog?.add('death', `${target.name} was defeated by ${attacker.name}'s ${abilityName}`, {
        wave: this.currentWaveIndex + 1,
        actorId: attacker.id, targetId: target.id,
        sourceActionId: this.combatLog?.diagnostics?.context?.sourceActionId ?? null,
        actor: attacker.name,
        target: target.name,
      ability: abilityName,
      targetSide: target.isDecoy ? 'decoy' : target.isEnemy ? 'enemy' : 'party', amount: actualDamage,
      hpBefore, targetHp: target.hp, targetMaxHp: target.maxHp
      });
    }

    this.classAbilitySystem?.replacement?.afterDamage(attacker, target, actualDamage, critical, armorBlocked, { ...contact, physical, abilityName });
    this.classAbilitySystem?.replacement?.finishExchange(target);
    return actualDamage;
  }

  // This helper applies a heal, including its critical roll, and measures how much health
  // was actually restored for feedback and the combat log. Effective party healing
  // generates threat on every active enemy, even before the tank reaches that enemy.
  resolveHeal(healer, target, baseAmount, abilityName, allowCrit = true, hasArtwork = false) {

    const critical = this.rollCritical(healer, allowCrit);

    // The condition before ? chooses the first value when true and the value after : when
    // false. ?? uses the fallback only for null or undefined. A real zero or false stays
    // intact.
    const healingBoost = this.time.now < (healer.status.healingBoostUntil ?? 0) ? 1 + healer.status.healingBoost : 1;
    const honorBoost = this.time.now < (healer.status.honorHealingUntil ?? 0) ? 1 + healer.status.honorHealingBoost : 1;
    const targetReduction = this.time.now < (target.status.healingReductionUntil ?? 0) ? 1 - target.status.healingReduction : 1;
    const preparedBoost = healer.status.nextHealBoost ?? 0;
    healer.status.nextHealBoost = 0;
    const gearBoost = (1 + equipmentPerkBonus(healer, 'healing', target))
      * (1 + equipmentPerkBonus(target, 'receivedHealing'));
    const amount = Math.round(baseAmount * healingBoost * honorBoost * targetReduction * gearBoost * (1 + preparedBoost) * (critical ? healer.critMultiplier : 1));
    const before = target.hp;

    target.heal(amount);

    // Display restored health rather than counting overhealing as recovery.
    const effectiveHealing = target.hp - before;

    target.flash(0x86efac);

    // Authored healing columns replace the generic traveling dot. Health text and
    // hit flashes still show the unchanged amount restored by this heal.
    if (!hasArtwork) this.createMeleePulse(target, 0x86efac);
    this.createFloatingText(target.x, target.y - 82, `+${Math.round(effectiveHealing)}${critical ? '!' : ''}`, '#22c55e', critical, 'healing');

    // filter keeps entries whose callback returns true. It builds a new list and leaves
    // the original list in place.
    const engaged = healer.isEnemy ? [] : this.getLivingEnemies();
    engaged.forEach((enemy) => this.addThreat(enemy, healer, effectiveHealing * 0.45));

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    this.combatLog?.add('healing', `${healer.name} used ${abilityName} on ${target.name} for ${effectiveHealing}${critical ? ' critical' : ''} healing`, {
      wave: this.currentWaveIndex + 1,
      actorId: healer.id, targetId: target.id,
      sourceActionId: this.combatLog?.diagnostics?.context?.sourceActionId ?? null,
      effectId: this.combatLog?.diagnostics?.context?.effectId ?? null,
      attemptedHealing: amount, overhealing: Math.max(0, amount - effectiveHealing),
      actor: healer.name,
      target: target.name,
      ability: abilityName,
      amount: effectiveHealing,
      targetSide: target.isEnemy ? 'enemy' : 'party',
      critical,
      targetHp: target.hp,
      targetMaxHp: target.maxHp,
      generatedThreat: engaged.length > 0 ? Math.round(effectiveHealing * 0.45) : 0
    });
  }

  // This helper awards each defeated enemy gold only once.
  handleEnemyDeath(enemy) {

    if (enemy.rewarded) {
      return;
    }
    enemy.rewarded = true;
    const definition = enemy.definition;

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    const minimum = definition.goldMin ?? 0;

    // Math.floor rounds toward the smaller whole number, so 3.8 becomes 3.
    this.earnedGold += minimum + Math.floor(this.combatRandom() * ((definition.goldMax ?? 0) - minimum + 1));

    // Keep the container until the death clip and shared fade/pop finish. Wave cleanup
    // removes it after the animation.
    enemy.hitZone?.disableInteractive?.();
  }

  // Keep this compatibility helper for older callers. Tank engagement is no longer a
  // permission gate: any living enemy can be attacked and can acquire party threat.
  isEnemyEngaged(enemy) {
    return enemy?.alive === true;
  }

  // Record threat immediately. The old engagement field remains compatible with saves,
  // but no longer suppresses damage dealers or healers before a tank makes contact.
  addThreat(enemy, unit, amount) {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    if (!enemy?.isEnemy || !unit || unit.isEnemy) {
      return;
    }
    const table = this.enemyThreat.get(enemy.id);

    if (!table) {
      return;
    }

    if (unit.role === 'Tank' && amount > 0) enemy.engagedByTank = true;

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    // Math.max chooses the largest value; pairing it with Math.min can keep a result
    // inside both a lower and an upper bound.
    table.set(unit.id, (table.get(unit.id) ?? 0) + Math.max(0, amount));
  }

  // Using any party skill attracts attention. A small intent amount covers buffs,
  // shields and movement skills; actual damage and healing add their usual threat.
  // No new saved table is needed, and tanks still open a wave through the zero-threat tie.
  generateAbilityThreat(unit, ability) {
    if (unit.isEnemy || !unit.alive) return;
    const reduction = this.time.now < (unit.status.threatReductionUntil ?? 0)
      ? 1 - (unit.status.threatReduction ?? 0) : 1;
    const intent = Math.max(1, (ability.manaCost ?? 0) * 0.5
      + Math.max(unit.attackPower ?? 0, unit.spellPower ?? unit.spellDamage ?? 0, unit.spellPower ?? unit.spellHealing ?? 0) * 0.1);
    this.getLivingEnemies().filter(enemy => !ability.threatPulseInterval || unit.distanceTo(enemy) <= ability.radius)
      .forEach(enemy => this.addThreat(enemy, unit, intent * reduction));
  }

  // This helper chooses the living threat leader. With equal threat, tanks take priority
  // before distance, including at the start of a wave.
  getHighestThreatTarget(enemy) {
    const forcedReplacement = this.classAbilitySystem?.replacement?.forcedTarget(enemy);
    if (forcedReplacement) return forcedReplacement;

    // filter keeps entries whose callback returns true. It builds a new list and leaves
    // the original list in place.
    const living = [...this.partyUnits, ...(this.abilityDecoys ?? [])].filter((unit) => unit.alive && !unit.stealthed);
    if (living.length === 0) {
      return null;
    }

    // find returns the first matching entry, or undefined when none matches. Check for
    // that missing result before using its fields.
    const forced = living.find(unit => unit.id === enemy.status?.forcedTargetId);

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    if (forced && this.time.now < (enemy.status.forcedTargetUntil ?? 0)) return forced;

    // A Map pairs a key with a value. Unlike an array index, the key can be an ID or an
    // object; get/set read and write that same key.
    const table = this.enemyThreat.get(enemy.id) ?? new Map();

    // sort rearranges this array in place. A negative comparator result puts a before b;
    // positive puts it after; zero keeps them tied.
    return living.sort((a, b) => {

      // ?? uses the fallback only for null or undefined. A real zero or false stays
      // intact.
      const diff = (table.get(b.id) ?? 0) - (table.get(a.id) ?? 0);
      if (Math.abs(diff) > 0.01) {
        return diff;
      }
      const tankPriority = Number(b.role === 'Tank') - Number(a.role === 'Tank');

      if (tankPriority !== 0) return tankPriority;
      return enemy.distanceTo(a) - enemy.distanceTo(b);
    })[0];
  }

  // This helper captures a ranked threat table for reviewing enemy decisions.
  getThreatSnapshot(enemy) {

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    // A Map pairs a key with a value. Unlike an array index, the key can be an ID or an
    // object; get/set read and write that same key.
    const table = this.enemyThreat.get(enemy.id) ?? new Map();

    // sort rearranges this array in place. A negative comparator result puts a before b;
    // positive puts it after; zero keeps them tied.
    return this.partyUnits
      .map((unit) => ({ name: unit.name, role: unit.role, threat: Math.round(table.get(unit.id) ?? 0), alive: unit.alive }))
      .sort((a, b) => b.threat - a.threat);
  }

  // This helper stores the enemy target for inspection and logs meaningful targeting
  // changes.
  setEnemyTarget(enemy, target, reason = '') {

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    const targetId = target?.id ?? null;
    enemy.setTargetName(target?.name ?? '');
    if (enemy.currentTargetId === targetId && enemy.currentTargetReason === reason) return;

    const previousTargetId = enemy.currentTargetId ?? null;
    if (this.combatLog?.diagnostics?.enabled) this.combatLog.diagnostics.emit('target_changed', { actorId: enemy.id, actor: enemy.name,
      previousTargetId, targetId, reason, activeActionId: this.combatLog?.diagnostics?.actionId(enemy),
      actionHandling: enemy.pendingAction ? 'remained_active_at_target_assignment' : 'no_active_action_at_target_assignment',
      cause: this.combatLog?.diagnostics?.context, threat: this.getThreatSnapshot(enemy) });
    enemy.currentTargetId = targetId;
    enemy.currentTargetReason = reason;
    if (!target) return;

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    this.combatLog?.add('target', `${enemy.name} targets ${target.name}${reason ? ` (${reason})` : ''}`, {
      wave: this.currentWaveIndex + 1,
      actor: enemy.name,
      target: target.name,
      reason,
      threat: this.getThreatSnapshot(enemy)
    });
  }

  // This helper records the actor intent before an attack or heal resolves.
  logActionStart(actor, target, ability) {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined. The condition before ? chooses the first value when true and the value
    // after : when false.
    this.combatLog?.add('action', `${actor.name} begins ${ability}${target ? ` on ${target.name}` : ''}`, {
      wave: this.currentWaveIndex + 1,
      actorId: actor.id, targetId: target?.id ?? null,
      actionId: this.combatLog?.diagnostics?.enabled ? this.combatLog.diagnostics.actionId(actor) : null,
      actor: actor.name,
      target: target?.name,
      ability
    });
  }

  // This helper totals an adventurer threat across the remaining enemies.
  getCombinedThreat(unit) {

    let total = 0;
    this.getLivingEnemies().forEach((enemy) => {

      // ?? uses the fallback only for null or undefined. A real zero or false stays
      // intact. ?. only follows this link when the value exists; a missing optional value
      // gives undefined.
      total += this.enemyThreat.get(enemy.id)?.get(unit.id) ?? 0;
    });

    return total;
  }

  // This helper prioritizes living allies by the fraction of health missing.
  getMostInjuredPartyMember() {

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    // sort rearranges this array in place. A negative comparator result puts a before b;
    // positive puts it after; zero keeps them tied. filter keeps entries whose callback
    // returns true. It builds a new list and leaves the original list in place.
    return this.partyUnits
      .filter((unit) => unit.alive && unit.hp < unit.maxHp)
      .sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0] ?? null;
  }

  // Cosmetic class effects are separate from damage so idle replay stays identical.
  playTeleportEffect(unit, destination, ability, caster = unit, options = {}) {
    if (!this.add?.image) return false;
    return startTeleportEffect(this, unit, destination, ability, caster, options);
  }

  // Windup artwork follows the action; teleport artwork above follows its resolved move.
  createAbilityTelegraph(caster, target, ability, action) {
    return createAbilityTelegraph(this, caster, target, ability, action);
  }

  // Cast identity keeps cleanup from touching any newer warning from the same Ranger.
  clearAbilityTelegraph(caster, action) {
    clearAbilityTelegraph(this, caster, action);
  }

  // Pass the resolved recipients so area art draws above everyone it affects.
  createAbilityEffect(caster, target, ability, recipients) {
    return createAbilityEffect(this, caster, target, ability, recipients);
  }

  // This helper connects attacker and target with a brief traveling effect.
  createProjectile(attacker, target, color, kind = 'bolt') {

    // Shared travel follows combat time instead of a wall-clock tween. The fallback
    // remains useful for older saved actions that have no cast-time visual record.
    const profile = { ...(rangedTravelProfile(attacker, { name: 'Attack' }) ?? { type: kind }), color };
    return startTravelingEffect(this, attacker, target, { name: 'Legacy projectile' }, null, profile);
  }

  // Presentation is optional during offline combat and renderer-free tests.
  startRangedTravel(attacker, target, ability, action) {
    if (!this.add?.graphics) return false;
    return startTravelingEffect(this, attacker, target, ability, action);
  }

  // A resolved or interrupted action keeps only its fading cosmetic trail.
  finishRangedTravel(attacker, action) {
    if (this.travelingEffects?.length) finishTravelingEffect(this, attacker, action);
  }

  // An existing delivery replaces generic feedback, avoiding a second projectile.
  hasRangedTravel(attacker, name) {
    return this.travelingEffects?.some(effect => effect.caster === attacker && effect.ability.name === name) ?? false;
  }

  // This helper marks a close combat impact with a short visual pulse.
  createMeleePulse(target, color = 0xffffff) {

    // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
    // lower-depth objects.
    const pulse = this.add.ellipse(target.x, target.y + 8, 48, 24, color, 0.25).setDepth(4000);
    this.tweens.add({
      targets: pulse,
      displayWidth: 120,
      displayHeight: 60,
      alpha: 0,
      duration: 120,

      // Finish this animation's remaining work when the tween reaches its end.
      onComplete: () => pulse.destroy()
    });
  }

  // Ability names float above the caster for both adventurers and enemies.
  announceAbility(unit, name, color = '#f8fafc') {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    if (!unit?.alive || !name) return;

    if (!unit.isEnemy) {
      const colorNumber = Number(unit.color ?? 0xfbbf24);
      const red = (colorNumber >> 16) & 0xff;
      const green = (colorNumber >> 8) & 0xff;
      const blue = colorNumber & 0xff;
      const brightness = red * 0.299 + green * 0.587 + blue * 0.114;

      // Keep dark class colors readable against the battlefield.
      const brighten = Math.min(255, Math.max(1, 150 / Math.max(1, brightness)));
      const classColor = `#${[red, green, blue]
        .map(channel => Math.min(255, Math.round(channel * brighten)).toString(16).padStart(2, '0'))
        .join('')}`;
      color = classColor;
    }

    this.createFloatingText(unit.x, unit.y - 120, name, color, false, 'ability');
  }

  // This helper highlights a fallen party member in the combat feed.
  announcePartyDeath(unit) {
    if (!unit?.isEnemy && !unit?.isDecoy) {
      const style = { color: '#ff3030' };
      this.addCombatAnnounce(`☠ ${unit.name} has fallen!`, style.color, [
        { text: '☠ ', style },
        { text: unit.name, style, abbreviate: true },
        { text: ' has fallen!', style }
      ]);
    }
  }

  // Boss windups longer than three seconds use the same stone banner as player guidance.
  announceBossCast(attacker, ability, windup) {

    // Windup is measured in milliseconds, so exactly 3000 ms keeps authored guidance.
    if (attacker.isBoss && windup > 3000) {

      // Start fading immediately for three combat seconds, regardless of cast length.
      this.showBattleMessage(`${attacker.name} using ${ability.name}, interrupt it!`, '#fde68a', false, 1, 3000);
    } else if (ability.responseHint) {
      this.showBattleMessage(`${ability.name}: ${ability.responseHint}`, '#fde68a');
    }
  }

  // This helper animates combat feedback with extra emphasis for critical results.
  createFloatingText(x, y, text, color, critical = false, kind = 'damage') {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    if (this.game.backgroundProgress?.isReplaying) return;

    // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
    // lower-depth objects. Origin is the anchor within the object: 0 is the left/top edge,
    // 0.5 is the center and 1 is the right/bottom edge. x/y place that anchor, not
    // necessarily the object's corner. The condition before ? chooses the first value when
    // true and the value after : when false.
    let label = this.add.text(x, y, text, {
      fontFamily: UI_FONT_FAMILIES.sans,
      fontSize: kind === 'leaderTap' ? fontPx('display57')
        : kind === 'ability' ? fontPx('body30') : critical ? fontPx('display78') : fontPx('display51'),
      fontStyle: UI_FONT_WEIGHTS.bold,
      color,
      stroke: '#000000',
      strokeThickness: critical ? 8 : 5
    }).setOrigin(0.5).setDepth(4200);

    if (kind === 'leaderTap') {
      const iconSize = 50, gap = 10;
      const width = iconSize + gap + label.width;
      const icon = createPartyLeaderTapIcon(this, -width / 2 + iconSize / 2, 0, iconSize);
      label.setPosition(-width / 2 + iconSize + gap, 0).setOrigin(0, 0.5).setDepth(0);

      // Fade and lift the icon and number together on the existing combat timeline.
      label = this.add.container(x, y, [icon, label]).setDepth(4200);
    }

    if (critical) {
      label.setScale(1.18);
    }

    if (kind === 'ability' || kind === 'leaderTap') {
      // Only combat milliseconds advance these labels; UI press tweens remain usable.
      let elapsed = 0;
      const update = (time, delta) => {
        if (this.game.backgroundProgress?.isReplaying) return label.destroy();
        if (this.combatPaused || this.time.paused) return;
        elapsed += Math.max(0, delta) * this.time.timeScale;
        const progress = Math.min(1, elapsed / (kind === 'leaderTap' ? 650 : 2280));
        const eased = 1 - (1 - progress) ** 3;
        label.setY(y - 60 * eased).setAlpha(1 - eased).setScale(1 - 0.04 * eased);
        if (progress >= 1) label.destroy();
      };
      const cleanup = () => {
        this.events.off('update', update);
        this.events.off('shutdown', cleanup);
      };
      this.events.on('update', update);
      this.events.once('shutdown', cleanup);
      label.once('destroy', cleanup);
      return;
    }

    this.tweens.add({
      targets: label,
      y: y - (critical ? 86 : 60),
      scale: critical ? 1 : 0.96,
      alpha: 0,
      duration: critical ? 1050 : 760,
      ease: 'Cubic.Out',

      // Finish this animation's remaining work when the tween reaches its end.
      onComplete: () => label.destroy()
    });
  }

  // This helper displays battle guidance until it fades or is explicitly replaced.
  showBattleMessage(text, color = '#d6a85f', persistent = false, durationMultiplier = 1, fadeDurationMs = 0) {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    if (this.game.backgroundProgress?.isReplaying && !persistent) return;

    if (!this.battleMessageText) return;

    this.tweens.killTweensOf(this.battleMessageText);
    this.battleMessageFade = null;
    this.battleMessageText.setText(text).setColor(color).setAlpha(1);
    if (this.battleMessagePlaque) {

      // Math.min chooses the smallest value; pairing it with Math.max can keep a result
      // inside both a lower and an upper bound.
      const panelWidth = Math.min(this.scale.width - 800, Math.max(500, this.battleMessageText.width + 48));
      const panelHeight = Math.max(60, this.battleMessageText.height + 22);
      this.battleMessagePlaque.destroy();
      this.battleMessagePlaque = combatPanel(this, this.scale.width / 2, this.battleLayout.messageY, panelWidth, panelHeight, 4999);
      const messageY = Math.max(this.battleLayout.messageY, 100 + panelHeight / 2);
      this.battleMessageText.setY(messageY);
      this.battleMessagePlaque.setY(messageY);
    }

    this.battleMessagePlaque?.setAlpha(1).setVisible(Boolean(text));

    // Boss warnings fade both text and stone on the paused battle clock. Other
    // messages keep their existing hold, fade and persistent guidance timings.
    if (!persistent && fadeDurationMs > 0) {
      this.battleMessageFade = { startAt: this.time.now, duration: fadeDurationMs };
      return;
    }

    if (!persistent) {
      this.tweens.add({
        targets: this.battleMessageText,
        alpha: 0,
        delay: 900 * durationMultiplier,
        duration: 260 * durationMultiplier,

        // Finish this animation's remaining work when the tween reaches its end.
        onComplete: () => {

          // ?. only follows this link when the value exists; a missing optional value
          // gives undefined.
          if (this.battleMessageText?.active) this.battleMessageText.setText('').setAlpha(1);
          this.battleMessagePlaque?.setVisible(false);
        }
      });
    }
  }

  // Refresh the boss warning's opacity using milliseconds on the combat clock.
  updateBattleMessageFade(time, replaying = false) {
    if (!this.battleMessageFade) return;
    if (replaying) {
      this.clearBattleMessage();
      return;
    }
    if (this.combatPaused) return;

    // Linear opacity falls from 1 to 0 over the full three seconds, with no hold.
    const { startAt, duration } = this.battleMessageFade;
    const alpha = Math.max(0, 1 - Math.max(0, time - startAt) / duration);
    this.battleMessageText?.setAlpha(alpha);
    this.battleMessagePlaque?.setAlpha(alpha);
    if (alpha === 0) this.clearBattleMessage();
  }

  // This helper dismisses guidance when the current interaction no longer needs it.
  clearBattleMessage() {

    this.battleMessageFade = null;
    if (!this.battleMessageText) return;
    this.tweens.killTweensOf(this.battleMessageText);
    this.battleMessageText.setText('').setAlpha(1);

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    this.battleMessagePlaque?.setAlpha(1).setVisible(false);
  }

  // This helper clears wave visuals and paces the transition to the next result.
  completeWave() {

    if (this.waveTransitioning || this.battleOver) {
      return;
    }

    // Clearing a wave starts the party reset, so retire messages from that fight.
    this.fadeCombatAnnounceLog();

    // Stop active combat updates during the wave transition and clear remaining ground
    // warnings.
    this.waveTransitioning = true;

    // An unfinished tactic belongs to the wave where it was selected. Cancel its
    // prompt without spending a use, so the player can choose it again next wave.
    if (['FOCUS', 'COORDINATED_ATTACK', 'LUNAR_ASSAULT', 'REVIVE'].includes(this.commandMode)) {
      this.commandMode = null;
      this.setTargetingInputState(false);
      this.refreshTacticsMenus();
    }

    let waveReward = null;
    if (GameState.run.entry === 'farm') recordFarmClear(this);
    if (isOrdinaryDelve() && this.currentWaveIndex < this.bossWaveIndex) {
      waveReward = awardOrdinaryWave(GameState.currentDelve, this.currentWaveIndex,
        this.bossWaveIndex, GameState.run.entry === 'farm', this.partyUnits, () => this.combatRandom());
      if (waveReward) {
        this.earnedGold = 0;

        // XP lives on the roster; reward results identify only new levels from this clear.
        for (const unit of this.partyUnits) {
          if (waveReward.levelsGainedByHero[unit.id] > 0) {
            const learned = waveReward.abilitiesLearnedByHero[unit.id] ?? [];
            if (createLevelUpEffect(this, unit, learned.length > 0)) {
              const hero = GameState.roster.find(member => member.id === unit.id);
              if (hero) acknowledgeAbilityUnlockIds(hero, learned);
            }
          }
        }
        saveProfile();
      }
    }

    if (this.idleSimulating) {
      const summary = this.idleSummary;
      summary.waves += 1;
      if (waveReward) {
        summary.gold += waveReward.gold;
        summary.items = mergeEquipmentLoot(summary.items, waveReward.items);
        summary.xp += waveReward.xp;
        summary.renownPoints = (summary.renownPoints ?? 0) + (waveReward.leaderResult?.renownPointsEarned ?? 0);
        summary.renownLevels = (summary.renownLevels ?? 0) + (waveReward.leaderResult?.levelsGained ?? 0);

        // ??= fills a missing value once. It leaves an existing value, including zero or
        // false, alone. Object.fromEntries turns [key, value] pairs back into an object. A
        // later pair with the same key replaces the earlier value. map builds one output
        // entry for each input entry, in the same order. The callback's return value
        // becomes that output entry.
        summary.xpByHero ??= Object.fromEntries(this.partyUnits.map(hero => [hero.id, summary.xp - waveReward.xp]));

        // Object.entries turns own fields into [key, value] pairs so we can visit or
        // transform them.
        for (const [id, xp] of Object.entries(waveReward.xpByHero)) {

          // ?? uses the fallback only for null or undefined. A real zero or false stays
          // intact.
          summary.xpByHero[id] = (summary.xpByHero[id] ?? 0) + xp;
        }

        for (const [id, count] of Object.entries(waveReward.materials)) {
          summary.materials[id] = (summary.materials[id] ?? 0) + count;
        }
      }
    }

    this.waveRetreating = true;
    this.waveReturnReadyAt = null;
    this.waveReturnStartedAt = this.time.now;
    this.waveReturnTimedOut = false;
    this.waveReturnProgress = new Map();

    // Hold the Line roots its caster while nearby enemies remain, but every wave has
    // ended here, so release that movement lock before allies walk back to their slots.
    // Its separate armor effect keeps its own duration and is not changed here.
    this.partyUnits.forEach(unit => {
      if ((unit.status?.replacementCostRootUntil ?? 0) > this.time.now) {
        unit.status.replacementCostRootUntil = this.time.now;
      }
    });

    // A Set keeps each value once. has checks membership without searching a list for
    // duplicate entries.
    this.waveReturnSettled = new Set();

    // filter keeps entries whose callback returns true. It builds a new list and leaves
    // the original list in place.
    this.waveReturnTargets = new Map(this.partyUnits.filter(unit => unit.alive).map(unit => {
      const home = this.waveReturnPositions.get(unit.id);
      if (!home) return [unit.id, { x: unit.arenaX, y: unit.arenaY }];
      const clearDestination = this.movement.getWaveReturnPointClearOfFallenAllies(unit, home);

      return [unit.id, this.movement.getSafeArenaPoint(clearDestination.x, clearDestination.y, unit)];
    }));

    if (this.currentWaveIndex + 1 < this.waves.length) {
      this.partyUnits.filter(unit => unit.alive).forEach(unit => {

        // Math.ceil rounds upward to the next integer, including when the value has a
        // fractional part.
        const halfway = Math.ceil(unit.maxHp * 0.5);
        if (unit.hp < halfway) unit.heal(halfway - unit.hp);

        // Give living casters the same between-wave minimum as Health. Round upward
        // for odd-sized pools, and keep any Mana already above half. Idle farming uses
        // this same completion method, so recovery does not depend on the app being open.
        if (unit.maxMana > 0) {
          const halfwayMana = Math.ceil(unit.maxMana * 0.5);
          if (unit.mana < halfwayMana) unit.mana = halfwayMana;
        }
      });

      this.updateHud();
    }

    for (const unit of this.partyUnits) {
      if (unit.leaderCommand) cancelOrder(this, unit.leaderCommand, 'wave_finished', [unit.id]);
      unit.leaderCommand = null;
      unit.manualMovement = null;
    }
    this.manualTargets.clear();
    this.heldUnitIds.clear();
    this.attackTargets.clear();
    this.activeTelegraphs.forEach((telegraph) => this.removeTelegraph(telegraph));
    this.clearBattleMessage();

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    this.waveRewardText?.destroy();
    this.waveRewardText = null;
    const firstFind = GameState.currentDelve?.id === 'slime-cave' && this.currentWaveIndex === 0
      && waveReward?.items?.some(item => item.source === 'first-clear');
    if (!this.game.backgroundProgress?.isReplaying && firstFind) {
      this.waveRewardText = firstFindReceipt(this, combatHudLayout(this), this.formatWaveReward(waveReward))
        .setDepth(5000).setName('wave-reward-text');
    } else if (!this.game.backgroundProgress?.isReplaying) this.waveRewardText = rewardTextRows(this, this.scale.width / 2, this.scale.height * 0.39,
      waveReward ? this.formatWaveReward(waveReward) : [{ text: 'WAVE CLEARED' }], {
        fontFamily: UI_FONT_FAMILIES.serif, fontSize: fontPx('heading40'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#bef264',
        stroke: '#080e19', strokeThickness: 6, align: 'center', wordWrap: { width: this.scale.width - 760 }
      }, { centered: true }).setDepth(5000).setName('wave-reward-text');

    if (this.waveRewardText && !firstFind) this.tweens.add({ targets: this.waveRewardText, y: this.waveRewardText.y - 36, duration: 900, ease: 'Cubic.Out' });
    this.combatLog?.diagnostics?.summary('cleared');
    this.combatLog?.add('wave', `Wave ${this.currentWaveIndex + 1} cleared`, { wave: this.currentWaveIndex + 1 });
    this.combatLog?.persist();

    this.enemies.filter((enemy) => enemy.container?.active !== false).forEach((enemy) => {

      // ?. only follows this link when the value exists; a missing optional value gives
      // undefined.
      if (this.game.backgroundProgress?.isReplaying) {
        enemy.container.destroy();
        return;
      }

      // The condition before ? chooses the first value when true and the value after :
      // when false. Math.max chooses the largest value; pairing it with Math.min can keep
      // a result inside both a lower and an upper bound. ?? uses the fallback only for
      // null or undefined. A real zero or false stays intact.
      this.tweens.add({
        targets: enemy.container,
        alpha: 0,
        delay: enemy.alive ? 0 : Math.max(0, 1100 - (enemy.deathElapsed ?? 0)),
        duration: 250,

        // Finish this animation's remaining work when the tween reaches its end.
        onComplete: () => enemy.container.destroy()
      });
    });

  }

  // Keep each actual drop readable as reward pools grow.
  formatWaveReward(reward) {

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    const materials = reward.materials ?? { [reward.materialId]: reward.materialCount };

    // ... expands these entries into the new list or call. It does not deep-copy the
    // objects inside. The condition before ? chooses the first value when true and the
    // value after : when false. map builds one output entry for each input entry, in the
    // same order. The callback's return value becomes that output entry.
    return [{ text: `+${reward.gold} GOLD  +${reward.xp} XP`, color: RESOURCE_GAIN_COLOR },
      ...(reward.leaderResult?.renownPointsEarned > 0
        ? [{ text: `+${reward.leaderResult.renownPointsEarned} RP · Renown Level ${GameState.leader.level}`, color: '#d8c6f0' }] : []),
      ...(reward.happiness ? [{ text: `+${reward.happiness} HAPPINESS per living adventurer`, color: RESOURCE_GAIN_COLOR }] : []),
      ...Object.entries(materials).filter(([, count]) => count > 0)
        .map(([id, count]) => ({ text: `+${count} ${getMaterialDefinition(id)?.name ?? id}`, color: rewardItemColor({ id }) })),
      ...(reward.items ?? []).map(item => {
        const rarity = item.source === 'first-clear' ? ` (${ITEM_RARITIES[item.rarity]?.label ?? item.rarity})` : '';
        return { text: `+${item.count ?? 1} ${item.name ?? item.itemId ?? item.id}${rarity}`, color: rewardItemColor(item), item: true };
      })];
  }

  // Return living adventurers to their original positions before the next wave.
  updateWaveRetreat(time, deltaSeconds, delta) {

    // filter keeps entries whose callback returns true. It builds a new list and leaves
    // the original list in place.
    const living = this.partyUnits.filter((unit) => unit.alive);
    for (const unit of living) {
      const destination = this.waveReturnTargets.get(unit.id);
      if (!destination) continue;

      // Measure the remaining logical distance to this unit's saved home slot. Within six
      // units we snap to the exact slot to avoid endless tiny steps. Progress records
      // detect a blocked return rather than waiting forever.
      const distance = Math.hypot(unit.arenaX - destination.x, unit.arenaY - destination.y);
      if (distance > 6 && !this.waveReturnTimedOut && !this.waveReturnSettled.has(unit.id)) {
        unit.moveToward(destination.x, destination.y, deltaSeconds * 2, 0, false);
      } else if (distance > 0 && distance <= 6) {
        unit.moveBy(destination.x - unit.arenaX, destination.y - unit.arenaY, false);
      }
      const remaining = Math.hypot(unit.arenaX - destination.x, unit.arenaY - destination.y);

      const progress = this.waveReturnProgress.get(unit.id);
      if (!progress || remaining < progress.bestDistance - 6) {
        this.waveReturnProgress.set(unit.id, { bestDistance: remaining, lastProgressAt: time });
      } else if (remaining > 6 && time - progress.lastProgressAt >= 2000) {
        this.waveReturnSettled.add(unit.id);
      }

      // ?. only follows this link when the value exists; a missing optional value gives
      // undefined.
      if (!this.game.backgroundProgress?.isReplaying) {
        unit.spriteVisual?.update(delta);
      }
    }

    // every requires all entries to pass the check; an empty list gives true.
    const allHome = living.every((unit) => {
      const destination = this.waveReturnTargets.get(unit.id);

      // Math.hypot calculates straight-line length from the x/y differences: square each,
      // add them, then take the square root.
      return destination && (this.waveReturnSettled.has(unit.id)
        || Math.hypot(unit.arenaX - destination.x, unit.arenaY - destination.y) <= 6);
    });

    if (!allHome && time - this.waveReturnStartedAt < 10000) {
      this.waveReturnReadyAt = null;
      return;
    }

    if (!allHome) this.waveReturnTimedOut = true;

    // Start a three-second rest only once after the party settles or times out. This is an
    // absolute combat timestamp. The reward text stays visible through that rest before
    // the next wave or camp transition.
    this.waveReturnReadyAt ??= time + 3000;
    if (time < this.waveReturnReadyAt) return;
    this.waveRewardText?.destroy();
    this.waveRewardText = null;
    this.waveRetreating = false;

    if (isOrdinaryDelve() && GameState.run.entry === 'farm' && !this.farmStopRequested && living.length > 0) {

      // Math.max chooses the largest value; pairing it with Math.min can keep a result
      // inside both a lower and an upper bound.
      this.startWave(delveFarmWaveIndex(GameState.currentDelve, this.bossWaveIndex));
    } else if (isOrdinaryDelve() && (GameState.run.entry === 'farm'
      || delveCampWaves(GameState.currentDelve, this.bossWaveIndex).includes(this.currentWaveIndex + 1))) {
      this.showDelveCamp();
    } else if (this.currentWaveIndex + 1 >= this.waves.length) this.finishVictory();
    else this.startWave(this.currentWaveIndex + 1);
  }

  // Enter the boss with the same resources as a fresh Delve visit. This runs only when
  // choosing the final boss at camp, so farming and restored fights keep their resources.
  restoreBossResources() {
    for (const unit of this.partyUnits) {
      if (!unit.alive) unit.revive(1, 1);
      unit.hp = unit.maxHp;
      unit.mana = unit.maxMana;

      // These are last-use combat timestamps in milliseconds. Negative infinity makes
      // basic actions ready immediately; an empty skill record readies every skill slot.
      unit.lastAttackAt = -Infinity;
      unit.lastHealAt = -Infinity;
      unit.lastAbilityAt = {};
      unit.updateHealthBar();
    }

    // Reset tactic and potion waits too. Spent potion charges and once-per-encounter
    // usage are separate limits, so this refresh does not grant extra uses.
    this.leaderAbilityCooldowns.clear();
    this.lastPotionUseAt.clear();

    // Countdown and Pause skip normal HUD updates, so show the full bars right away.
    this.updateHud();
  }

  // Keep the camp choices on the battlefield at the saved pre-boss checkpoint.
  showDelveCamp() {
    this.waveTransitioning = true;
    this.waveRetreating = false;
    GameState.run.entry = 'camp';
    this.farmStopRequested = false;

    // Time spent choosing at camp is never part of a farming cycle or speed sample.
    if (this.farmTiming) {
      this.farmTiming.lastClearAt = null;
      this.farmTiming.measuredClearAt = null;
    }
    this.refreshFarmControls();
    GameState.currentRoom = getDelveCheckpoint(GameState.currentDelve, this.bossWaveIndex)?.nextWave ?? this.bossWaveIndex;
    this.clearBattleMessage();

    const delve = GameState.currentDelve;
    if (this.idleSimulating) return;

    // Math.max chooses the largest value; pairing it with Math.min can keep a result
    // inside both a lower and an upper bound.
    const farmIndex = delveFarmWaveIndex(delve, this.bossWaveIndex);
    const nextWave = getDelveCheckpoint(delve, this.bossWaveIndex)?.nextWave ?? this.bossWaveIndex;

    // The braces pull named fields into local variables. This reads those fields without
    // copying the whole source object.
    const { width, height } = this.scale;
    this.encounterStatusText.setText('CAMP CHECKPOINT');
    this.updateEncounterStatus();
    const overlay = [];

    // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
    // lower-depth objects. This gives the display object an input hit area. Visible
    // artwork alone does not make an object respond to a tap.
    const blocker = this.add.rectangle(width / 2, height / 2, width, height, 0, 0.001).setInteractive().setDepth(11999);

    // on registers a callback for later events; it does not call that callback now.
    // Long-lived emitters need matching listener cleanup.
    blocker.on('pointerdown', (pointer, x, y, event) => event?.stopPropagation?.());
    overlay.push(blocker);

    // Keep the top at y=222 and extend the lower frame to y=822. The extra 32 pixels leave
    // room below the four reward lines while staying above the party HUD.
    overlay.push(dialogFrame(this, width / 2, 522, 1700, 600, 12000));
    const headingWindow = combatPanel(this, width / 2, 312, 1558, 156, 12001);
    headingWindow.name = 'delve-camp-heading-window';
    overlay.push(headingWindow);
    overlay.push(addStoneOrnaments(this, width / 2, 274, 1630, this.stoneTheme, 12002));

    overlay.push(combatText(this, width / 2, 282, 'DELVE CAMP', UI_FONT_SIZES.display62, 12002));
    const eligibility = delveRewardEligibility(delve);
    const rewardNotice = eligibility.cappedCount === eligibility.partyCount
      ? `Party at level ${eligibility.cap} cap: materials only. No XP, Gold or Happiness.`
      : eligibility.cappedCount > 0
        ? `${eligibility.cappedCount}/${eligibility.partyCount} at level ${eligibility.cap} cap: reduced Gold; capped members earn no XP/Happiness.`
        : `Rewards saved. XP, Gold and Happiness stop at level ${eligibility.cap} cap.`;
    overlay.push(combatText(this, width / 2, 346, rewardNotice, UI_FONT_SIZES.body32, 12002,
      { color: STONE.muted }));

    // Build one of the three camp choices. index selects its column and icon. The action
    // is a callback saved for a valid release, so merely drawing the card cannot start
    // farming or enter the boss wave.
    const choice = (index, title, detail, action, color, enabled = true) => {

      // width comes from this.scale, our logical canvas. Subtracting 1 from index places
      // columns at -528, 0 and +528 around the canvas center. Each card is 502 pixels
      // wide, leaving 26 pixels between neighboring cards.
      const x = width / 2 + (index - 1) * 528;

      // The card is centered at y=599 with height 386, so its top is 406 and bottom is
      // 792. This preserves its top while making room below the four reward lines. Depth
      // 12001 puts it above the outer panel; color chooses the action tint.
      const button = combatButton(this, x, 599, 502, 386, 12001, color).setName('battle-camp-' + index);

      // The icon sits in the upper part of the card at y=482. index crops the matching
      // town/farm/boss icon from the shared sheet. Depth 12003 draws it over the card
      // without changing the fixed card touch target.
      const symbol = campStoneIcon(this, x, 482, index, 12003);

      // The title shares the card's center x and sits at y=601 below the icon. body36 is
      // the central 36-pixel logical text size. The description uses the title's measured
      // bottom, so extra reward lines cannot grow into it.
      const titleText = combatText(this, x, 601, title, UI_FONT_SIZES.body36, 12003);

      // The button runs from y=406 to y=792 in our 2400 x 1080 game canvas. stoneText
      // normally centers a whole paragraph around y, so extra lines grow upward. Start the
      // description below the title's measured bottom instead. The 12-pixel gap separates
      // the two, and origin (0.5, 0) centers x while pinning y to the first line. The
      // 422-pixel wrap width leaves 40 pixels of breathing room on each card edge.
      const detailTop = titleText.getBounds().bottom + 12;

      // Origin is the anchor within the object: 0 is the left/top edge, 0.5 is the center
      // and 1 is the right/bottom edge. x/y place that anchor, not necessarily the
      // object's corner. The condition before ? chooses the first value when true and the
      // value after : when false.
      const detailText = combatText(this, x, detailTop, detail, UI_FONT_SIZES.support29, 12003,
        { align: 'center', color: index === 1 ? '#f5d788' : STONE.muted, wordWrap: { width: 422 } })
        .setOrigin(0.5, 0);
      overlay.push(button, symbol, titleText, detailText);

      // A defeated boss stays dimmed; tapping explains why it cannot be challenged.
      if (!enabled) {
        [...button.pressVisuals, symbol, titleText, detailText].forEach(object => object.setAlpha(0.45));
        button.uiSound = 'failure';
        bindButtonPress(this, button, [symbol, titleText, detailText], () => {
          HapticsService.tap();
          showFeatureToast(this, 'This boss has already been defeated.', { centered: true });
        });
        return;
      }
      bindButtonPress(this, button, [symbol, titleText, detailText], () => {
        HapticsService.confirm();
        overlay.forEach(object => object.destroy());
        action();
      });
    };

    choice(0, 'LEAVE DELVE', 'Keep all banked rewards', () => {
      GameState.activeParty = [];

      // TitleScene hosts the world map. Keep the current Delve location so leaving
      // camp does not teleport the party to town; banked rewards and checkpoints stay saved.
      saveProfile();
      this.scene.start('TitleScene');
    }, 0x1f2937);

    // Both Abyss camps repeat their own cleared wave. The label stays the same in
    // every Delve while farmIndex still chooses its saved encounter and reward rules.
    choice(1, 'FARM NEXT WAVE',
      eligibility.eligibleIds.size ? 'Gold, XP, Happiness, and Materials' : 'Materials only', () => {
        GameState.run.entry = 'farm';
        this.startWave(farmIndex);
      }, 0x50432e);


    // World clears already persist the defeated boss under this Delve's stable ID.
    // Use that record rather than the camp checkpoint, which also unlocks before a win.
    const bossDefeated = GameState.world.clearedDelves.includes(delve.id);
    const atBoss = nextWave >= this.bossWaveIndex;
    choice(2, atBoss ? 'FACE THE BOSS' : 'CONTINUE DELVE', bossDefeated ? 'Boss already defeated'
      : atBoss ? 'Challenge the boss of this Delve to earn better rewards and unlock the next Delve!'
        : `Continue from wave ${nextWave + 1} toward the next camp.`, () => {
      GameState.run.entry = atBoss ? 'boss' : 'progress';
      if (atBoss) this.restoreBossResources();
      this.startWave(nextWave);

      // Save the refreshed party together with the boss countdown. Reloading then
      // resumes this fight instead of refreshing resources again after combat begins.
      if (atBoss) saveProfile();
    }, 0x633328, !bossDefeated);
  }

  // Build held potion details from the equipped pack definition and its remaining charges.
  // unit is the live combatant, with current resources and arena position.
  potionDetails(unit) {

    // find returns the first matching entry, or undefined when none matches. Check for
    // that missing result before using its fields.
    const hero = GameState.roster.find((entry) => entry.id === unit.id);
    const item = this.classAbilitySystem?.replacement?.potion(unit)?.item ?? (hero && equippedItem(hero, 'potion', GameState));

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    const definition = getPotionDefinition(item?.itemId);

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    const remaining = definition ? Math.ceil(potionCooldownRemaining(this, unit, definition) / 1000) : 0;
    return definition ? { title: definition.name, description: `${definition.description} ${potionEffectDescription(definition)} ${item.charges}/${definition.uses} uses remain.${remaining > 0 ? ` Ready in ${remaining}s.` : ''} Tap POTION to use it on ${unit.name}.` }
      : { title: 'Potion', description: 'Equip a potion pack on this adventurer at the Adventurer\'s Hall.' };
  }

  // Check battle state, living owner, charge availability, use delay and missing resource.
  // unit is the live combatant, with current resources and arena position. time is a
  // timestamp on the gameplay clock in milliseconds, not a duration.
  canUsePotion(unit, time = this.time.now) {
    if (this.battleOver || this.combatPaused || this.waveTransitioning || !this.partyUnits.includes(unit) || !unit.alive) return false;

    // find returns the first matching entry, or undefined when none matches. Check for
    // that missing result before using its fields.
    const hero = GameState.roster.find((entry) => entry.id === unit.id);
    const item = this.classAbilitySystem?.replacement?.potion(unit)?.item ?? (hero && equippedItem(hero, 'potion', GameState));

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    const definition = getPotionDefinition(item?.itemId);

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    if (!definition || item.charges <= 0 || potionCooldownRemaining(this, unit, definition, time) > 0) return false;
    return potionHasBenefit(this, unit, definition, time);
  }

  // Restore the actual missing resource, consume one charge and bank the action. unit is
  // the live combatant, with current resources and arena position. time is a timestamp on
  // the gameplay clock in milliseconds, not a duration.
  usePotion(unit, time = this.time.now) {
    if (!this.canUsePotion(unit, time)) return false;

    // find returns the first matching entry, or undefined when none matches. Check for
    // that missing result before using its fields.
    const hero = GameState.roster.find((entry) => entry.id === unit.id);
    const item = this.classAbilitySystem?.replacement?.potion(unit)?.item ?? equippedItem(hero, 'potion', GameState);
    const definition = getPotionDefinition(item.itemId);
    const resource = definition.effect.resource;
    const consumed = this.classAbilitySystem?.replacement
      ? this.classAbilitySystem.replacement.consumePotion(unit) : consumePotionCharge(hero.id, GameState);
    if (!consumed) return false;
    startPotionCooldown(this, unit, time);
    const recovery = applyPotionEffects(this, unit, definition, time);
    const amount = recovery[resource];
    const gains = [recovery.hp > 0 ? `+${recovery.hp} HP` : '', recovery.mana > 0 ? `+${recovery.mana} MANA` : '',
      recovery.ward > 0 ? `+${recovery.ward} WARD` : ''].filter(Boolean);

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    unit.flash?.(0x86efac);
    this.createFloatingText(unit.x, unit.y - 100, gains.join(' / ') || 'RESTORED', '#86efac', true);
    this.showBattleMessage(`${unit.name} uses ${definition.name}`, '#86efac');
    this.combatLog?.add('item', `${unit.name} uses ${definition.name}${gains.length ? `: ${gains.join(' / ')}` : ''}`, { target: unit.name, amount, resource, recovery, secondary: definition.effect.secondary });
    HapticsService.confirm();
    saveProfile();
    this.updateHud();

    return true;
  }

  // Refresh each party card's potion state from its equipped owned pack.
  updatePotionHud() {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    this.partyHud?.forEach(({ unit, potionButton, potionLabel }) => {

      // find returns the first matching entry, or undefined when none matches. Check for
      // that missing result before using its fields.
      const hero = GameState.roster.find((entry) => entry.id === unit.id);
      const item = this.classAbilitySystem?.replacement?.potion(unit)?.item ?? (hero && equippedItem(hero, 'potion', GameState));

      // ?. only follows this link when the value exists; a missing optional value gives
      // undefined.
      const definition = getPotionDefinition(item?.itemId);
      const available = Boolean(definition && item.charges > 0);
      const ready = available && this.canUsePotion(unit);
      const remaining = available ? Math.ceil(potionCooldownRemaining(this, unit, definition) / 1000) : 0;

      // The condition before ? chooses the first value when true and the value after :
      // when false.
      potionButton?.setVisible(available).setFillStyle(ready ? 0x14532d : 0x292524);
      if (potionButton?.input) potionButton.input.enabled = available;
      potionLabel?.setVisible(available).setAlpha(ready ? 1 : 0.55).setText(available ? `POTION\n${remaining > 0 ? `${remaining}s` : `${item.charges}/${definition.uses}`}` : '');
    });
  }

  // Restore final battle presentation and summarize the actual gains and casualties from
  // catch-up.
  onCatchUpSettled() {
    if (!this.sys.isActive()) return;

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    const progress = this.game.backgroundProgress;

    // A visible window can finish catch-up while another app has focus. Restore its
    // artwork now so Phaser does not clear the hidden battle to a black canvas.
    if (progress?.hidden && !progress.canRenderWhileIdle?.()) {

      // ?? uses the fallback only for null or undefined. A real zero or false stays
      // intact.
      if (Date.now() - (this.lastIdleSaveAt ?? 0) >= 2000) {
        this.lastIdleSaveAt = Date.now();
        saveProfile();
      }

      return;
    }

    finishOfflineFarm(this);
    resumeIdleBattle(this);
    this.partyUnits?.forEach(unit => unit.syncPresentation());
    this.enemies?.forEach(enemy => enemy.updateDeathPresentation?.(0));
    this.partyUnits?.forEach(unit => unit.spriteVisual?.update(0));
    this.enemies?.forEach(enemy => enemy.spriteVisual?.update(0));
    this.updateHud();
    this.combatLog?.persist();

    saveProfile();
    this.onForeground();
  }

  // Let the background service advance real battle gameplay by the requested missed time.
  // durationMs is a duration in milliseconds, rather than an absolute clock time.
  advanceIdleProgress(durationMs, budgetNow) {
    const farm = advanceOfflineFarm(this, durationMs);
    return farm === false ? advanceIdleBattle(this, durationMs, budgetNow) : farm;
  }

  // Refresh the visible battle when the host returns to the foreground.
  onForeground() {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    if (this.game.backgroundProgress?.hidden || this.restoringBattle
      || this.game.backgroundProgress?.pendingMs >= 50) return;
    finishOfflineFarm(this);
    resumeIdleBattle(this);
    this.showIdleSummary();
  }

  // Keep idle rewards and casualties visible until the player has read the return summary.
  showIdleSummary() {
    const summary = this.idleSummary;
    if (this.idleSummaryOpen || !summary || (!summary.waves && !summary.deaths.length)) return;
    this.idleSummaryOpen = true;

    // ??= fills a missing value once. It leaves an existing value, including zero or
    // false, alone.
    this.idleSummaryResumePaused ??= this.combatPaused;
    this.combatPaused = true;
    this.time.paused = true;

    // The braces pull named fields into local variables. This reads those fields without
    // copying the whole source object.
    const { width, height } = this.scale;

    // The condition before ? chooses the first value when true and the value after : when
    // false. ?. only follows this link when the value exists; a missing optional value
    // gives undefined. flatMap builds callback results and flattens one array level.
    // Returning [] removes an entry; returning [value] keeps one result.
    const casualtyLines = summary.casualties?.length ? summary.casualties.slice(-5).flatMap(death => [
      `${death.name} - Wave ${death.wave}, ${formatDuration(death.time * 1000)}`,
      `${death.actor ?? 'Unknown attacker'}: ${death.ability ?? 'Unknown ability'}`
    ]) : summary.deaths.length ? [`Died: ${summary.deaths.join(', ')}`, 'Details unavailable for these earlier idle deaths.']
      : [];
    const rows = idleRewardRows(summary, GameState.activeParty,
      id => getMaterialDefinition(id)?.name ?? id).map(row => ({
      text: row.text,
      color: row.item ? rewardItemColor(row.item) : row.resource ? RESOURCE_GAIN_COLOR : '#f5f5dc'
    }));

    // Measure the readable text first so short reports do not need a screen-wide panel.
    // These dimensions are logical canvas pixels, before scaling to the phone display.

    // Origin is the anchor within the object: 0 is the left/top edge, 0.5 is the center
    // and 1 is the right/bottom edge. x/y place that anchor, not necessarily the object's
    // corner. Both text objects use their left edges so the bullets line up with the W.
    const title = combatText(this, 0, 0, 'While you were away:', UI_FONT_SIZES.heading46, 13002)
      .setOrigin(0, 0).setName('idle-summary-title');
    const text = rewardTextRows(this, 0, 0, rows, {
      fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('body30'), color: '#f5f5dc',
      align: 'left', lineSpacing: 8, wordWrap: { width: Math.min(1040, width - 200) }
    }, { gap: 8 }).setDepth(13002).setName('idle-summary-text');
    const buttonHeight = 80;
    const continueWidth = 300;
    const deathWidth = 360;
    const buttonGap = 24;
    const buttonsWidth = casualtyLines.length ? continueWidth + buttonGap + deathWidth : continueWidth;
    const contentWidth = Math.max(title.width, text.width, buttonsWidth);
    const panelWidth = contentWidth + 84;

    // Reserve top/bottom padding, the heading, and the button row. Only unusually long
    // reward lists scroll; their reading size stays the same.
    // The 64 is 32 pixels of padding at each edge; 20 and 24 are the gaps between rows.
    const reservedHeight = 64 + title.height + 20 + 24 + buttonHeight;

    // Math.min chooses the smallest value; pairing it with Math.max can keep a result
    // inside both a lower and an upper bound.
    const panelHeight = Math.min(height - 100, reservedHeight + text.height);
    const centerY = height / 2;
    const top = centerY - panelHeight / 2;
    const contentLeft = (width - contentWidth) / 2;
    title.setPosition(contentLeft, top + 32);
    text.setPosition(contentLeft, title.y + title.height + 20);

    // This gives the display object an input hit area. Visible artwork alone does not make
    // an object respond to a tap. Depth is drawing order, not distance or size.
    // Higher-depth objects draw on top of lower-depth objects.
    const blocker = this.add.rectangle(width / 2, centerY, width, height, 0x000000, 0.65)
      .setDepth(13000).setInteractive();

    // on registers a callback for later events; it does not call that callback now.
    // Long-lived emitters need matching listener cleanup.
    blocker.on('pointerdown', (pointer, x, y, event) => event?.stopPropagation?.());
    const panel = dialogFrame(this, width / 2, centerY, panelWidth, panelHeight, 13001)
      .setName('idle-summary-panel');
    const bodyHeight = panelHeight - reservedHeight;
    let bodyScroll = null;
    if (text.height > bodyHeight) {
      bodyScroll = hallScroll(this, { x: contentLeft, y: text.y, width: contentWidth, height: bodyHeight },
        [text], text.height, 0, () => {},
        (scene, x, y, w, h, kind) => scrollbarSurface(scene, x, y, w, h, kind, 13002),
        () => Boolean(this.selectionDetailsClose));
      bodyScroll.container.setDepth(13002);
    }

    // Center the compact button row inside the panel, including space for death details.
    const buttonY = top + panelHeight - 32 - buttonHeight / 2;
    const continueX = casualtyLines.length ? (width - buttonsWidth + continueWidth) / 2 : width / 2;
    const button = combatButton(this, continueX, buttonY, continueWidth, buttonHeight, 13002)
      .setName('idle-summary-continue');

    const label = combatText(this, continueX, buttonY, 'CONTINUE', UI_FONT_SIZES.heading38, 13003);
    const deathViews = [];
    if (casualtyLines.length) {
      const deathX = continueX + continueWidth / 2 + buttonGap + deathWidth / 2;
      const deathButton = combatButton(this, deathX, buttonY, deathWidth, buttonHeight, 13002)
        .setName('idle-summary-death-details');
      const deathLabel = combatText(this, deathX, buttonY, 'DEATH DETAILS', UI_FONT_SIZES.heading38, 13003);
      deathViews.push(deathButton, deathLabel);
      bindButtonPress(this, deathButton, [deathLabel], () => showSelectionDetails(this, {
        title: 'Death details', description: casualtyLines.join('\n'), align: 'left',
        panelWidth: width * 0.72, depth: 14000
      }));
    }

    bindButtonPress(this, button, [label], () => {

      // ?. only follows this link when the value exists; a missing optional value gives
      // undefined.
      this.selectionDetailsClose?.();

      // Destroying the scroll container also removes its mask and input listeners.
      bodyScroll?.destroy();

      // ... expands these entries into the new list or call. It does not deep-copy the
      // objects inside.
      for (const object of [blocker, panel, title, text, button, label, ...deathViews]) object.destroy();
      this.idleSummaryOpen = false;
      this.idleSummary = null;
      this.combatPaused = this.idleSummaryResumePaused;
      this.time.paused = this.combatPaused;
      this.idleSummaryResumePaused = undefined;
      resumeIdleBattle(this);

      saveProfile();
    });

    saveProfile();
  }

  // This helper refreshes party resources and encounter progress as combat changes.
  updateHud() {

    this.refreshPartySelection();
    this.updateLeaderLoadoutBar();
    this.updatePotionHud();

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    this.partyHud?.forEach(entry => {
      const { unit, levelText } = entry;

      // Wave rewards can change the roster level without replacing the battle unit.
      const level = GameState.roster.find(hero => hero.id === unit.id)?.level ?? unit.level;
      levelText.setText(`Lv ${level}`);
      entry.updateResources();
    });

    this.updateEncounterStatus();
  }

  // This helper uses warmer health colors to make injured allies easier to spot.
  getHealthBarColor(ratio) {

    if (ratio <= 0.25) return 0xef4444;
    if (ratio <= 0.5) return 0xf97316;
    if (ratio <= 0.75) return 0xeab308;

    return 0x22c55e;
  }

  // Show the run timer with the wave number or the boss name.
  updateEncounterStatus() {

    if (!this.encounterStatusText) return;

    // Milliseconds on this clock include countdowns, returns and camps, but exclude Pause.
    const elapsed = formatDuration(Math.max(0, this.time.now - this.delveTimerStartedAt));
    this.encounterTimerText.setText(elapsed);
    if (this.currentWaveIndex < 0) return;

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    const wave = this.waves?.[this.currentWaveIndex];
    const camp = GameState.run.entry === 'camp';

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    this.encounterStatusText.setText(camp ? 'CAMP CHECKPOINT' : `WAVE ${this.currentWaveIndex + 1} / ${this.waves.length}`);
    this.encounterTimerText.setText(elapsed);
    this.delveTitleText?.setColor(!camp && wave?.boss ? '#ffd166' : STONE.text);
    this.waveTitleText?.setText(camp ? 'CAMP CHECKPOINT' : wave?.boss ? 'BOSS ENCOUNTER' : `Wave ${this.currentWaveIndex + 1}`)
      .setColor(!camp && wave?.boss ? '#fca5a5' : STONE.muted);
  }

  // This helper draws attention to the party member taking enemy damage.
  flashPartyHudName(unit) {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined. find returns the first matching entry, or undefined when none matches.
    // Check for that missing result before using its fields.
    const entry = this.partyHud?.find((item) => item.unit === unit);
    if (!entry?.nameText) return;

    this.tweens.killTweensOf(entry.nameText);
    entry.nameText.setAlpha(1).setColor('#fca5a5');
    this.tweens.add({
      targets: entry.nameText,
      alpha: 0.3,
      duration: 90,
      yoyo: true,
      repeat: 2,

      // Finish this animation's remaining work when the tween reaches its end.
      onComplete: () => {

        // ?. only follows this link when the value exists; a missing optional value gives
        // undefined.
        if (entry.nameText?.active) entry.nameText.setAlpha(1).setColor('#f5f5f4');
      }
    });
  }

  // This helper commits the victory rewards and leads the player to the reward screen.
  finishVictory() {

    if (this.battleOver) {
      return;
    }
    this.battleOver = true;
    this.classAbilitySystem?.replacement?.clearShelters();

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    this.combatLog?.finish('victory');

    // Commit encounter gold and progression before opening the reward screen.
    const firstClearBoss = awardPineshireBoss(GameState.currentDelve, () => this.combatRandom());
    const gold = firstClearBoss ? firstClearBoss.gold : cappedDelveGold(Math.max(1, this.earnedGold));
    if (!firstClearBoss) GameState.gold += gold;
    GameState.currentRoom = this.waves.length;

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    GameState.rewards = [{ type: 'gold', amount: gold, source: GameState.currentDelve?.name ?? 'Delve' }];

    // Final bosses use one boss cascade instead of an additional ordinary wave roll.
    // The existing battleOver guard and saved victory phase prevent duplicate payouts.
    const equipmentRewards = firstClearBoss ? firstClearBoss.items
      : awardEquipmentLoot(GameState.currentDelve, 'boss', () => this.combatRandom());
    GameState.rewards.push(...equipmentRewards.map(item => ({ ...item, type: 'equipment' })));
    if (this.idleSimulating) this.idleSummary.items = mergeEquipmentLoot(this.idleSummary.items, equipmentRewards);
    if (this.idleSimulating) {
      this.idleSummary.gold += gold;
    }
    const summary = completeExpedition(firstClearBoss);
    if (this.idleSimulating) {
      this.idleSummary.renownPoints = (this.idleSummary.renownPoints ?? 0) + summary.leaderResult.renownPointsEarned;
      this.idleSummary.renownLevels = (this.idleSummary.renownLevels ?? 0) + summary.leaderResult.levelsGained;
    }
    this.updateHud();

    // Boss XP can also grant levels. Finish saving rewards immediately, but let the
    // celebration play before opening the reward screen.
    let celebrating = false;
    for (const hero of summary.adventurers) {
      if (hero.levelsGained > 0) {
        const unit = this.partyUnits.find(member => member.id === hero.id);
        const shown = createLevelUpEffect(this, unit, hero.abilitiesLearned.length > 0);
        if (shown) {
          const adventurer = GameState.roster.find(member => member.id === hero.id);
          if (adventurer) acknowledgeAbilityUnlockIds(adventurer, hero.abilitiesLearned);
        }
        celebrating = shown || celebrating;
      }
    }
    if (this.idleSimulating) {

      // Record actual boss XP after cap clipping, including zero for capped heroes.
      this.idleSummary.xpByHero ??= Object.fromEntries(this.partyUnits.map(hero => [hero.id, this.idleSummary.xp]));
      for (const hero of summary.adventurers) {
        this.idleSummary.xpByHero[hero.id] = (this.idleSummary.xpByHero[hero.id] ?? 0) + hero.xpGained;
      }
      this.idleSummary.xp += Math.max(0, ...summary.adventurers.map(hero => hero.xpGained));
    }
    finishGameplayEncounter(this, 'victory');
    saveProfile();

    const showRewards = () => {
      HapticsService.confirm();
      this.scene.start('RewardScene');
    };

    // This drawing-only timer needs no saved event; reloading already keeps the rewards.
    if (celebrating) this.time.delayedCall(LEVEL_UP_DURATION_MS, showRewards);
    else showRewards();
  }

  // This helper records the loss and offers the encounter summary.
  finishDefeat() {

    if (this.battleOver) return;
    this.battleOver = true;
    this.classAbilitySystem?.replacement?.clearShelters();

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    this.combatLog?.finish('defeat');
    failExpedition();
    finishGameplayEncounter(this, 'defeat');
    saveProfile();
    this.showResultOverlay('DEFEATED', 'The party was driven back.', 'CONFIRM', () => {

      HapticsService.confirm();
      this.scene.start('EncounterSummaryScene');
    });
  }

  // This helper pauses or resumes combat updates and the scene clock.
  togglePause(pauseOwner = 'player') {

    if (this.battleOver) return;
    this.combatPaused = !this.combatPaused;
    emitGameplay(this, 'combat.pause.changed', { paused: this.combatPaused, pauseOwner }, PLAYER_SOURCE);
    this.time.paused = this.combatPaused;

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined. The condition before ? chooses the first value when true and the value
    // after : when false.
    this.pauseButtonText?.setText(this.combatPaused ? 'RESUME' : 'PAUSE');
    this.pauseMenu?.sync();
    this.pauseButton?.setFillStyle(this.combatPaused ? 0x3b321d : 0x1f2937);
    this.showBattleMessage(this.combatPaused ? 'TACTICAL PAUSE' : 'RESUMED', this.combatPaused ? '#fbbf24' : '#bef264');

    if (!this.combatPaused) this.flushPausedTactics();
    HapticsService.tap();
  }

  // This helper ends combat as a retreat and sends the player to its summary.
  fleeBattle() {

    if (this.battleOver) return;
    if (this.combatPaused) {
      this.combatPaused = false;
      this.time.paused = false;
    }
    this.battleOver = true;
    this.classAbilitySystem?.replacement?.clearShelters();

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    this.combatLog?.finish('fled');
    fleeExpedition();
    finishGameplayEncounter(this, 'retreat');
    saveProfile();
    this.scene.start('EncounterSummaryScene');
  }

  // This helper presents the encounter outcome and blocks further battlefield taps.
  showResultOverlay(title, subtitle, buttonLabel, callback) {
    this.refreshFarmControls();

    // The braces pull named fields into local variables. This reads those fields without
    // copying the whole source object.
    const { width, height } = this.scale;
    const centerY = height * 0.5;

    // Place an invisible input blocker behind the result panel so taps cannot reach the
    // battlefield.
    const inputBlocker = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.001)
      .setInteractive()
      .setDepth(11999);

    // on registers a callback for later events; it does not call that callback now.
    // Long-lived emitters need matching listener cleanup.
    inputBlocker.on('pointerdown', (pointer, localX, localY, event) => event?.stopPropagation?.());

    dialogFrame(this, width / 2, centerY, width * 0.78, 390, 12000);

    // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
    // lower-depth objects. Origin is the anchor within the object: 0 is the left/top edge,
    // 0.5 is the center and 1 is the right/bottom edge. x/y place that anchor, not
    // necessarily the object's corner. The condition before ? chooses the first value when
    // true and the value after : when false.
    this.add.text(width / 2, centerY - 95, title, {
      fontFamily: UI_FONT_FAMILIES.serif,
      fontSize: fontPx('display78'),
      fontStyle: UI_FONT_WEIGHTS.bold,
      color: '#ef4444'
    }).setOrigin(0.5).setDepth(12001);

    this.add.text(width / 2, centerY - 22, subtitle, {
      fontFamily: UI_FONT_FAMILIES.sans,
      fontSize: fontPx('body36'),
      color: '#d6d3d1'
    }).setOrigin(0.5).setDepth(12001);

    const button = combatButton(this, width / 2, centerY + 90, width * 0.58, 96, 12001).setName('battle-result-confirm');

    const buttonText = this.add.text(width / 2, centerY + 90, buttonLabel, {
      fontFamily: UI_FONT_FAMILIES.serif,
      fontSize: fontPx('heading38'),
      fontStyle: UI_FONT_WEIGHTS.bold,
      color: STONE.text
    }).setOrigin(0.5).setDepth(12002);

    bindButtonPress(this, button, [buttonText], callback);
  }
}
