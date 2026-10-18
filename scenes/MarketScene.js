import FacilityScene from './FacilityScene.js';

// The Market has its own navigation identity and merchant workspace. Shared service
// rows and transactions remain owned by FacilityScene and the existing game modules.
export default class MarketScene extends FacilityScene {
  constructor() { super('MarketScene'); }

  init(data) {
    super.init({ title: data?.vendor ?? this.vendor ?? 'Blacksmith', returnScene: 'TownScene' });
    this.vendor = this.facility.name;
    if (this.facility.choices.some(choice => choice.id === data?.catalogAction)) this.selection = data.catalogAction;
    this.selectedItemId = data?.itemId ?? null;
  }

  selectMerchant(vendor) {
    if (vendor === this.vendor) return;
    this.init({ vendor });
    this.render();
  }
}
