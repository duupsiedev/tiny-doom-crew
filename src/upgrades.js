function rollUpgradeChoices() {
  const bossReward = !!game.bossRewardPending;
  const personal = buildPersonalUpgradePool(bossReward);
  const global = buildGlobalUpgradePool(bossReward);
  const recruits = buildRecruitPool();

  shuffle(personal);
  shuffle(global);
  shuffle(recruits);

  const choices = [];

  // Recruitment should not be pure lottery misery.
  // If a recruit is available, guarantee one recruit option.
  if (recruits.length > 0) {
    choices.push(recruits[0]);
  }

  // Then try to show both upgrade families:
  // personal = stronger single-character boost
  // team = weaker retroactive party boost
  if (personal.length > 0) choices.push(personal[0]);
  if (global.length > 0) choices.push(global[0]);

  // Fill remaining slots with a mixed pool.
  const combined = [
    ...personal.slice(1),
    ...global.slice(1),
    ...recruits.slice(1)
  ];
  shuffle(combined);

  const freeChoiceCount = bossReward ? 4 : 3;
  while (choices.length < freeChoiceCount && combined.length) choices.push(combined.pop());

  // In case there are more than the target somehow, trim to the screen's choice count.
  // but the other two choices still vary.
  game.currentChoices = choices.slice(0, freeChoiceCount);
  game.currentGoldChoice = buildGoldTrainingChoice();
}

function getLuck() {
  return Math.max(0, Number((game.global && game.global.luck) || 0));
}

function getEffectiveLuck() {
  const clearedStages = Math.max(0, (game.floor || 1) - 1);
  return getLuck() + clearedStages * HIDDEN_LUCK_PER_STAGE;
}

function availableRarities() {
  const luck = getLuck();
  return RARITIES.filter(r =>
    r.id !== "mystical" || luck >= LUCK_MYSTICAL_UNLOCK
  ).filter(r =>
    r.id !== "legend" || luck >= LUCK_LEGEND_UNLOCK
  );
}

function rollRarity(allowLuck = false, bossReward = false) {
  const luck = getEffectiveLuck();
  const available = availableRarities();
  const baseWeights = {
    common: allowLuck ? 0 : 70,
    rare: allowLuck ? 72 : 24 + luck * 1.4,
    gilded: 6 + luck * 1.1,
    mystical: luck >= LUCK_MYSTICAL_UNLOCK ? 14 + (luck - LUCK_MYSTICAL_UNLOCK) * 2.4 : 0,
    legend: luck >= LUCK_LEGEND_UNLOCK ? 6 + (luck - LUCK_LEGEND_UNLOCK) * 1.1 : 0
  };

  if (bossReward) {
    baseWeights.rare += baseWeights.common;
    baseWeights.common = 0;
    baseWeights.gilded *= 2;
    baseWeights.mystical *= 2;
    baseWeights.legend *= 2;
  }

  const weighted = available
    .map(r => ({ rarity: r.id, weight: Math.max(0, baseWeights[r.id] || 0) }))
    .filter(x => x.weight > 0);
  const total = weighted.reduce((sum, x) => sum + x.weight, 0);
  let roll = Math.random() * total;

  for (const entry of weighted) {
    roll -= entry.weight;
    if (roll <= 0) return entry.rarity;
  }

  return allowLuck ? "rare" : "common";
}

function rarityLabel(rarity) {
  return (RARITY_BY_ID[rarity] || RARITY_BY_ID.common).label;
}

function rarityUnlockText(luck = getLuck()) {
  if (luck >= LUCK_LEGEND_UNLOCK) return "Legend unlocked";
  if (luck >= LUCK_MYSTICAL_UNLOCK) return `Mystical unlocked, Legend at ${LUCK_LEGEND_UNLOCK}`;
  return `Mystical at ${LUCK_MYSTICAL_UNLOCK}, Legend at ${LUCK_LEGEND_UNLOCK}`;
}

function displayLuck(value = getLuck()) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function withRarity(choice, rarity) {
  return Object.assign(choice, {
    rarity,
    rarityLabel: rarityLabel(rarity)
  });
}

function uniqueChance() {
  return Math.min(.5, UNIQUE_BASE_CHANCE + getLuck() * .005);
}

