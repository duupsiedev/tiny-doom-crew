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

const SCALED_BOSS_NAMES = [
  "Baron von Bonk",
  "Count Snackula",
  "The Toe Accountant",
  "Sir Slaps-a-Lot",
  "Duchess Oops",
  "The Rent Gobbler",
  "Mold King Gary",
  "Professor Bad Choices",
  "Lady Crumbstorm",
  "The Dramatic Yam",
  "Captain Taxes",
  "Grandpa Thunderpants",
  "The Vibe Auditor",
  "Lord Wobbleknees",
  "Queen Stompsalot",
  "The Soup Pretender",
  "Major Problem",
  "The Dungeon Landlord",
  "Archduke Noodlefist",
  "The Unpaid Intern"
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
  return Math.min(1.35, 1 + Math.max(0, game.floor - 1) * 0.02);
}

function scaledAmount(amount, stat, rarity = null, isLuck = false) {
  const rarityInfo = rarity ? RARITY_BY_ID[rarity] : null;
  const rarityMult = rarityInfo ? (isLuck ? rarityInfo.luckMult || 1 : rarityInfo.statMult) : 1;
  const speedTuning = stat === "spd" ? .9 : 1;
  const scaled = amount * upgradeScale() * rarityMult * speedTuning;
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

const GOLD_TRAINING_BASE_COST = 100;
const GOLD_TRAINING_LINEAR = 20;
const GOLD_TRAINING_MULT = 1.12;
