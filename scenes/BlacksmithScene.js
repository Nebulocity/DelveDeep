import FacilityScene from './FacilityScene.js';

export default class BlacksmithScene extends FacilityScene {
  constructor() { super('BlacksmithScene'); }

  init(data) {
    super.init({ ...data, title: 'Blacksmith' });
  }
}
