// Finished PixelLab sheets keep each Thornbriar skill visually distinct.
// All effects have 32 frames at 20 FPS and fade on the existing combat clock.
export const THORNBRIAR_ABILITY_EFFECTS = {
  'Whip Lash': { file: 'whip-impact', width: 112, height: 96, anchorY: 48 },
  'Bramble Shroud': { file: 'bramble-shroud', width: 112, height: 128, anchorY: 94, groundAtFeet: true },
  'Briar Bolt': { file: 'briar-impact', width: 96, height: 96, anchorY: 48 },
  'Mace Sweep': { file: 'mace-sweep', width: 160, height: 96, anchorY: 48, area: true },
  'Intimidating Stomp': { file: 'intimidating-stomp', width: 192, height: 112, anchorY: 67, area: true },
  Belch: { file: 'belch', width: 192, height: 128, anchorY: 80, area: true, headAtCaster: true, opacity: 0.65 }
};

for (const sheet of Object.values(THORNBRIAR_ABILITY_EFFECTS)) {
  sheet.key = 'thornbriar-' + sheet.file;
  sheet.frames = 32;
  sheet.fps = 20;
  sheet.url = new URL(`../assets/effects/monster-thornbriar/${sheet.file}.png`, import.meta.url).href;
}

// Thornbriar impacts load only in this encounter; the shared travel loader owns flights.
export function preloadThornbriarAbilityEffects(scene) {
  for (const sheet of Object.values(THORNBRIAR_ABILITY_EFFECTS)) {
    if (!scene.textures.exists(sheet.key)) scene.load.spritesheet(sheet.key, sheet.url, {
      frameWidth: sheet.width, frameHeight: sheet.height, endFrame: sheet.frames - 1
    });
  }
}
