function makeUnit(template, team) {
  return {
    id: template.id,
    name: template.name,
    emoji: template.emoji,
    role: template.role || "",
    team,
    baseMaxHp: template.maxHp,
    baseAtk: template.atk,
    baseDef: template.def,
    baseSpd: template.spd,
    personalBonus: {
      maxHp: 0,
      atk: 0,
      def: 0,
      spd: 0
    },
    maxHp: template.maxHp,
    hp: template.maxHp,
    atk: template.atk,
    def: template.def,
    spd: template.spd,
    crit: template.crit || 0,
    healer: !!template.healer,
    boss: !!template.boss,
    skillText: template.skillText || "",
    cooldown: attackDelay(template.spd),
    attacks: 0,
    shield: 0
  };
}

function applyAllBonusesToHero(hero, keepHpRatio = true) {
  const oldMax = hero.maxHp || hero.baseMaxHp || 1;
  const oldHp = hero.hp ?? oldMax;
  const ratio = oldMax > 0 ? oldHp / oldMax : 1;
  const team = game.global.teamBonus || { maxHp: 0, atk: 0, def: 0, spd: 0 };
  const personal = hero.personalBonus || { maxHp: 0, atk: 0, def: 0, spd: 0 };

  hero.maxHp = Math.max(1, Math.round((hero.baseMaxHp || hero.maxHp) + personal.maxHp + team.maxHp));
  hero.atk = Math.max(1, Math.round((hero.baseAtk || hero.atk) + personal.atk + team.atk));
  hero.def = Math.max(0, Math.round((hero.baseDef || hero.def) + personal.def + team.def));
  hero.spd = Math.max(.2, round2((hero.baseSpd || hero.spd) + personal.spd + team.spd));

  if (keepHpRatio) {
    hero.hp = Math.max(1, Math.min(hero.maxHp, Math.round(hero.maxHp * ratio)));
  } else {
    hero.hp = hero.maxHp;
  }

  hero.cooldown = Math.min(hero.cooldown || attackDelay(hero.spd), attackDelay(hero.spd));
}

function applyTeamBonusesToAll(keepHpRatio = true) {
  game.party.forEach(hero => applyAllBonusesToHero(hero, keepHpRatio));
}

