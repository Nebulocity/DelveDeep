const GameState = {
  gold: 0,
  roster: [],
  activeParty: [],
  currentDelve: null,
  currentRoom: 0,
  rewards: [],
  leader: null,
  inventory: {
    healingTonic: 0
  },
  records: {},
  run: {
    startedAt: 0,
    elapsedMs: 0,
    summary: null
  },
  tactics: {
    tankPosition: 'center',
    meleePosition: 'auto',
    rangedFormation: 'spread',
    healerFormation: 'back',
    mechanicResponse: 'avoid'
  }
};

export default GameState;
