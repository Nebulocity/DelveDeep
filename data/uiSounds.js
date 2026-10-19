// Assign URLs only after checking commercial rights and listening to the final files.
// Missing sounds stay silent instead of borrowing music or generating placeholder tones.
export const UI_SOUNDS = Object.freeze({
  click: { filename: 'ui-click.ogg', duration: '0.04-0.10 s', description: 'Soft dry wooden tick, restrained attack, no ringing tail.', event: 'Ordinary selection, filter or toggle', priority: 0 },
  navigation: { filename: 'ui-navigation.ogg', duration: '0.12-0.22 s', description: 'Gentle leather and parchment movement with a quiet wooden accent.', event: 'Open a destination, switch screens, return or travel', priority: 2 },
  dialogOpen: { filename: 'ui-dialog-open.ogg', duration: '0.10-0.18 s', description: 'Subtle parchment unfolding, clean and unobtrusive.', event: 'Open details, settings, tutorial or utility dialog', priority: 1 },
  dialogClose: { filename: 'ui-dialog-close.ogg', duration: '0.08-0.15 s', description: 'Short soft parchment settling, distinct from opening.', event: 'Dismiss or cancel a dialog', priority: 1 },
  success: { filename: 'ui-success.ogg', duration: '0.18-0.35 s', description: 'Small warm resolved metallic accent, no fanfare.', event: 'Successful confirmed action or tactic unlock', priority: 3 },
  failure: { filename: 'ui-failure.ogg', duration: '0.12-0.25 s', description: 'Muted low wooden double knock, no harsh buzzer.', event: 'An attempted action fails a real requirement or operation errors', priority: 5 },
  purchase: { filename: 'ui-purchase.ogg', duration: '0.20-0.40 s', description: 'Two or three small gold coins settling on wood, quiet tail.', event: 'Completed purchase, sale or paid merchant transaction', priority: 4 },
  training: { filename: 'ui-training.ogg', duration: '0.25-0.45 s', description: 'Page turn with a restrained bright magical resolution.', event: 'Successfully learn or train an ability rank', priority: 4 },
  equipment: { filename: 'ui-equipment.ogg', duration: '0.12-0.28 s', description: 'Soft leather strap with a small metal buckle click.', event: 'Successfully equip or unequip gear, an ability or a tactic', priority: 4 }
});

export const UI_SOUND_ASSET_REQUIREMENTS = Object.freeze({
  format: 'Ogg Vorbis (.ogg), mono, 44.1 or 48 kHz; retain lossless WAV masters outside runtime',
  processing: 'Trim leading silence, gentle tail fade, no clipping, comparable perceived loudness, no music or voice',
  license: 'Original commissioned/owned audio, CC0 with verified provenance, or a license explicitly allowing commercial game redistribution',
  status: 'All nine assets missing. No sound URL or verified commercial license has been assigned.'
});

export function preloadUiSounds(scene) {
  for (const [event, asset] of Object.entries(UI_SOUNDS)) {
    if (asset.url && asset.license?.verified === true && !scene.cache.audio.exists(`ui-${event}`)) {
      scene.load.audio(`ui-${event}`, asset.url);
    }
  }
}
