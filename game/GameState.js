// Session state is rebuilt from saved profile data when the game boots.
const GameState = {
  gold: 0,
  roster: [],
  activeParty: [],
  activeBattle: null,
  lastPartyIds: [],
  currentDelve: null,
  currentRoom: 0,
  rewards: [],
  leader: null,
  inventory: {
    equipment: [],
    materials: {},
    nextEquipmentId: 1,
    equipmentSchemaVersion: 2,
    knownRecipes: []
  },
  records: {},
  delveCheckpoints: {},
  everdeep: { schemaVersion: 2, runs: [], totals: { runsStarted: 0, chestsClaimed: 0 } },
  development: {
    unlockAll: false,
    replayCleared: false,
    showArenaBorder: false,
    musicEnabled: false
  },
  world: {
    currentLocation: 'pineshire',
    discoveredLocations: ['pineshire', 'slime-cave'],
    clearedDelves: [],
    travel: null
  },
  run: {
    startedAt: 0,
    elapsedMs: 0,
    summary: null,
    startingGold: 0,
    entry: 'progress'
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
