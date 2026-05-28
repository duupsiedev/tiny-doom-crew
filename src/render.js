function render() {
  if (!game.party || !Array.isArray(game.party) || game.party.length === 0) {
    game.party = [HERO_LIBRARY.knight.make()];
    applyTeamBonusesToAll(false);
  }
  if (!game.enemies || !Array.isArray(game.enemies)) game.enemies = [];
  if (!game.global) game.global = newGame().global;
  if (!game.global.teamBonus) game.global.teamBonus = { maxHp: 0, atk: 0, def: 0, spd: 0 };
  if (typeof game.global.luck !== "number") game.global.luck = 0;

  document.getElementById("floorText").textContent = game.floor;
  document.getElementById("goldText").textContent = fmtNumber(Math.floor(game.gold));
  document.getElementById("luckText").textContent = displayLuck();
  document.getElementById("bestText").textContent = game.bestFloor;
  document.getElementById("battleState").textContent =
    game.inBattle ? "Fighting" : game.waitingForUpgrade ? "Upgrade" : "Idle";

  document.getElementById("startBtn").disabled =
    game.inBattle || game.waitingForUpgrade || game.wonPrototype || living(game.party).length === 0;

  document.getElementById("partyPower").textContent = `${fmtNumber(Math.round(teamPower(game.party)))} power`;
  document.getElementById("enemyPower").textContent = game.enemies.length ? `${fmtNumber(Math.round(teamPower(game.enemies)))} power` : "";

  renderUnits();
  renderChoices();
  renderLedger();
  renderLog();

  if (!game.inBattle && !game.waitingForUpgrade && !game.wonPrototype && living(game.party).length > 0) {
    document.getElementById("messageBox").textContent = "Ready. Start the next fight and let fate wear a tiny helmet.";
  }
}

function renderUnitsOnly() {
  document.getElementById("floorText").textContent = game.floor;
  document.getElementById("goldText").textContent = fmtNumber(Math.floor(game.gold));
  document.getElementById("luckText").textContent = displayLuck();
  renderUnits();
}

function renderUnits() {
  document.getElementById("partyList").innerHTML = game.party.map(u => unitHtml(u, game.party)).join("");
  document.getElementById("enemyList").innerHTML =
    game.enemies.length ? game.enemies.map(u => unitHtml(u, game.enemies)).join("") : `<div class="status">No enemies yet. Suspiciously peaceful.</div>`;
}

function unitHtml(u, team) {
  const pct = Math.max(0, Math.min(100, (u.hp / u.maxHp) * 100));
  const hpClass = u.team === "hero" ? "hp-player" : "hp-enemy";
  const crit = u.crit ? ` · CRIT ${Math.round(u.crit * 100)}%` : "";
  const shield = u.shield ? ` · SHIELD ${fmtNumber(Math.round(u.shield))}` : "";
  const aggro = team && living(team).length > 1 ? ` · AGGRO ${aggroChance(u, team)}%` : "";
  const skill = u.skillText ? `<div class="unit-meta">${u.skillText}</div>` : "";

  return `
    <div class="unit">
      <div class="unit-top">
        <div>
          <div class="unit-name"><span class="emoji">${u.emoji}</span>${u.name}</div>
          ${skill}
        </div>
        <div class="unit-meta">${fmtNumber(Math.ceil(u.hp))}/${fmtNumber(u.maxHp)} HP</div>
      </div>
      <div class="bar-wrap"><div class="bar ${hpClass}" style="width:${pct}%"></div></div>
      <div class="unit-stats">
        <span>ATK ${fmtNumber(u.atk)}</span>
        <span>DEF ${fmtNumber(u.def)}</span>
        <span>SPD ${u.spd.toFixed(2)}</span>
        <span>CD ${Math.max(0, u.cooldown).toFixed(1)}s${crit}${shield}${aggro}</span>
      </div>
    </div>
  `;
}