function recruitHero(id) {
  if (hasHero(id)) return game.party.find(h => h.id === id);
  const hero = HERO_LIBRARY[id].make();
  game.party.push(hero);
  applyAllBonusesToHero(hero, false);
  return hero;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function cloneEnemy(id, floor) {
  const t = ENEMY_LIBRARY[id];

  // Enemy scaling v0.3.6:
  // Halfway between the harsh old curve and the softer v0.3.5 curve,
  // plus tiny speed scaling so late-game enemies still get turns.
  const winScale = enemyWinScale(t.boss);
  const hpScale = (1 + (floor - 1) * (t.boss ? 0.122 : 0.158)) * winScale;
  const atkScale = (1 + (floor - 1) * (t.boss ? 0.092 : 0.118)) * winScale;
  const defBonus = Math.floor(floor / (t.boss ? 5 : 4));

  // Teeny speed growth. No hard cap, just a deliberately slow curve.
  const speedScale = 1 + Math.max(0, floor - 1) * (t.boss ? 0.0054 : 0.0072);
  const spd = round2(t.spd * speedScale);

  const maxHp = Math.round(t.maxHp * hpScale);

  return {
    id: t.id,
    name: t.name,
    emoji: t.emoji,
    team: "enemy",
    maxHp,
    hp: maxHp,
    atk: Math.round(t.atk * atkScale),
    def: Math.round(t.def + defBonus),
    spd,
    boss: !!t.boss,
    skillText: t.skillText || "",
    cooldown: attackDelay(spd),
    attacks: 0,
    shield: 0
  };
}

function attackDelay(speed) {
  return 2.6 / Math.max(.25, speed);
}

function enemyWinScale(boss = false) {
  const wins = Math.max(0, (game.floor || 1) - 1);
  return 1 + wins * (boss ? .01 : .015);
}

function startBattle() {
  if (game.inBattle || game.waitingForUpgrade) return;

  applyTeamBonusesToAll(false);
  game.enemies = makeWave(game.floor);

  game.party.forEach(h => {
    h.hp = h.maxHp;
    h.cooldown = attackDelay(h.spd);
    h.attacks = 0;
    h.shield = game.global.startShield;
  });

  game.enemies.forEach(e => {
    e.cooldown = attackDelay(e.spd);
    e.attacks = 0;
    e.shield = 0;
  });

  game.inBattle = true;
  game.waitingForUpgrade = false;
  lastTime = performance.now();
  addLog(`Floor ${game.floor} begins. Tiny boots enter suspicious darkness.`, "important");
  render();
}

function makeWave(floor) {
  if (floor === 5) return [cloneEnemy("boss5", floor)];
  if (floor === 10) return [cloneEnemy("boss10", floor)];
  if (floor > 10 && floor % 5 === 0) return [makeScaledBoss(floor)];

  const pool = ["rat", "slime", "goblin", "bat"];
  const count = Math.min(1 + Math.floor((floor - 1) / 3), 3);
  const wave = [];

  for (let i = 0; i < count; i++) {
    const index = (floor + i * 2 + Math.floor(Math.random() * 2)) % pool.length;
    wave.push(cloneEnemy(pool[index], floor));
  }

  return wave;
}

function makeScaledBoss(floor) {
  const era = Math.floor(floor / 5);
  const pressure = enemyWinScale(true);

  // Stronger than v0.3.5, softer than the original wall-of-doom.
  const maxHp = Math.round(225 * (1 + era * 0.48) * (1 + floor * 0.03) * pressure);
  const spd = round2(.78 + era * .0198 + floor * .0018);

  return {
    id: "scaledBoss",
    name: `Boss Blob ${era}`,
    emoji: "🧱",
    team: "enemy",
    maxHp,
    hp: maxHp,
    atk: Math.round(14 * (1 + era * 0.255) * (1 + floor * 0.022) * pressure),
    def: Math.round(3 + era * 1.25),
    spd,
    boss: true,
    skillText: "A scaling boss. Less impossible, still rude.",
    cooldown: attackDelay(spd),
    attacks: 0,
    shield: 0
  };
}

function gameLoop(now) {
  const dt = Math.min(.12, (now - lastTime) / 1000);
  lastTime = now;

  if (game.inBattle) {
    updateBattle(dt);
  }

  requestAnimationFrame(gameLoop);
}

function updateBattle(dt) {
  const heroes = living(game.party);
  const enemies = living(game.enemies);

  if (heroes.length === 0) {
    loseBattle();
    return;
  }

  if (enemies.length === 0) {
    winBattle();
    return;
  }

  for (const hero of heroes) {
    hero.cooldown -= dt;
    if (hero.cooldown <= 0) {
      hero.cooldown += attackDelay(hero.spd);
      heroAction(hero);
    }
  }

  for (const enemy of enemies) {
    enemy.cooldown -= dt;
    if (enemy.cooldown <= 0) {
      enemy.cooldown += attackDelay(enemy.spd);
      enemyAction(enemy);
    }
  }

  renderUnitsOnly();
}

function heroAction(hero) {
  hero.attacks++;

  if (hero.healer && hero.attacks % 3 === 0) {
    const target = weakest(game.party);
    const heal = Math.round(12 + hero.atk * .75);
    target.hp = Math.min(target.maxHp, target.hp + heal);
    addLog(`${hero.emoji} ${hero.name} patches ${target.name} for ${heal} HP. Divine duct tape.`, "good");
    return;
  }

  const target = chooseAggroTarget(game.enemies);
  if (!target) return;

  let damage = Math.max(1, hero.atk - target.def);
  let crit = false;

  if (hero.crit && Math.random() < hero.crit) {
    damage *= 2;
    crit = true;
  }

  applyDamage(target, damage);
  addLog(`${hero.emoji} ${hero.name} attacks ${target.emoji} ${target.name} for ${damage}${crit ? " CRIT" : ""}.`, crit ? "good" : "");
}

function enemyAction(enemy) {
  enemy.attacks++;
  const target = chooseAggroTarget(game.party);
  if (!target) return;

  let damage = Math.max(1, enemy.atk - target.def);

  if (enemy.boss && enemy.id === "boss5" && enemy.attacks % 3 === 0) {
    damage = Math.round(damage * 1.5);
    addLog(`${enemy.emoji} ${enemy.name} winds up a dramatic gob-smash!`, "bad");
  }

  applyDamage(target, damage);
  addLog(`${enemy.emoji} ${enemy.name} targets ${target.emoji} ${target.name} for ${damage}.`, "bad");
}

function chooseAggroTarget(team) {
  const alive = living(team);
  if (alive.length === 0) return null;

  const weights = alive.map(u => Math.max(1, u.def));
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;

  for (let i = 0; i < alive.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return alive[i];
  }

  return alive[alive.length - 1];
}

function aggroChance(unit, team) {
  const alive = living(team);
  const total = alive.reduce((sum, u) => sum + Math.max(1, u.def), 0);
  if (total <= 0) return 0;
  return Math.round((Math.max(1, unit.def) / total) * 100);
}

function applyDamage(unit, amount) {
  let remaining = amount;

  if (unit.shield > 0) {
    const blocked = Math.min(unit.shield, remaining);
    unit.shield -= blocked;
    remaining -= blocked;
  }

  unit.hp = Math.max(0, unit.hp - remaining);
}

function living(list) {
  return list.filter(u => u.hp > 0);
}

function weakest(list) {
  return living(list).sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0] || list[0];
}

function winBattle() {
  game.inBattle = false;

  const defeatedBoss = game.enemies.some(enemy => enemy.boss);
  const bossGoldMult = defeatedBoss ? 1.5 : 1;
  const gold = Math.round((18 + game.floor * 7) * game.global.goldMult * bossGoldMult);
  game.gold += gold;
  game.bestFloor = Math.max(game.bestFloor, game.floor + 1);

  addLog(`Victory! The crew steals ${gold} gold and one questionable sandwich${defeatedBoss ? " from the boss stash" : ""}.`, "important");

  // v0.3.5: Floor 10 is no longer the end. Keep pushing until the dungeon says sorry.
  if (game.floor === 10) {
    addLog("Prototype milestone cleared: Floor 10 beaten. The dungeon grows a second chin.", "weird");
  }

  game.floor++;
  game.waitingForUpgrade = true;
  game.bossRewardPending = defeatedBoss;
  game.goldChoicePurchased = false;
  rollUpgradeChoices();
  saveGame(true);
  render();
}

function loseBattle() {
  game.inBattle = false;
  game.waitingForUpgrade = false;
  addLog(`Defeat. The dungeon pats your pockets and takes emotional damage as payment.`, "bad");
  document.getElementById("messageBox").textContent = "Your party fell. Reset the run and try a different upgrade path.";
  saveGame(true);
  render();
}

function showWinPrototype() {
  game.waitingForUpgrade = false;
  document.getElementById("messageBox").innerHTML = "You beat Floor 10. The Snackromancer has filed a complaint with HR.";
}
