window.addEventListener("error", function(event) {
  const box = document.getElementById("messageBox");
  if (box) box.textContent = "JavaScript error: " + event.message;
});

const SAVE_KEY = "pocket_dungeon_tiny_doom_crew_v040";
const LEGACY_SAVE_KEYS = ["pocket_dungeon_tiny_doom_crew_v036"];

const HERO_LIBRARY = {
  knight: {
    id: "knight",
    name: "Knight",
    emoji: "🛡️",
    role: "Tanky bruiser",
    maxHp: 115,
    atk: 13,
    def: 5,
    spd: 1.00,
    hpBias: 1.45,
    atkBias: .85,
    defBias: 1.25,
    spdBias: .80,
    skillText: "Every 4th attack heals self.",
    make() {
      return makeUnit(this, "hero");
    }
  },
  rogue: {
    id: "rogue",
    name: "Rogue",
    emoji: "🗡️",
    role: "Fast crit goblin",
    maxHp: 68,
    atk: 9,
    def: 1,
    spd: 1.85,
    crit: .25,
    hpBias: .80,
    atkBias: 1.45,
    defBias: .75,
    spdBias: 1.25,
    skillText: "25% chance to crit for double damage.",
    make() {
      return makeUnit(this, "hero");
    }
  },
  cleric: {
    id: "cleric",
    name: "Cleric",
    emoji: "✨",
    role: "Healer",
    maxHp: 82,
    atk: 6,
    def: 2,
    spd: 1.05,
    healer: true,
    hpBias: 1.05,
    atkBias: 1.00,
    defBias: 1.00,
    spdBias: 1.00,
    skillText: "Every 3rd action heals the weakest ally.",
    make() {
      return makeUnit(this, "hero");
    }
  }
};

const ENEMY_LIBRARY = {
  rat: {
    id: "rat",
    name: "Dungeon Rat",
    emoji: "🐀",
    maxHp: 26,
    atk: 5,
    def: 0,
    spd: 1.25
  },
  slime: {
    id: "slime",
    name: "Grumpy Slime",
    emoji: "🟢",
    maxHp: 42,
    atk: 4,
    def: 2,
    spd: .80
  },
  goblin: {
    id: "goblin",
    name: "Pocket Goblin",
    emoji: "👺",
    maxHp: 36,
    atk: 8,
    def: 1,
    spd: 1.05
  },
  bat: {
    id: "bat",
    name: "Rude Bat",
    emoji: "🦇",
    maxHp: 28,
    atk: 6,
    def: 0,
    spd: 1.65
  },
  boss5: {
    id: "boss5",
    name: "Big Gob",
    emoji: "💢",
    maxHp: 175,
    atk: 14,
    def: 3,
    spd: .85,
    boss: true,
    skillText: "Every 3rd attack hits harder."
  },
  boss10: {
    id: "boss10",
    name: "The Snackromancer",
    emoji: "💀",
    maxHp: 255,
    atk: 16,
    def: 4,
    spd: .86,
    boss: true,
    skillText: "A suspiciously dramatic floor 10 boss."
  }
};

const SCALED_BOSSES = [
  { name: "Baron von Bonk", skillText: "Every hit arrives with unnecessary nobility." },
  { name: "Count Snackula", skillText: "Counts your snacks, then steals the important ones." },
  { name: "The Toe Accountant", skillText: "Audits footwork and charges interest in bruises." },
  { name: "Sir Slaps-a-Lot", skillText: "Knighted for services to palm-based violence." },
  { name: "Duchess Oops", skillText: "Trips into victory with alarming consistency." },
  { name: "The Rent Gobbler", skillText: "Collects monthly payments in panic." },
  { name: "Mold King Gary", skillText: "Royal, fuzzy, and bad for ventilation." },
  { name: "Professor Bad Choices", skillText: "Teaches advanced regret with lab credits." },
  { name: "Lady Crumbstorm", skillText: "Leaves a trail and calls it strategy." },
  { name: "The Dramatic Yam", skillText: "Monologues before every root-based attack." },
  { name: "Captain Taxes", skillText: "Deducts morale before damage is calculated." },
  { name: "Grandpa Thunderpants", skillText: "Moves slowly until the room becomes weather." },
  { name: "The Vibe Auditor", skillText: "Finds your build suspiciously cheerful." },
  { name: "Lord Wobbleknees", skillText: "Unstable stance, stable hatred." },
  { name: "Queen Stompsalot", skillText: "Issues royal decrees directly to the floor." },
  { name: "The Soup Pretender", skillText: "Claims to be broth. Hits like furniture." },
  { name: "Major Problem", skillText: "Promoted for being everyone else's issue." },
  { name: "The Dungeon Landlord", skillText: "Raises the stakes and calls it maintenance." },
  { name: "Archduke Noodlefist", skillText: "Flexible title. Questionable hands." },
  { name: "The Unpaid Intern", skillText: "No benefits, all resentment." }
];