function rarityOddsText(bossReward = false) {
  const luck = getEffectiveLuck();
  const weights = {
    common: 70,
    rare: 24 + luck * 1.4,
    gilded: 6 + luck * 1.1,
    mystical: luck >= LUCK_MYSTICAL_UNLOCK ? 14 + (luck - LUCK_MYSTICAL_UNLOCK) * 2.4 : 0,
    legend: luck >= LUCK_LEGEND_UNLOCK ? 6 + (luck - LUCK_LEGEND_UNLOCK) * 1.1 : 0
  };

  if (bossReward) {
    weights.rare += weights.common;
    weights.common = 0;
    weights.gilded *= 2;
    weights.mystical *= 2;
    weights.legend *= 2;
  }

  const available = availableRarities().map(r => r.id);
  const total = Object.entries(weights)
    .filter(([rarity]) => available.includes(rarity))
    .reduce((sum, [, weight]) => sum + Math.max(0, weight), 0);

  return ["common", "rare", "gilded", "mystical", "legend"]
    .filter(rarity => available.includes(rarity) && weights[rarity] > 0)
    .map(rarity => `${rarityLabel(rarity)} ${Math.round((weights[rarity] / total) * 100)}%`)
    .join(" · ");
}

function maybeAddUnique(choice, rarity, preferredHero = null, avoidStat = null) {
  if (Math.random() >= uniqueChance()) return choice;

  const hero = preferredHero || game.party[Math.floor(Math.random() * game.party.length)];
  if (!hero) return choice;

  const stats = ["maxHp", "atk", "def", "spd"].filter(stat => stat !== avoidStat);
  const stat = stats[Math.floor(Math.random() * stats.length)];
  const amount = classAmount(hero, stat, false, rarity);
  const baseApply = choice.apply;

  choice.unique = { hero, stat, amount, rarity };
  choice.desc += ` Unique: ${rarityLabel(rarity)} ${hero.name} also gains +${displayAmount(stat, amount)} ${statLabel(stat)}.`;
  choice.apply = () => {
    baseApply();
    hero.personalBonus[stat] += amount;
    applyAllBonusesToHero(hero, true);
    ledger(`Unique ${rarityLabel(rarity)} bonus: ${hero.name} gained +${displayAmount(stat, amount)} ${statLabel(stat)}.`);
  };

  return choice;
}

function classAmount(hero, stat, paid = false, rarity = null) {
  const template = HERO_LIBRARY[hero.id] || HERO_LIBRARY.knight;
  const base = BASE_PERSONAL[stat];
  const biasKey = stat === "maxHp" ? "hpBias" : `${stat}Bias`;
  const bias = template[biasKey] || 1;
  const strength = paid ? 2 : 1;
  const amount = base * bias * strength;
  return scaledAmount(amount, stat, rarity);
}

function teamAmount(stat, paid = false, rarity = null) {
  const amount = BASE_TEAM[stat] * (paid ? 2 : 1);
  return scaledAmount(amount, stat, rarity);
}

function luckAmount(rarity) {
  const info = RARITY_BY_ID[rarity] || RARITY_BY_ID.rare;
  return round2(BASE_LUCK * (info.luckMult || 1));
}

function buildPersonalUpgradePool(bossReward = false) {
  const pool = [];
  const stats = ["maxHp", "atk", "def", "spd"];

  for (const hero of game.party) {
    for (const stat of stats) {
      const rarity = rollRarity(false, bossReward);
      const amount = classAmount(hero, stat, false, rarity);
      pool.push(maybeAddUnique(withRarity({
        kind: "personal",
        title: `${hero.name}: +${displayAmount(stat, amount)} ${statLabel(stat)}`,
        desc: personalDesc(hero, stat, amount),
        apply: () => {
          hero.personalBonus[stat] += amount;
          applyAllBonusesToHero(hero, true);
          ledger(`${rarityLabel(rarity)} ${hero.name} gained +${displayAmount(stat, amount)} ${statLabel(stat)}.`);
        }
      }, rarity), rarity, hero, stat));
    }
  }

  return pool;
}

