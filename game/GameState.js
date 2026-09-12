const GameState = {
  gold: 0,
  roster: [],
  activeParty: [],
  currentDelve: null,
  currentRoom: 0,
  rewards: [],
  leader: null,
  inventory: {
    healingTonic: 0,
    voidKeys: 0
  },
  records: {},
  development: {
    unlockAll: false,
    replayCleared: false
  },
  world: {
    currentLocation: 'pineshire',
    discoveredLocations: ['pineshire', 'slime-cave'],
    clearedDelves: []
  },
  run: {
    startedAt: 0,
    elapsedMs: 0,
    summary: null,
    startingGold: 0,
    startingInventory: null
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
