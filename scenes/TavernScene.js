import TownFeatureScene, { featurePanel, featureBody, featureList, featureSelect } from '../ui/TownFeatureUI.js';
import { serviceText, serviceButton, serviceCard } from '../ui/TownServiceTheme.js';
import { selectionCharacterPortrait } from '../ui/SelectedCharacterIdle.js';
import { showSelectionDetails } from '../ui/SelectionDetails.js';
import { showConfirmation } from '../ui/ConfirmationDialog.js';
import { playUiSound } from '../services/UiAudioService.js';
import HapticsService from '../services/HapticsService.js';
import GameState from '../game/GameState.js';
import adventurers from '../data/adventurers.js';
import { RECRUITMENT_COSTS, RECRUITMENT_LINES } from '../data/recruitment.js';
import { CLASS_DESCRIPTIONS } from '../data/classDescriptions.js';
import { abilityEntries } from '../game/AdventurerAbilities.js';
import { abilityUnlockLevel } from '../data/abilityUnlocks.js';
import { abilityDescription } from '../game/AbilityDescriptions.js';
import { isRecruited, recruitmentPreview, recruitAdventurer } from '../game/Recruitment.js';
import { skipRecruitmentTutorial } from '../game/RecruitmentTutorial.js';

const ROLES = ['All', 'Tank', 'Healer', 'Melee DPS', 'Ranged DPS'];

export default class TavernScene extends TownFeatureScene {
  constructor() { super('TavernScene', true); }

  init() {
    this.selectedId = null;
    this.role = 'All';
    this.rosterOffset = 0;
    this.detailOffset = 0;
  }

