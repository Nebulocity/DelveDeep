// Session state is rebuilt from saved profile data when the game boots.
const GameState = {
  gold: 0,
  roster: [],
  activeParty: [],
  lastPartyIds: [],
  currentDelve: null,
  currentRoom: 0,
  rewards: [],
  leader: null,
  inventory: {
    equipment: [],
    materials: {},
    nextEquipmentId: 1,
    equipmentSchemaVersion: 1
  },
  records: {},
  development: {
    unlockAll: false,
    replayCleared: false,
    showGridLines: true
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
    startingGold: 0
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