function buildGlobalUpgradePool(bossReward = false) {
  const pool = [];
  const stats = ["maxHp", "atk", "def", "spd"];

  for (const stat of stats) {
    const rarity = rollRarity(false, bossReward);
    const amount = teamAmount(stat, false, rarity);
    pool.push(maybeAddUnique(withRarity({
      kind: "team",
      title: `Team: +${displayAmount(stat, amount)} ${statLabel(stat)}`,
      desc: `Weaker than personal training, but retroactive. New recruits also get it.`,
      apply: () => {
        game.global.teamBonus[stat] += amount;
        applyTeamBonusesToAll(true);
        ledger(`${rarityLabel(rarity)} team gained +${displayAmount(stat, amount)} ${statLabel(stat)}.`);
      }
    }, rarity), rarity));
  }

  const shieldRarity = rollRarity(false, bossReward);
  const shieldAmount = scaledAmount(12, "maxHp", shieldRarity);
  pool.push(maybeAddUnique(withRarity({
    kind: "team",
    title: `Team: +${fmtNumber(shieldAmount)} Start Shield`,
    desc: "Every hero starts combat with extra shield. New recruits benefit too.",
    apply: () => {
      game.global.startShield += shieldAmount;
      ledger(`${rarityLabel(shieldRarity)} team gained +${fmtNumber(shieldAmount)} starting shield.`);
    }
  }, shieldRarity), shieldRarity));

  const goldRarity = rollRarity(false, bossReward);
  const goldPercent = scaledAmount(25, "maxHp", goldRarity);
  pool.push(maybeAddUnique(withRarity({
    kind: "team",
    title: `Treasure Nose: +${fmtNumber(goldPercent)}% Gold`,
    desc: "More gold means more paid training. The capitalism rat approves.",
    apply: () => {
      game.global.goldMult *= 1 + goldPercent / 100;
      ledger(`${rarityLabel(goldRarity)} gold drops increased by ${fmtNumber(goldPercent)}%.`);
    }
  }, goldRarity), goldRarity));

  const luckRarity = rollRarity(true, bossReward);
  const luck = luckAmount(luckRarity);
  pool.push(maybeAddUnique(withRarity({
    kind: "luck",
    title: `Lucky Charm: +${luck} Luck`,
    desc: `Unlocks Mystical at ${LUCK_MYSTICAL_UNLOCK} Luck and Legend at ${LUCK_LEGEND_UNLOCK} Luck. Luck scales gently by rarity.`,
    apply: () => {
      game.global.luck = getLuck() + luck;
      ledger(`${rarityLabel(luckRarity)} luck increased by ${luck}.`);
    }
  }, luckRarity), luckRarity));

  return pool;
}

function buildRecruitPool() {
  const pool = [];

  if (!hasHero("rogue")) {
    pool.push({
      kind: "recruit",
      title: "Recruit Rogue",
      desc: "Fast, fragile, and legally considered a cutlery incident.",
      apply: () => {
        recruitHero("rogue");
        addLog("🗡️ Rogue joins the crew. Hide the shiny things.", "weird");
        ledger("Recruited Rogue.");
      }
    });
  }

  if (!hasHero("cleric") && game.floor >= 4) {
    pool.push({
      kind: "recruit",
      title: "Recruit Cleric",
      desc: "Heals allies and judges everyone quietly.",
      apply: () => {
        recruitHero("cleric");
        addLog("✨ Cleric joins the crew. The vibe becomes 14% safer.", "weird");
        ledger("Recruited Cleric.");
      }
    });
  }

  return pool;
}


function goldTrainingCost() {
  const n = game.goldPurchaseCount || 0;
  return Math.round((GOLD_TRAINING_BASE_COST + GOLD_TRAINING_LINEAR * n) * Math.pow(GOLD_TRAINING_MULT, n));
}