  availableRecruits() {
    return adventurers.filter(hero => !isRecruited(hero.id) && (this.role === 'All' || hero.role === this.role))
      .sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role)
        || RECRUITMENT_COSTS[a.id] - RECRUITMENT_COSTS[b.id] || a.name.localeCompare(b.name));
  }

  changeRole(role) {
    if (this.selectionDetailsClose || !ROLES.includes(role)) return;
    this.role = role;
    this.selectedId = this.availableRecruits()[0]?.id ?? null;
    this.rosterOffset = 0;
    this.detailOffset = 0;
    this.render();
  }

  preload() {
    super.preload();
    if (!this.textures.exists('tavern-interior')) {
      this.load.image('tavern-interior', new URL('../assets/environments/tavern/tavern.png', import.meta.url).href);
    }
  }

  render() {
    const entries = this.availableRecruits();

    // Re-entry, ownership changes and empty filters must never retain a hidden hero.
    if (!entries.some(hero => hero.id === this.selectedId)) {
      this.selectedId = entries[0]?.id ?? null;
      this.detailOffset = 0;
    }
    const tutorial = GameState.tutorial?.status === 'active';
    const bounds = this.frame('Tavern', 'tavern', {
      background: 'tavern-interior', resource: `${GameState.gold.toLocaleString()} Gold`,
      hint: tutorial && !isRecruited('garrick') ? 'Select Garrick, then Hire for Free to recruit your starter tank.'
        : 'Hire adventurers for your roster. Prepare your active party in Heroes.'
    });
    const roster = { x: bounds.x, y: bounds.y, width: bounds.width * 0.28, height: bounds.height };
    const preview = { x: roster.x + roster.width + 28, y: bounds.y,
      width: bounds.width * 0.49, height: bounds.height };
    featurePanel(this, roster).setAlpha(0.94);
    featurePanel(this, preview).setAlpha(0.88);
    const filterWidth = (roster.width - 64) / 3;
    ROLES.forEach((role, index) => serviceButton(this,
      roster.x + 24 + filterWidth / 2 + index % 3 * filterWidth,
      roster.y + 55 + Math.floor(index / 3) * 78, filterWidth - 6, 70, role,
      () => this.changeRole(role),
      { compact: true, selected: this.role === role, slot: 'support28', name: `tavern-filter-${role}` }));
    featureList(this, { x: roster.x + 24, y: roster.y + 178, width: roster.width - 72, height: roster.height - 208 },
      entries, (hero, x, y, width) => {
        const cost = RECRUITMENT_COSTS[hero.id];
        const face = serviceCard(this, x + width / 2, y + 77, width, 146, { selected: hero.id === this.selectedId });
        selectionCharacterPortrait(this, hero, x + 60, y + 72, 108);
        serviceText(this, x + 125, y + 10, hero.name, 'body34');
        serviceText(this, x + 125, y + 57, hero.className, 'support28');
        serviceText(this, x + 125, y + 101, cost ? `${cost.toLocaleString()} Gold` : 'Free',
          'support28', { color: cost <= GameState.gold ? '#ffdb86' : '#e6a89b' });
        featureSelect(this, x + width / 2, y + 77, width, 146, () => this.selectAdventurer(hero.id),
          { name: `tavern-character-${hero.id}`, visuals: [face] });
      }, { stride: 162, offset: this.rosterOffset, onScroll: value => { this.rosterOffset = value; } });

    if (tutorial) this.tutorialGuidance(bounds, preview);
    if (!entries.length) {
      const complete = adventurers.every(hero => isRecruited(hero.id));
      const message = complete ? 'Every adventurer has joined your cause!' : 'No adventurers available for recruitment.';
      serviceText(this, roster.x + roster.width / 2, roster.y + 290, message, 'body34',
        { align: 'center', wordWrap: { width: roster.width - 96 } }).setOrigin(0.5).setName('tavern-empty-list');
      serviceText(this, preview.x + preview.width / 2, preview.y + preview.height / 2,
        complete ? 'Your company is complete. Adventure awaits!' : 'Try another category to meet more adventurers.', 'heading38',
        { align: 'center', wordWrap: { width: preview.width - 140 } }).setOrigin(0.5).setName('tavern-empty-preview');
      return;
    }
    const hero = recruitmentPreview(this.selectedId);
    const center = preview.x + preview.width / 2;
    const identityX = preview.x + preview.width * 0.22;
    serviceText(this, center, preview.y + 46, hero.name, 'heading48').setOrigin(0.5);
    const portrait = selectionCharacterPortrait(this, hero, identityX, preview.y + 275, 340, 'townDetails', true);
    if (!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      this.tweens.add({ targets: portrait, alpha: { from: 0, to: 1 }, duration: 140 });
    }
    serviceText(this, identityX, preview.y + 465, `${hero.className}\n${hero.role}\nLevel ${hero.level}`, 'body32',
      { align: 'center', wordWrap: { width: preview.width * 0.38 } }).setOrigin(0.5);
    const stats = hero;
    const description = [CLASS_DESCRIPTIONS[hero.className],
      `Health ${Math.round(stats.maxHp)} · Mana ${Math.round(stats.maxMana ?? 0)}\nAttack ${Math.round(stats.attackPower)} · Spell ${Math.round(stats.spellPower ?? 0)}`,
      `“${RECRUITMENT_LINES[hero.id]}”`].join('\n\n');
    featureBody(this, { x: preview.x + preview.width * 0.44, y: preview.y + 100,
      width: preview.width * 0.51 - 24, height: preview.height - 275 }, description,
      this.detailOffset, value => { this.detailOffset = value; });
    serviceButton(this, preview.x + preview.width * 0.27, bounds.bottom - 78, preview.width * 0.43, 98,
      'Inspect Abilities', () => this.inspectAbilities(), { name: 'tavern-inspect' });
    const cost = RECRUITMENT_COSTS[hero.id];
    serviceButton(this, preview.x + preview.width * 0.74, bounds.bottom - 78, preview.width * 0.43, 98,
      cost ? `Hire · ${cost.toLocaleString()} Gold` : 'Hire for Free', () => this.hire(),
      { name: 'tavern-hire', enabled: cost <= GameState.gold,
        disabledReason: `You need ${cost - GameState.gold} more gold to hire ${hero.name}.` });
  }

  tutorialGuidance(bounds, preview) {
    const x = preview.x + preview.width + 28;
    const width = this.scale.width - x - 52;
    const recruit = !isRecruited('garrick');
    featurePanel(this, { x, y: bounds.y + 150, width, height: 500 }).setAlpha(0.92);
    serviceText(this, x + width / 2, bounds.y + 200, 'Your First Party', 'heading38',
      { align: 'center', wordWrap: { width: width - 48 } }).setOrigin(0.5);
    serviceText(this, x + 28, bounds.y + 255, recruit
      ? 'Select Garrick in the roster. Inspect him, then confirm Hire for Free. We will wait until he joins.'
      : 'Garrick has joined! Choose him and four companions, then save your party.', 'body32',
      { wordWrap: { width: width - 56 } });
    serviceButton(this, x + width / 2, bounds.y + 500, width - 48, 90,
      recruit ? 'Focus Garrick' : 'Choose Party', () => {
        if (recruit) {
          this.role = 'Tank'; this.rosterOffset = 0;
          this.selectAdventurer('garrick');
        } else this.scene.start('PartySelectScene', { origin: 'town', returnScene: 'TownScene' });
      }, { slot: 'body32', name: 'tutorial-continue' });
    serviceButton(this, x + width / 2, bounds.y + 600, width - 48, 80, 'Exit Tutorial', () => {
      const result = skipRecruitmentTutorial();
      this.message = result.message;
      playUiSound(this, result.ok ? 'success' : 'failure');
      this.render();
    }, { slot: 'body32', name: 'tutorial-skip' });
  }

  // Stable control names and these actions are shared with tutorial guidance.
  selectAdventurer(id) {
    if (this.selectionDetailsClose || !this.availableRecruits().some(hero => hero.id === id)) return;
    this.selectedId = id;
    this.detailOffset = 0;
    playUiSound(this, 'click');
    this.render();
  }

  inspectAbilities() {
    if (this.selectionDetailsClose || !this.availableRecruits().some(hero => hero.id === this.selectedId)) return;
    const hero = recruitmentPreview(this.selectedId);
    showSelectionDetails(this, {
      title: `${hero.name}'s Abilities`, className: hero.className, align: 'left', panelWidth: 1500,
      description: abilityEntries(hero).map(([, ability]) =>
        `${ability.name} · Unlocks at level ${abilityUnlockLevel(ability)}\n${abilityDescription(hero, ability)}`).join('\n\n')
    });
  }

  hire(id = this.selectedId) {
    if (this.selectionDetailsClose || id !== this.selectedId || !this.availableRecruits().some(hero => hero.id === id)) return;
    const hero = recruitmentPreview(id), cost = RECRUITMENT_COSTS[id];
    if (!hero) return;
    showConfirmation(this, {
      title: `Recruit ${hero.name}?`, confirmLabel: 'HIRE',
      description: `${hero.name} · ${hero.className}\n\nCost: ${cost.toLocaleString()} Gold\nCurrent gold: ${GameState.gold.toLocaleString()}\nGold remaining: ${(GameState.gold - cost).toLocaleString()}\n\nThey join your roster. Choose your active party in Heroes.`,
      onConfirm: () => {
        const index = this.availableRecruits().findIndex(entry => entry.id === id);
        const result = recruitAdventurer(id);
        this.message = result.message;
        playUiSound(this, result.ok ? cost ? 'purchase' : 'success' : 'failure');
        if (result.ok) {
          HapticsService.confirm();

          // Removing this row shifts the next recruit into its index. At the end,
          // fall back to the previous row, or clear selection for an empty category.
          const remaining = this.availableRecruits();
          this.selectedId = (remaining[index] ?? remaining.at(-1))?.id ?? null;
          this.detailOffset = 0;
        }
        this.render();
        if (result.ok) this.events.emit('adventurer-recruited', id);
      }
    });
  }
}
