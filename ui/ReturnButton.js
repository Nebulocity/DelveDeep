import HapticsService from '../services/HapticsService.js';

export function addReturnButton(scene, destination, onReturn, { x = 312, y = 166, feedback = 'tap' } = {}) {
  const button = scene.add.rectangle(x, y, 520, 76, 0x382014, 0.94)
    .setStrokeStyle(3, 0xd4a15e)
    .setInteractive({ useHandCursor: true });
  scene.add.text(x, y, `Return to ${destination}`, {
    fontFamily: 'Arial', fontSize: '36px', fontStyle: 'bold', color: '#fff1d2'
  }).setOrigin(0.5);
  button.on('pointerdown', () => {
    HapticsService[feedback]();
    onReturn();
  });
  return button;
}