function buildGoldTrainingChoice() {
  const stats = ["maxHp", "atk", "def", "spd"];
  const candidates = [];
  const cost = goldTrainingCost();

  // Paid personal upgrades: double-strength, focused on one hero.
  for (const hero of game.party) {
    for (const stat of stats) {
      const amount = classAmount(hero, stat, true);
      const uniqueRarity = rollRarity(false, !!game.bossRewardPending);
      candidates.push(maybeAddUnique({
        kind: "gold-personal",
        title: `Gold Training: ${hero.name} +${displayAmount(stat, amount)} ${statLabel(stat)}`,
        desc: `Costs ${fmtNumber(cost)} gold. Double-strength personal stat training.`,
        cost,
        apply: () => {
          hero.personalBonus[stat] += amount;
          applyAllBonusesToHero(hero, true);
          game.gold -= cost;
          game.goldPurchaseCount = (game.goldPurchaseCount || 0) + 1;
          game.goldChoicePurchased = true;
          ledger(`Gold personal training: ${hero.name} gained +${displayAmount(stat, amount)} ${statLabel(stat)} for ${fmtNumber(cost)} gold.`);
        }
      }, uniqueRarity, hero, stat));
    }
  }

  // Paid team upgrades: double-strength team bonuses, retroactive and inherited by future recruits.
  for (const stat of stats) {
    const amount = teamAmount(stat, true);
    const uniqueRarity = rollRarity(false, !!game.bossRewardPending);
    candidates.push(maybeAddUnique({
      kind: "gold-team",
      title: `Gold Team Drill: +${displayAmount(stat, amount)} ${statLabel(stat)} Team`,
      desc: `Costs ${fmtNumber(cost)} gold. Double-strength team upgrade. Retroactive and inherited by new recruits.`,
      cost,
      apply: () => {
        game.global.teamBonus[stat] += amount;
        applyTeamBonusesToAll(true);
        game.gold -= cost;
        game.goldPurchaseCount = (game.goldPurchaseCount || 0) + 1;
        game.goldChoicePurchased = true;
        ledger(`Gold team drill: team gained +${displayAmount(stat, amount)} ${statLabel(stat)} for ${fmtNumber(cost)} gold.`);
      }
    }, uniqueRarity));
  }

  const shieldUniqueRarity = rollRarity(false, !!game.bossRewardPending);
  candidates.push(maybeAddUnique({
    kind: "gold-team",
    title: "Gold Team Drill: +24 Start Shield",
    desc: `Costs ${fmtNumber(cost)} gold. Double-strength starting shield for every hero.`,
    cost,
    apply: () => {
      game.global.startShield += 24;
      game.gold -= cost;
      game.goldPurchaseCount = (game.goldPurchaseCount || 0) + 1;
      game.goldChoicePurchased = true;
      ledger(`Gold team drill: team gained +24 starting shield for ${fmtNumber(cost)} gold.`);
    }
  }, shieldUniqueRarity));

  shuffle(candidates);
  return candidates[0];
}

function personalDesc(hero, stat, amount) {
  const flavor = {
    knight: {
      maxHp: "Knight specialty. Big shield, bigger refusal to die.",
      atk: "A modest bonk boost for the honest class.",
      def: "Knight likes this. Enemies develop wrist pain.",
      spd: "Not his specialty, but even armor can jog angrily."
    },
    rogue: {
      maxHp: "Rogue gets a little less evaporatable.",
      atk: "Rogue specialty. The knife starts filing taxes as a weapon.",
      def: "A tiny bit of armor. Rogue complains.",
      spd: "Rogue likes this. More ankle crimes per second."
    },
    cleric: {
      maxHp: "Solid middle-ground survivability.",
      atk: "A balanced holy bonk improvement.",
      def: "Balanced protection for the party babysitter.",
      spd: "Balanced tempo. Faster heals, fewer panic noises."
    }
  };

  return flavor[hero.id]?.[stat] || `Class-specific training for +${displayAmount(stat, amount)} ${statLabel(stat)}.`;
}

function chooseUpgrade(index) {
  if (!game.waitingForUpgrade || !game.currentChoices) return;
  const choice = game.currentChoices[index];
  if (!choice) return;

  choice.apply();
  addLog(`Upgrade chosen: ${choice.title}.`, "important");

  game.waitingForUpgrade = false;
  game.bossRewardPending = false;
  game.currentChoices = [];
  game.currentGoldChoice = null;
  document.getElementById("messageBox").textContent = "Upgrade locked in. Start the next fight when ready.";
  saveGame(true);
  render();
}

function buyGoldTraining() {
  if (!game.waitingForUpgrade || !game.currentGoldChoice || game.goldChoicePurchased) return;

  const choice = game.currentGoldChoice;
  const cost = choice.cost || goldTrainingCost();

  if (game.gold < cost) {
    addLog(`Need ${fmtNumber(cost)} gold for paid training. The trainer refuses payment in vibes.`, "bad");
    return;
  }

  choice.apply();
  addLog(`Paid upgrade bought: ${choice.title}. Next paid training will cost ${fmtNumber(goldTrainingCost())} gold.`, "important");
  saveGame(true);
  render();
}

function hasHero(id) {
  return game.party.some(h => h.id === id);
}

function displayAmount(stat, amount) {
  return stat === "spd" ? amount.toFixed(2) : fmtNumber(amount);
}

function statLabel(stat) {
  return {
    maxHp: "HP",
    atk: "ATK",
    def: "DEF",
    spd: "SPD"
  }[stat] || stat;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function ledger(text) {
  game.upgradeLedger = game.upgradeLedger || [];
  game.upgradeLedger.push({
    floor: game.floor,
    text
  });
  if (game.upgradeLedger.length > 120) game.upgradeLedger.shift();
}

function addLog(text, type = "") {
  if (!Array.isArray(game.log)) game.log = [];
  game.log.push({ text, type });
  if (game.log.length > 80) game.log.shift();
  if (typeof renderLog === "function") renderLog();
}
