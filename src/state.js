function newGame() {
  const party = ["knight", "rogue", "cleric"].map(id => HERO_LIBRARY[id].make());
  const modifier = randomRunModifier();
  return {
    floor: 1,
    gold: 0,
    bestFloor: 1,
    modifierId: modifier.id,
    party,
    enemies: [],
    inBattle: false,
    waitingForUpgrade: false,
    global: {
      goldMult: 1,
      luck: 0,
      startShield: 0,
      teamBonus: {
        maxHp: 0,
        atk: 0,
        def: 0,
        spd: 0
      }
    },
    upgradeLedger: [],
    currentChoices: [],
    currentGoldChoice: null,
    bossRewardPending: false,
    goldChoicePurchased: false,
    goldPurchaseCount: 0,
    log: []
  };
}
