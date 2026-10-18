import TownFeatureScene, { featurePanel, featureBody, currentTownArtwork } from '../ui/TownFeatureUI.js';
import { serviceText, serviceButton, serviceIcon } from '../ui/TownServiceTheme.js';
import { unavailableFeature } from '../ui/FeatureToast.js';

export default class QuestJournalScene extends TownFeatureScene {
  constructor() { super('QuestJournalScene'); }

  render() {
    const b = this.frame('Quest Journal', 'quests', { background: currentTownArtwork(), hint: 'The scribes are still preparing the quest journal.' });
    featurePanel(this, { ...b, width: 540 });
    serviceText(this, 322, b.y + 64, 'Journal Sections', 'heading40').setOrigin(0.5);
    ['Available quests', 'Active quests', 'Completed quests'].forEach((label, index) => {
      serviceButton(this, 322, b.y + 190 + index * 160, 430, 112, label, () => unavailableFeature(this), { compact: true, haptic: false });
    });
    const journal = { x: 620, y: b.y, width: b.width - 568, height: b.height };
    featurePanel(this, journal);
    serviceIcon(this, 'town-hub-quests', journal.x + 150, b.y + 160, 190);
    serviceText(this, journal.x + 300, b.y + 110, 'A story yet to be written', 'heading48', { wordWrap: { width: journal.width - 360 } });
    featureBody(this, { x: journal.x + 65, y: b.y + 305, width: journal.width - 150, height: b.height - 380 },
      'The journal’s pages are waiting for their first adventure.\n\nQuests, objectives and rewards are not available yet.');
  }
}