function renderChoices() {
  const card = document.getElementById("upgradeCard");
  const banner = document.getElementById("upgradeBanner");
  const rewardInfo = document.getElementById("rewardInfo");
  const choices = document.getElementById("choices");

  if (!game.waitingForUpgrade) {
    card.classList.add("hidden");
    rewardInfo.classList.add("hidden");
    return;
  }

  card.classList.remove("hidden");
  banner.classList.remove("hidden");
  rewardInfo.classList.remove("hidden");
  banner.textContent = game.bossRewardPending
    ? `Boss cleared. Choose one of four boosted free upgrades before Floor ${game.floor}. Gold training is optional.`
    : `Floor cleared. Choose one free upgrade before Floor ${game.floor}. Gold training is optional.`;
  rewardInfo.textContent = `Unique ${Math.round(uniqueChance() * 1000) / 10}% · ${rarityUnlockText()} · ${rarityOddsText(!!game.bossRewardPending)}`;

  const freeChoices = (game.currentChoices || []).map((c, i) => `
    <button class="choice ${c.rarity || "common"} ${c.unique ? "unique" : ""}" onclick="chooseUpgrade(${i})">
      <strong>${c.kind === "team" ? "🌐 " : c.kind === "personal" ? "🎯 " : "➕ "}${c.title}</strong>
      <small><span class="rarity-tag ${c.rarity || "common"}">${c.rarityLabel || rarityLabel(c.rarity)}</span>${c.desc}</small>
    </button>
  `).join("");

  const gold = game.currentGoldChoice;
  const goldHtml = gold ? `
    <button class="choice ${gold.unique ? "unique" : ""}" onclick="buyGoldTraining()" ${game.gold < (gold.cost || goldTrainingCost()) || game.goldChoicePurchased ? "disabled" : ""}>
      <strong>💰 ${game.goldChoicePurchased ? "Gold Training Purchased" : gold.title}</strong>
      <small>${game.goldChoicePurchased ? "Already bought for this floor." : `${gold.desc} You have ${fmtNumber(Math.floor(game.gold))} gold. Next cost after purchase scales upward.`}</small>
    </button>
  ` : "";

  choices.innerHTML = freeChoices + goldHtml;
}


function renderLog() {
  const el = document.getElementById("log");
  if (!el) return;

  const entries = Array.isArray(game.log) ? game.log : [];
  el.innerHTML = entries
    .map(entry => `<p class="${entry.type || ""}">${escapeHtml(entry.text || "")}</p>`)
    .join("");

  el.scrollTop = el.scrollHeight;
}

function renderLedger() {
  const el = document.getElementById("upgradeLedger");
  if (!el) return;

  const team = Object.assign({ maxHp: 0, atk: 0, def: 0, spd: 0 }, game.global.teamBonus || {});
  const startShield = Number.isFinite(game.global.startShield) ? game.global.startShield : 0;
  const goldMult = Number.isFinite(game.global.goldMult) ? game.global.goldMult : 1;
  const luck = getLuck();
  const summary = `
    <p class="important">Team bonuses: +${fmtNumber(team.maxHp)} HP · +${fmtNumber(team.atk)} ATK · +${fmtNumber(team.def)} DEF · +${Number(team.spd || 0).toFixed(2)} SPD · +${fmtNumber(startShield)} Shield · ×${fmtNumber(goldMult, 2)} Gold</p>
  `;

  const ledger = game.upgradeLedger || [];
  const rows = ledger.slice(-16).reverse().map(x => `<p>F${x.floor}: ${escapeHtml(x.text)}</p>`).join("");

  el.innerHTML = summary + `<p class="important">Luck: ${displayLuck(luck)} (${rarityUnlockText()})</p>` + (rows || `<p>No upgrades yet. The ledger is clean. Suspiciously clean.</p>`);
}

function teamPower(team) {
  return team.reduce((sum, u) => sum + u.maxHp * .12 + u.atk * 3 + u.def * 2.5 + u.spd * 10, 0);
}
