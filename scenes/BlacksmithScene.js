// This configures the Blacksmith's shared facility screen with its gear and crafting
// actions. The underlying inventory and purchase rules live in game/ShopServices.js.

import FacilityScene from './FacilityScene.js';

export default class BlacksmithScene extends FacilityScene {

  // We set up this instance's starting state. Values stored on this belong to this
  // instance and can be reused by its other methods.
  constructor() { super('BlacksmithScene'); }

  // Read the data supplied when this scene starts before creating its screen contents.
  init(data) {

    // ... copies the source's own fields into this object; fields listed later replace
    // earlier ones. This is a shallow copy, so nested objects are still shared.
    super.init({ ...data, title: 'Blacksmith' });
  }
}
