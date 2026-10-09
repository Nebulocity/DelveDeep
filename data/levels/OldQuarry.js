// Old Quarry inherits Dolmark's artwork and floor while selecting its own monsters.
// The world map keeps its older ID so checkpoints and saved travel remain compatible.
import dolmarkDen from './DolmarkDen.js';

export default {
  ...dolmarkDen,
  id: 'old-quarry',
  name: 'The Old Quarry',
  mapLabel: 'The Old Quarry',
  subtitle: 'An abandoned excavation haunted by creatures of stone and crystal.',
  prerequisites: ['dolmark-den']
};