const MODIFIER_RARITY_WEIGHTS = {
  common: 60,
  rare: 30,
  epic: 8,
  legendary: 2
};

const RUN_MODIFIERS = [
  { id: "nothingToday", rarity: "common", name: "Nothing Today, Sorry", desc: "No modifier. The dungeon forgot to be weird." },
  { id: "youAreTheBlob", rarity: "common", name: "You Are The Blob", desc: "HP augments +50%. Speed augments -50%.", augmentMult: { maxHp: 1.5, spd: .5 } },
  { id: "damageWhatsThat", rarity: "common", name: "Damage? What's That?", desc: "DEF augments +50%. ATK augments -50%.", augmentMult: { def: 1.5, atk: .5 } },
  { id: "noSurvivalNeeded", rarity: "common", name: "I Don't Need To Survive", desc: "ATK augments +50%. HP augments -50%.", augmentMult: { atk: 1.5, maxHp: .5 } },
  { id: "fastNotFurious", rarity: "common", name: "Fast, Not Furious", desc: "Speed augments +50%. DEF augments -50%.", augmentMult: { spd: 1.5, def: .5 } },
  { id: "pillowArmor", rarity: "common", name: "Pillow Armor", desc: "HP augments +50%. ATK augments -50%.", augmentMult: { maxHp: 1.5, atk: .5 } },
  { id: "glassSneakers", rarity: "common", name: "Glass Sneakers", desc: "Speed augments +50%. HP augments -50%.", augmentMult: { spd: 1.5, maxHp: .5 } },
  { id: "brickYoga", rarity: "common", name: "Brick Yoga", desc: "DEF augments +50%. Speed augments -50%.", augmentMult: { def: 1.5, spd: .5 } },
  { id: "angryCardboard", rarity: "common", name: "Angry Cardboard", desc: "ATK augments +50%. DEF augments -50%.", augmentMult: { atk: 1.5, def: .5 } },

  { id: "helmetConfetti", rarity: "rare", name: "Helmet Confetti", desc: "HP and ATK augments +25%. DEF augments -25%.", augmentMult: { maxHp: 1.25, atk: 1.25, def: .75 } },
  { id: "SoupFueled", rarity: "rare", name: "Soup Fueled", desc: "HP and ATK augments +25%. Speed augments -25%.", augmentMult: { maxHp: 1.25, atk: 1.25, spd: .75 } },
  { id: "FortressWithShoes", rarity: "rare", name: "Fortress With Shoes", desc: "HP and DEF augments +25%. ATK augments -25%.", augmentMult: { maxHp: 1.25, def: 1.25, atk: .75 } },
  { id: "CautiousZoomies", rarity: "rare", name: "Cautious Zoomies", desc: "HP and DEF augments +25%. Speed augments -25%.", augmentMult: { maxHp: 1.25, def: 1.25, spd: .75 } },
  { id: "BouncyCastle", rarity: "rare", name: "Bouncy Castle", desc: "HP and Speed augments +25%. ATK augments -25%.", augmentMult: { maxHp: 1.25, spd: 1.25, atk: .75 } },
  { id: "MarathonMittens", rarity: "rare", name: "Marathon Mittens", desc: "HP and Speed augments +25%. DEF augments -25%.", augmentMult: { maxHp: 1.25, spd: 1.25, def: .75 } },
  { id: "PointyTurtle", rarity: "rare", name: "Pointy Turtle", desc: "ATK and DEF augments +25%. HP augments -25%.", augmentMult: { atk: 1.25, def: 1.25, maxHp: .75 } },
  { id: "WallOfForks", rarity: "rare", name: "Wall Of Forks", desc: "ATK and DEF augments +25%. Speed augments -25%.", augmentMult: { atk: 1.25, def: 1.25, spd: .75 } },
  { id: "PanicBlender", rarity: "rare", name: "Panic Blender", desc: "ATK and Speed augments +25%. HP augments -25%.", augmentMult: { atk: 1.25, spd: 1.25, maxHp: .75 } },
  { id: "DramaticWindmill", rarity: "rare", name: "Dramatic Windmill", desc: "ATK and Speed augments +25%. DEF augments -25%.", augmentMult: { atk: 1.25, spd: 1.25, def: .75 } },
  { id: "RollingAnvil", rarity: "rare", name: "Rolling Anvil", desc: "DEF and Speed augments +25%. HP augments -25%.", augmentMult: { def: 1.25, spd: 1.25, maxHp: .75 } },
  { id: "PoliteSteamroller", rarity: "rare", name: "Polite Steamroller", desc: "DEF and Speed augments +25%. ATK augments -25%.", augmentMult: { def: 1.25, spd: 1.25, atk: .75 } },
  { id: "rainingClovers", rarity: "rare", name: "It's Raining Clovers", desc: "Luck augments +100% and appear more often.", luckAugmentAmount: 2, luckAugmentWeight: 3 },
  { id: "couponDay", rarity: "rare", name: "Coupon Day", desc: "Gold augments +50% and appear more often.", goldAugmentAmount: 1.5, goldAugmentWeight: 3 },

  { id: "godRun", rarity: "epic", name: "GOD RUN!?", desc: "All augments +20%, including Gold and Luck.", allAugmentMult: 1.2, goldAugmentAmount: 1.2, luckAugmentAmount: 1.2 },
  { id: "uncapped", rarity: "epic", name: "UNCAPPED!!!", desc: "Augment scaling limit is gone, with diminishing returns.", uncappedScaling: true },

  { id: "iAmLegend", rarity: "legendary", name: "I Am Legend!!", desc: "Only Legend augments. Luck becomes a legendary all-stat team boost.", forceRarity: "legend", luckAsAllStats: true }
];

