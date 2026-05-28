let game = newGame();
let lastTime = performance.now();

function saveGame(silent = false) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(game));
    if (!silent) addLog("Game saved. The dungeon paperwork is almost legal.", "good");
  } catch (err) {
    addLog("Save failed. The goblin ate the clipboard.", "bad");
  }
}

function loadGame(showMessage = false) {
  try {
    let raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      for (const key of LEGACY_SAVE_KEYS) {
        raw = localStorage.getItem(key);
        if (raw) break;
      }
    }
    if (!raw) {
      if (showMessage) addLog("No save found. The vault is empty and judging us.", "bad");
      return;
    }

    const loaded = JSON.parse(raw);
    game = repairSave(loaded);
    if (showMessage) addLog("Save loaded. Tiny doom restored.", "good");
    render();
  } catch (err) {
    addLog("Load failed. Save data got cursed.", "bad");
  }
}

function repairSave(data) {
  const fresh = newGame();
  let merged = Object.assign(fresh, data);

  merged.global = Object.assign(fresh.global, data.global || {});
  merged.global.teamBonus = Object.assign(fresh.global.teamBonus, (data.global && data.global.teamBonus) || {});
  merged.global.luck = Number.isFinite(merged.global.luck) ? merged.global.luck : 0;
  merged.party = Array.isArray(data.party) ? data.party : fresh.party;
  ["knight", "rogue", "cleric"].forEach(id => {
    if (!merged.party.some(u => u.id === id)) merged.party.push(HERO_LIBRARY[id].make());
  });
  merged.enemies = Array.isArray(data.enemies) ? data.enemies : [];
  merged.log = Array.isArray(data.log) ? data.log.slice(-80) : [];
  merged.upgradeLedger = Array.isArray(data.upgradeLedger) ? data.upgradeLedger : [];
  merged.currentChoices = [];
  merged.currentGoldChoice = null;
  merged.bossRewardPending = !!merged.bossRewardPending;
  merged.goldPurchaseCount = Number.isFinite(merged.goldPurchaseCount) ? merged.goldPurchaseCount : 0;
  merged.wonPrototype = !!merged.wonPrototype;
  merged.waitingForUpgrade = !!merged.waitingForUpgrade && !merged.wonPrototype;
  merged.inBattle = !!merged.inBattle && !merged.waitingForUpgrade && !merged.wonPrototype;

  merged.party.forEach(u => {
    const template = HERO_LIBRARY[u.id] || HERO_LIBRARY.knight;
    if (typeof u.baseMaxHp !== "number") u.baseMaxHp = template.maxHp;
    if (typeof u.baseAtk !== "number") u.baseAtk = template.atk;
    if (typeof u.baseDef !== "number") u.baseDef = template.def;
    if (typeof u.baseSpd !== "number") u.baseSpd = template.spd;
    u.personalBonus = Object.assign({ maxHp: 0, atk: 0, def: 0, spd: 0 }, u.personalBonus || {});
    if (typeof u.shield !== "number") u.shield = 0;
    if (typeof u.cooldown !== "number") u.cooldown = attackDelay(u.spd || 1);
    if (typeof u.attacks !== "number") u.attacks = 0;
    if (!u.team) u.team = "hero";
    applyAllBonusesToHero(u, true);
  });

  merged.enemies.forEach(u => {
    if (typeof u.shield !== "number") u.shield = 0;
    if (typeof u.cooldown !== "number") u.cooldown = attackDelay(u.spd || 1);
    if (typeof u.attacks !== "number") u.attacks = 0;
    if (!u.team) u.team = "enemy";
  });

  if (merged.waitingForUpgrade) {
    game = merged;
    rollUpgradeChoices();
    merged = game;
  }

  return merged;
}

function hardReset() {
  if (!confirm("Reset the run? Your tiny doom crew will forget where it parked.")) return;
  localStorage.removeItem(SAVE_KEY);
  LEGACY_SAVE_KEYS.forEach(key => localStorage.removeItem(key));
  game = newGame();
  addLog("New run started. The full crew enters with confidence and questionable insurance.", "important");
  render();
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

loadGame(false);
if (game.log.length === 0) {
  addLog("The full crew arrives at the dungeon door. The door feels mildly threatened.", "important");
}
render();
requestAnimationFrame(gameLoop);
