import TownFeatureScene, { featurePanel, featureBody, currentTownArtwork } from '../ui/TownFeatureUI.js';
import { serviceText, serviceButton, serviceIcon } from '../ui/TownServiceTheme.js';
import { unavailableFeature } from '../ui/FeatureToast.js';

export default class TavernScene extends TownFeatureScene {
  constructor() { super('TavernScene'); }

  render() {
    const b = this.frame('Tavern', 'tavern', { background: currentTownArtwork(), hint: 'Tavern activities are still under construction.' });
    const welcome = { x: 240, y: b.y + 80, width: 850, height: b.height - 160 };
    const service = { x: 1140, y: b.y + 130, width: b.width - 1270, height: b.height - 260 };
    featurePanel(this, welcome); featurePanel(this, service);
    serviceIcon(this, 'town-hub-tavern', welcome.x + 425, welcome.y + 180, 230);
    serviceText(this, welcome.x + 425, welcome.y + 360, 'The Tavern', 'display54').setOrigin(0.5);
    serviceText(this, welcome.x + 425, welcome.y + 450, 'A place for future town activities.', 'body34', { wordWrap: { width: 680 }, align: 'center' }).setOrigin(0.5);
    featureBody(this, { x: service.x + 50, y: service.y + 45, width: service.width - 130, height: service.height - 210 },
      'The innkeeper is preparing the room.\n\nThe tavern has not opened for business yet.');
    serviceButton(this, service.x + service.width / 2, service.y + service.height - 85, service.width - 130, 104,
      'Speak to the innkeeper', () => unavailableFeature(this), { haptic: false });
  }
}
