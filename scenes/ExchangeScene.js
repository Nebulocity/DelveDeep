import TownFeatureScene, { featurePanel, featureBody, currentTownArtwork } from '../ui/TownFeatureUI.js';
import { serviceText, serviceButton, serviceIcon } from '../ui/TownServiceTheme.js';
import { unavailableFeature } from '../ui/FeatureToast.js';

export default class ExchangeScene extends TownFeatureScene {
  constructor() { super('ExchangeScene'); }

  render() {
    const b = this.frame('Exchange', 'exchange', { background: currentTownArtwork(), hint: 'Aether exchange is not currently available.' });
    const panel = { x: 350, y: b.y + 55, width: b.width - 596, height: b.height - 110 };
    featurePanel(this, panel);
    serviceIcon(this, 'town-hub-exchange', panel.x + 280, panel.y + panel.height / 2, 300);
    serviceText(this, panel.x + 540, panel.y + 65, 'Aether Exchange', 'display54', { color: '#d9b8ff' });
    featureBody(this, { x: panel.x + 540, y: panel.y + 175, width: panel.width - 620, height: panel.height - 365 },
      'The crystals are bright, but the exchange is not open yet.\n\nCheck back when the kobolds finish counting their gemstones.');
    serviceButton(this, panel.x + 540 + (panel.width - 620) / 2, panel.y + panel.height - 90, panel.width - 620, 100,
      'Ask about Aether', () => unavailableFeature(this), { haptic: false });
  }
}