const RARITIES = [
  { id: "common", label: "Common", statMult: 1, luckMult: null },
  { id: "rare", label: "Rare", statMult: 1.5, luckMult: 1 },
  { id: "gilded", label: "Gilded", statMult: 2.25, luckMult: 1.25 },
  { id: "mystical", label: "Mystical", statMult: 3.375, luckMult: 1.56 },
  { id: "legend", label: "Legend", statMult: 5.0625, luckMult: 1.95 }
];

const RARITY_BY_ID = Object.fromEntries(RARITIES.map(r => [r.id, r]));
const LUCK_MYSTICAL_UNLOCK = 4;
const LUCK_LEGEND_UNLOCK = 10;
const HIDDEN_LUCK_PER_STAGE = .1;
const UNIQUE_BASE_CHANCE = .03;
const BASE_LUCK = 1;

const BASE_PERSONAL = {
  maxHp: 18,
  atk: 4,
  def: 2,
  spd: .12
};

const BASE_TEAM = {
  maxHp: 8,
  atk: 2,
  def: 1,
  spd: .05
};


function upgradeScale() {
  // Gentle reward scaling so later floors don't become a brick wall.
  // Floor 1-4: ×1.00, Floor 5-9: around ×1.08-×1.16, Floor 10+: capped at ×1.35.
  const scaled = 1 + Math.max(0, game.floor - 1) * 0.02;
  if (getRunModifier().uncappedScaling && scaled > 1.35) {
    return 1.35 + Math.sqrt(scaled - 1.35) * .35;
  }
  return Math.min(1.35, scaled);
}

function scaledAmount(amount, stat, rarity = null, isLuck = false) {
  const rarityInfo = rarity ? RARITY_BY_ID[rarity] : null;
  const rarityMult = rarityInfo ? (isLuck ? rarityInfo.luckMult || 1 : rarityInfo.statMult) : 1;
  const speedTuning = stat === "spd" ? .9 : 1;
  const statMult = isLuck ? modMult("luckAugmentAmount") : augmentMult(stat);
  const scaled = amount * upgradeScale() * rarityMult * speedTuning * statMult;
  return stat === "spd" ? round2(scaled) : Math.max(1, Math.round(scaled));
}

function fmtNumber(value, decimals = 1) {
  if (!Number.isFinite(value)) return "0";

  const sign = value < 0 ? "-" : "";
  const n = Math.abs(value);
  if (n < 1000) {
    return sign + (Number.isInteger(n) ? String(n) : n.toFixed(decimals).replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1"));
  }

  const suffixes = ["", "k", "m", "b", "t", "q", "Q", "s", "S", "o", "n", "d"];
  const tier = Math.min(Math.floor(Math.log10(n) / 3), suffixes.length - 1);
  const scaled = n / Math.pow(1000, tier);
  const fixed = scaled >= 100 ? scaled.toFixed(0) : scaled >= 10 ? scaled.toFixed(1) : scaled.toFixed(decimals);
  return sign + fixed.replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1") + suffixes[tier];
}

function randomRunModifier() {
  const weightedRarities = Object.entries(MODIFIER_RARITY_WEIGHTS);
  const total = weightedRarities.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = Math.random() * total;

  for (const [rarity, weight] of weightedRarities) {
    roll -= weight;
    if (roll <= 0) {
      const pool = RUN_MODIFIERS.filter(mod => mod.rarity === rarity);
      return pool[Math.floor(Math.random() * pool.length)] || RUN_MODIFIERS[0];
    }
  }

  return RUN_MODIFIERS[0];
}

function getRunModifier() {
  const id = game && game.modifierId;
  return RUN_MODIFIERS.find(mod => mod.id === id) || RUN_MODIFIERS[0];
}

function modMult(key) {
  const value = getRunModifier()[key];
  return Number.isFinite(value) ? value : 1;
}

function augmentMult(stat) {
  const modifier = getRunModifier();
  const statValue = modifier.augmentMult && modifier.augmentMult[stat];
  return (Number.isFinite(statValue) ? statValue : 1) * modMult("allAugmentMult");
}

const GOLD_TRAINING_BASE_COST = 100;
const GOLD_TRAINING_LINEAR = 20;
const GOLD_TRAINING_MULT = 1.12;
