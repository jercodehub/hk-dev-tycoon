import {
  COMPANY_COLORS,
  COMPANY_LOGOS,
  UNIT_SPECS,
  campaignHeat,
  chooseContractor,
  chooseLand,
  chooseStory,
  commitSale,
  confirmSettle,
  contractorQuote,
  createCampaign,
  createCampaignCatalog,
  endSummary,
  gfaUsed,
  hydrateCampaign,
  isTutorial,
  migrateSave,
  presetMix,
  projectNumber,
  resolveSale,
  serializeCampaign,
  skipLand,
} from "./campaign.js";
import { t } from "./copy.js";
import { STORIES } from "./stories.js";
import { districtLabel, formatHkd } from "./i18n.js";

const SAVE_KEY = "hk-dev-tycoon-v3";
const OLD_KEYS = ["hk-dev-tycoon-v2", "hk-dev-tycoon-v1"];
const LANG_KEY = "hk-dev-tycoon-lang";
const NAMES = ["啟岸發展", "維港置業", "山海發展", "新界共建", "港灣創建", "青嵐地產"];
const POOL_KEYS = [
  ["whale", "poolWhale"],
  ["couple", "poolCouple"],
  ["starter", "poolStarter"],
  ["upgrader", "poolUpgrader"],
  ["feature", "poolFeature"],
];
const UNIT_KEYS = {
  studio: ["unitStudio", "whoStudio"],
  one: ["unitOne", "whoOne"],
  two: ["unitTwo", "whoTwo"],
  three: ["unitThree", "whoThree"],
  feature: ["unitFeature", "whoFeature"],
};

const ui = {
  lang: "tc",
  catalog: null,
  state: null,
  error: null,
  menu: false,
  draft: { name: "啟岸發展", logo: "tower", color: "#e2b15a" },
  build: null,
  sale: null,
};

let saleTimer = null;
const app = document.querySelector("#app");

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

function compactHkd(value) {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(Math.round(value));
  if (ui.lang === "en") {
    if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}m`;
    return formatHkd(value);
  }
  if (abs >= 100000000) return `${sign}$${(abs / 100000000).toFixed(2)}億`;
  if (abs >= 10000) return `${sign}$${Math.round(abs / 10000).toLocaleString("en-US")}萬`;
  return formatHkd(value);
}

function logoSvg(id, color, name) {
  const ink = /^#[0-9a-f]{6}$/i.test(color) ? color : "#e2b15a";
  const inkDark = "#10151c";
  const letter = escapeHtml(String(name || "啟").trim().slice(0, 1) || "啟");
  const marks = {
    tower: `<rect x="24" y="8" width="16" height="44" rx="2" fill="${ink}"/><rect x="28" y="14" width="8" height="4" fill="${inkDark}"/><rect x="28" y="22" width="8" height="4" fill="${inkDark}"/><rect x="28" y="30" width="8" height="4" fill="${inkDark}"/><rect x="16" y="52" width="32" height="4" rx="1" fill="${ink}"/>`,
    wave: `<path d="M8 42c8-14 16-14 24 0s16 14 24 0 16-14 24 0" fill="none" stroke="${ink}" stroke-width="4" stroke-linecap="round"/><circle cx="20" cy="20" r="5" fill="${ink}"/>`,
    diamond: `<path d="M32 6 L54 32 L32 58 L10 32 Z" fill="${ink}"/><path d="M32 18 L44 32 L32 46 L20 32 Z" fill="${inkDark}"/>`,
    gate: `<path d="M14 54 V24 h8 V14 h20 v10 h8 v30" fill="none" stroke="${ink}" stroke-width="4"/><rect x="28" y="32" width="8" height="22" fill="${ink}"/>`,
    sun: `<circle cx="32" cy="32" r="10" fill="${ink}"/>${[0, 45, 90, 135, 180, 225, 270, 315]
      .map((deg) => {
        const r = (deg * Math.PI) / 180;
        const x1 = 32 + Math.cos(r) * 16;
        const y1 = 32 + Math.sin(r) * 16;
        const x2 = 32 + Math.cos(r) * 24;
        const y2 = 32 + Math.sin(r) * 24;
        return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`;
      })
      .join("")}`,
    monogram: `<circle cx="32" cy="32" r="22" fill="none" stroke="${ink}" stroke-width="3"/><text x="32" y="39" text-anchor="middle" font-size="20" font-family="sans-serif" fill="${ink}">${letter}</text>`,
  };
  return `<svg class="logo" viewBox="0 0 64 64" aria-hidden="true">${marks[id] || marks.tower}</svg>`;
}

function errorText(code) {
  const table = {
    tc: {
      insufficient_cash: "現金唔夠。",
      bad_phase: "而家未到呢一步。",
      bad_slot: "冇呢幅地。",
      bad_contractor: "冇呢間承建商。",
      bad_choice: "冇呢個選擇。",
      over_gfa: "超咗可建樓面。",
      empty_mix: "未分配單位。",
    },
    en: {
      insufficient_cash: "Not enough cash.",
      bad_phase: "That step is not open.",
      bad_slot: "That plot is not on offer.",
      bad_contractor: "Unknown contractor.",
      bad_choice: "Unknown choice.",
      over_gfa: "Over the buildable area.",
      empty_mix: "No flats allocated.",
    },
  };
  return (table[ui.lang] || table.tc)[code] || code;
}

function stepKey(phase) {
  return {
    land: "stepLand",
    build: "stepBuild",
    sell: "stepSell",
    settle: "stepSettle",
    story: "stepStory",
    summary: "stepSummary",
  }[phase] || "stepCompany";
}

function typeKey(type) {
  return { ura: "typeUra", mtr: "typeMtr", gov: "typeGov" }[type];
}

function typeNote(type) {
  return { ura: "typeUraNote", mtr: "typeMtrNote", gov: "typeGovNote" }[type];
}

function flavourKey(flavour) {
  return flavour === "uni" ? "flavourUni" : flavour === "core" ? "flavourCore" : "flavourStarter";
}

function leakWord(leak) {
  if (leak >= 0.25) return t(ui.lang, "leakHigh");
  if (leak >= 0.08) return t(ui.lang, "leakMid");
  return t(ui.lang, "leakLow");
}

function collapseWord(chance) {
  if (chance >= 0.1) return t(ui.lang, "collapseChance");
  if (chance > 0) return t(ui.lang, "collapseRare");
  return t(ui.lang, "collapseNone");
}

function stamp(verdict) {
  const word = t(ui.lang, verdict === "expensive" ? "expensive" : verdict === "cheap" ? "cheap" : "fair");
  const en = t(ui.lang, verdict === "expensive" ? "expensiveEn" : verdict === "cheap" ? "cheapEn" : "fairEn");
  return `<span class="stamp ${verdict}"><b>${word}</b><span>${en}</span></span>`;
}

function stopSaleTimer() {
  if (saleTimer) {
    clearInterval(saleTimer);
    saleTimer = null;
  }
}

function persist() {
  if (!ui.state) return;
  localStorage.setItem(SAVE_KEY, JSON.stringify(serializeCampaign(ui.state)));
  localStorage.setItem(LANG_KEY, ui.lang);
}

function apply(result) {
  if (!result.ok) {
    ui.error = result.error;
    render();
    return;
  }
  ui.state = result.state;
  ui.error = null;
  if (ui.state.phase !== "sell") ui.sale = null;
  if (ui.state.phase !== "build") ui.build = null;
  persist();
  render();
}

function ensureBuild() {
  if (ui.state?.phase !== "build") return;
  if (ui.build && ui.build.index === ui.state.project.index) return;
  ui.build = {
    index: ui.state.project.index,
    mix: { ...ui.state.project.offer.mixHint },
    contractor: null,
  };
}

function ensureSale() {
  if (ui.state?.phase !== "sell") return;
  if (ui.sale && ui.sale.index === ui.state.project.index) return;
  ui.sale = {
    index: ui.state.project.index,
    choices: { showflat: false, cheer: 0, leftover: "cut" },
    mode: "setup",
    started: 0,
    shownSold: 0,
    pops: [],
    reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  };
}

function currentQuote() {
  return resolveSale(ui.catalog, ui.state, ui.sale.choices);
}

function poolSum(pools) {
  return Object.values(pools).reduce((sum, value) => sum + value, 0);
}

function errorBanner() {
  if (!ui.error) return "";
  return `<div class="banner bad">${escapeHtml(errorText(ui.error))}</div>`;
}

function tutorialBanner() {
  const state = ui.state;
  if (!state || !isTutorial(state)) return "";
  if (state.phase === "land") return `<div class="banner info">${t(ui.lang, state.completed === 0 ? "tutorialLand" : "tutorialLand2")}</div>`;
  if (state.phase === "build") return `<div class="banner info">${t(ui.lang, "tutorialBuild")}</div>`;
  if (state.phase === "sell" && ui.sale?.mode === "setup") return `<div class="banner info">${t(ui.lang, "tutorialSell")}</div>`;
  return "";
}

function landCard(offer) {
  const broke = ui.state.cash < offer.landTotal;
  const deal = offer.partnerRate <= 0
    ? t(ui.lang, "typeGovNote")
    : `${t(ui.lang, typeNote(offer.type))} ${t(ui.lang, "shareOf", { pct: `${Math.round(offer.partnerRate * 100)}%` })}`;
  return `<button class="choice plot" data-action="buy" data-slot="${offer.slot}" ${broke ? "disabled" : ""}>
    <div class="head"><h3>${t(ui.lang, "slot", { slot: offer.slot })} · ${t(ui.lang, typeKey(offer.type))}</h3>${stamp(offer.verdict)}</div>
    <p class="note">${escapeHtml(districtLabel(ui.lang, offer.district))} · ${t(ui.lang, flavourKey(offer.flavour))}</p>
    <p class="fine">${offer.gfaFt2.toLocaleString("en-US")} ${t(ui.lang, "ft")} · ${t(ui.lang, "estUnits", { n: offer.units })}</p>
    <p class="fine">${formatHkd(offer.landPerFt2)}${t(ui.lang, "perFt")} · ${compactHkd(offer.landTotal)}</p>
    <p class="deal">${deal}</p>
    ${broke ? `<p class="fine">${t(ui.lang, "broke")}</p>` : ""}
  </button>`;
}

function landView() {
  return `${errorBanner()}${tutorialBanner()}
    <p class="kicker">${t(ui.lang, "landKicker")}</p>
    <div class="land-grid">${ui.state.offers.map(landCard).join("")}</div>`;
}

function buildView() {
  ensureBuild();
  const offer = ui.state.project.offer;
  const gfa = offer.gfaFt2;
  const used = gfaUsed(ui.build.mix);
  const left = gfa - used;
  const rows = UNIT_SPECS.map((spec) => {
    const [nameKey, whoKey] = UNIT_KEYS[spec.id];
    const max = Math.max(0, Math.floor(gfa / spec.ft2));
    const count = ui.build.mix[spec.id] || 0;
    return `<label class="mix-row">
      <span><b>${t(ui.lang, nameKey)}</b><small>${spec.ft2}${t(ui.lang, "ft")} · ${t(ui.lang, whoKey)}</small></span>
      <input type="range" min="0" max="${max}" step="1" value="${count}" data-unit="${spec.id}" aria-label="${escapeHtml(t(ui.lang, nameKey))}">
      <strong id="count-${spec.id}">${count}</strong>
    </label>`;
  }).join("");
  const cards = ["jingjin", "huimen", "xinjing"].map((id) => {
    const quote = contractorQuote(ui.catalog, ui.state, id);
    const spec = ui.catalog.balance.contractors[id];
    const on = ui.build.contractor === id;
    return `<button class="choice contractor${on ? " on" : ""}" data-action="pick-contractor" data-id="${id}" aria-pressed="${on}">
      <div class="head"><h3>${t(ui.lang, id)}</h3><strong>${compactHkd(quote.total)}</strong></div>
      <p class="fine">${t(ui.lang, `${id}Note`)} ${t(ui.lang, "leak")}${leakWord(spec.leak)} · ${t(ui.lang, "collapse")}${collapseWord(spec.collapse)}</p>
      ${quote.overdraft ? `<p class="fine">${t(ui.lang, "overdraft")}</p>` : ""}
    </button>`;
  }).join("");
  const width = Math.max(0, Math.min(100, (used / gfa) * 100));
  return `${errorBanner()}${tutorialBanner()}
    <section class="card build-card">
      <div class="head">
        <div>
          <p class="kicker">${t(ui.lang, "buildKicker")}</p>
          <h3>${escapeHtml(districtLabel(ui.lang, offer.district))} · ${t(ui.lang, flavourKey(offer.flavour))}</h3>
        </div>
        <button class="ghost" data-action="preset-mix">${t(ui.lang, "preset")}</button>
      </div>
      <div id="gfa-live" class="${left < 0 ? "over" : ""}">
        <span>${t(ui.lang, "gfa")} ${gfa.toLocaleString("en-US")}</span>
        <span>${t(ui.lang, "usedGfa")} <strong id="gfa-used">${used.toLocaleString("en-US")}</strong></span>
        <span>${t(ui.lang, "leftGfa")} <strong id="gfa-left">${left.toLocaleString("en-US")}</strong></span>
      </div>
      <div class="bar"><span id="gfa-bar" style="width:${width}%"></span></div>
      <p id="over-line" class="fine bad-text"${left < 0 ? "" : " hidden"}>${t(ui.lang, "overGfa")}</p>
      <div class="mixes">${rows}</div>
      <div class="contractors">${cards}</div>
    </section>`;
}

function paintBuild() {
  if (!ui.build || ui.state?.phase !== "build") return;
  const gfa = ui.state.project.offer.gfaFt2;
  const used = gfaUsed(ui.build.mix);
  const left = gfa - used;
  const live = document.querySelector("#gfa-live");
  if (live) live.classList.toggle("over", left < 0);
  const usedEl = document.querySelector("#gfa-used");
  if (usedEl) usedEl.textContent = used.toLocaleString("en-US");
  const leftEl = document.querySelector("#gfa-left");
  if (leftEl) leftEl.textContent = left.toLocaleString("en-US");
  const bar = document.querySelector("#gfa-bar");
  if (bar) bar.style.width = `${Math.max(0, Math.min(100, (used / gfa) * 100))}%`;
  const over = document.querySelector("#over-line");
  if (over) over.hidden = left >= 0;
  for (const spec of UNIT_SPECS) {
    const count = document.querySelector(`#count-${spec.id}`);
    if (count) count.textContent = String(ui.build.mix[spec.id] || 0);
  }
  const go = document.querySelector("[data-action='confirm-build']");
  if (go) go.disabled = left < 0 || used <= 0 || !ui.build.contractor;
  const small = document.querySelector("#build-small");
  if (small) small.textContent = buildHint(left);
}

function poolLine(pools) {
  return POOL_KEYS.map(([key, label]) => `${t(ui.lang, label)} ${pools[key] ?? 0}`).join(" · ");
}

function mixLine(mix) {
  return UNIT_SPECS.map((spec) => `${t(ui.lang, UNIT_KEYS[spec.id][0])} ${mix[spec.id] || 0}`).join(" · ");
}

function sellSetup() {
  const offer = ui.state.project.offer;
  const quote = currentQuote();
  const cut = resolveSale(ui.catalog, ui.state, { ...ui.sale.choices, leftover: "cut" });
  const hold = resolveSale(ui.catalog, ui.state, { ...ui.sale.choices, leftover: "hold" });
  const heat = quote.marketHeat;
  const collapsed = ui.state.project.contractor.collapsed ? `<div class="banner bad">${t(ui.lang, "collapsedBanner")}</div>` : "";
  return `${tutorialBanner()}${collapsed}
    <section class="card">
      <p class="kicker">${t(ui.lang, "sellKicker")} · ${escapeHtml(districtLabel(ui.lang, offer.district))} · ${t(ui.lang, flavourKey(offer.flavour))}</p>
      <p class="note">${mixLine(quote.mix)}</p>
      <p class="bowl ${quote.bowl.ok ? "ok" : "bad"}">${t(ui.lang, "bowl")} ${quote.bowl.ok ? t(ui.lang, "bowlOk") : t(ui.lang, "bowlCrack")} · ${t(ui.lang, "twoBed")} ${compactHkd(quote.bowl.lump)} / ${compactHkd(quote.bowl.bowl)}</p>
      <p class="fine">${t(ui.lang, "poolLeft")} ${poolLine(quote.poolsAfter)}</p>
      <button class="choice toggle${ui.sale.choices.showflat ? " on" : ""}" data-action="showflat" aria-pressed="${ui.sale.choices.showflat}">
        <strong>${t(ui.lang, "showflat")}</strong>
        <small>${compactHkd(ui.catalog.balance.showflatPerFt2 * offer.gfaFt2)} · ${t(ui.lang, "showflatSub")}</small>
      </button>
      <div class="chips">
        <button class="chip${ui.sale.choices.leftover === "cut" ? " on" : ""}" data-action="leftover" data-id="cut">${t(ui.lang, "leftoverCut")}</button>
        <button class="chip${ui.sale.choices.leftover === "hold" ? " on" : ""}" data-action="leftover" data-id="hold">${t(ui.lang, "leftoverHold")}</button>
      </div>
      <p class="fine">${t(ui.lang, "leftoverHint", { n: quote.unsold, cut: compactHkd(cut.fireNet), hold: compactHkd(hold.frozenAmount) })}</p>
      <p class="fine">${heat === "loose" ? t(ui.lang, "looseHint") : t(ui.lang, "spicyHint")}</p>
      ${quote.cakeSweep > 0 ? `<p class="fine">${t(ui.lang, "cakeLine", { n: quote.cakeSweep })}</p>` : ""}
    </section>`;
}

function outcomeLine(quote) {
  const pair = { clear: t(ui.lang, "outcomeClear"), partial: t(ui.lang, "outcomePartial"), fail: t(ui.lang, "outcomeFail") }[quote.outcome];
  const cls = quote.outcome === "clear" ? "ok" : quote.outcome === "fail" ? "bad" : "mid";
  return `<div class="outcome ${cls}">${pair}</div>`;
}

function sellLive() {
  const quote = currentQuote();
  const reduced = ui.sale.reduced;
  const shown = reduced || ui.sale.mode === "done" ? quote.sold : ui.sale.shownSold;
  const showOutcome = reduced || ui.sale.mode === "done";
  const heat = showOutcome ? quote.heat : Math.round(quote.heat * 0.15);
  const cheerOff = ui.sale.choices.cheer >= ui.catalog.balance.cheerMax;
  const dots = 24;
  const lit = quote.units ? Math.round((dots * shown) / quote.units) : 0;
  return `<section class="card sale-stage">
      <button class="go cheer-stage" data-action="cheer" ${cheerOff ? "disabled" : ""}>${t(ui.lang, "cheer")}<small id="cheer-left">${t(ui.lang, "cheerLeft", { n: ui.catalog.balance.cheerMax - ui.sale.choices.cheer })}</small></button>
      <div class="heat" aria-hidden="true"><span id="heat-fill" style="width:${heat}%"></span></div>
      <div class="sale-nums">
        <div><span>${t(ui.lang, "heat")}</span><strong id="heat-num">${heat}</strong></div>
        <div><span>${t(ui.lang, "soldNow")}</span><strong id="sold-num">${shown}</strong></div>
        <div><span>${t(ui.lang, "unitsLeft")}</span><strong id="left-num">${Math.max(0, quote.units - shown)}</strong></div>
      </div>
      <div class="dots" id="dots">${Array.from({ length: dots }, (_, index) => `<i class="${index < lit ? "sold" : ""}"></i>`).join("")}</div>
      <div class="pops" id="pops"></div>
      <p class="fine" id="cake-line">${quote.cakeSweep > 0 && shown > 0 ? t(ui.lang, "cakeLine", { n: quote.cakeSweep }) : ""}</p>
      <p class="fine">${t(ui.lang, "floorCash")} <strong id="tally">${formatHkd(shown && quote.sold ? Math.round((quote.gross * shown) / quote.sold) : 0)}</strong></p>
      ${showOutcome ? outcomeLine(quote) : `<p class="kicker">${t(ui.lang, "selling")}</p>`}
    </section>`;
}

function sellView() {
  ensureSale();
  if (ui.sale.mode === "setup") return `${errorBanner()}${sellSetup()}`;
  return sellLive();
}

function launchSale() {
  ui.sale.mode = "live";
  ui.sale.started = performance.now();
  ui.sale.shownSold = 0;
  ui.sale.pops = [];
  if (ui.sale.reduced) {
    ui.sale.mode = "done";
    ui.sale.shownSold = currentQuote().sold;
    render();
    return;
  }
  render();
  stopSaleTimer();
  saleTimer = setInterval(() => {
    if (ui.state?.phase !== "sell" || ui.sale?.mode !== "live") {
      stopSaleTimer();
      return;
    }
    const quote = currentQuote();
    const tProgress = Math.min(1, (performance.now() - ui.sale.started) / 7000);
    const target = Math.round(quote.sold * tProgress);
    if (target > ui.sale.shownSold) {
      ui.sale.pops.unshift({ text: `+${target - ui.sale.shownSold}` });
      ui.sale.pops = ui.sale.pops.slice(0, 3);
      ui.sale.shownSold = target;
    }
    if (tProgress >= 1) {
      ui.sale.shownSold = quote.sold;
      ui.sale.mode = "done";
      stopSaleTimer();
      render();
      return;
    }
    paintSale(quote, tProgress);
  }, 160);
}

function paintSale(quote, tProgress) {
  const shownHeat = Math.round(quote.heat * (0.2 + 0.8 * tProgress));
  const heat = document.querySelector("#heat-fill");
  if (heat) heat.style.width = `${Math.min(100, shownHeat)}%`;
  const heatNum = document.querySelector("#heat-num");
  if (heatNum) heatNum.textContent = String(Math.min(100, shownHeat));
  const sold = document.querySelector("#sold-num");
  if (sold) sold.textContent = String(ui.sale.shownSold);
  const left = document.querySelector("#left-num");
  if (left) left.textContent = String(Math.max(0, quote.units - ui.sale.shownSold));
  const tally = document.querySelector("#tally");
  if (tally) {
    const cash = quote.sold ? Math.round((quote.gross * ui.sale.shownSold) / quote.sold) : 0;
    tally.textContent = formatHkd(cash);
  }
  const pops = document.querySelector("#pops");
  if (pops) pops.innerHTML = ui.sale.pops.map((pop) => `<span class="pop">${escapeHtml(pop.text)}</span>`).join("");
  const dots = document.querySelector("#dots");
  if (dots) {
    const lit = quote.units ? Math.round((24 * ui.sale.shownSold) / quote.units) : 0;
    dots.innerHTML = Array.from({ length: 24 }, (_, index) => `<i class="${index < lit ? "sold" : ""}"></i>`).join("");
  }
  const cheerLeft = document.querySelector("#cheer-left");
  if (cheerLeft) cheerLeft.textContent = t(ui.lang, "cheerLeft", { n: ui.catalog.balance.cheerMax - ui.sale.choices.cheer });
  const cake = document.querySelector("#cake-line");
  if (cake) cake.textContent = quote.cakeSweep > 0 && ui.sale.shownSold > 0 ? t(ui.lang, "cakeLine", { n: quote.cakeSweep }) : "";
  const bowl = document.querySelector("#hud-bowl-word");
  if (bowl) {
    bowl.textContent = quote.bowl.ok ? t(ui.lang, "bowlOk") : t(ui.lang, "bowlCrack");
    bowl.className = quote.bowl.ok ? "ok" : "bad";
  }
  const pool = document.querySelector("#hud-pool-num");
  if (pool) pool.textContent = String(poolSum(quote.poolsAfter));
  for (const cheerBtn of document.querySelectorAll("[data-action='cheer']")) {
    cheerBtn.disabled = ui.sale.choices.cheer >= ui.catalog.balance.cheerMax;
  }
}

function row(label, value) {
  return `<div class="row"><span>${label}</span><strong>${value}</strong></div>`;
}

function settleView() {
  const project = ui.state.project;
  if (project?.skipped) {
    return `<section class="card"><h2>${t(ui.lang, "settleKicker")}</h2>
      <h3>${t(ui.lang, "skippedTitle")}</h3>
      <p class="note">${t(ui.lang, "skippedBody")}</p>
    </section>`;
  }
  const sale = project.sale;
  const after = ui.state.cash + sale.netCash;
  const cls = sale.profit >= 0 ? "ok" : "bad";
  const sign = sale.profit >= 0 ? "+" : "";
  const partner = project.offer.partnerRate <= 0
    ? row(t(ui.lang, "partnerShare"), t(ui.lang, "noShareLine"))
    : row(t(ui.lang, "partnerShare"), formatHkd(sale.partnerShare));
  return `<section class="card"><h2>${t(ui.lang, "settleKicker")}</h2>
    ${outcomeLine(sale)}
    <div class="big-profit ${cls}">${sign}${formatHkd(sale.profit)}</div>
    <p class="fine">${escapeHtml(districtLabel(ui.lang, project.offer.district))} · ${t(ui.lang, flavourKey(project.offer.flavour))} · ${t(ui.lang, typeKey(project.offer.type))}</p>
    ${project.offer.type === "gov" ? `<p class="deal">${t(ui.lang, "govSettle")}</p>` : ""}
    ${row(t(ui.lang, "saleIn"), formatHkd(sale.gross))}
    ${sale.showflatCost ? row(t(ui.lang, "showflatCost"), formatHkd(sale.showflatCost)) : ""}
    ${partner}
    ${sale.fireNet ? row(t(ui.lang, "fireSale"), formatHkd(sale.fireNet)) : ""}
    ${sale.frozenAmount ? `<p class="fine">${t(ui.lang, "frozenLine", { cash: formatHkd(sale.frozenAmount) })}</p>` : ""}
    ${row(t(ui.lang, "landCost"), formatHkd(project.offer.landTotal))}
    ${row(t(ui.lang, "buildCost"), formatHkd(project.contractor.total))}
    ${row(t(ui.lang, "repChange"), `${sale.reputationDelta >= 0 ? "+" : ""}${sale.reputationDelta}`)}
    ${row(t(ui.lang, "soldNow"), `${sale.sold} / ${sale.units}`)}
    ${row(t(ui.lang, "cashNow"), formatHkd(after))}
  </section>`;
}

function storyView() {
  const story = ui.state.story;
  return `<section class="card story-card"><h2>${t(ui.lang, "storyKicker")}</h2>
    <p class="story-line">${escapeHtml(story.tc)}</p>
    <p class="note">${escapeHtml(story.en)}</p>
  </section>`;
}

function effectLine(choice) {
  const bits = [];
  if (choice.rep) bits.push(`${t(ui.lang, "reputation")} ${choice.rep > 0 ? "+" : ""}${choice.rep}`);
  if (choice.cash) bits.push(compactHkd(choice.cash));
  if (choice.pool) {
    for (const [key, label] of POOL_KEYS) {
      if (typeof choice.pool[key] === "number" && choice.pool[key] !== 0) {
        const value = choice.pool[key];
        bits.push(`${t(ui.lang, label)} ${value > 0 ? "+" : ""}${value}`);
      }
    }
  }
  return bits.join(" · ");
}

function flagText(id) {
  for (const story of STORIES) {
    const choice = story.choices.find((item) => item.flag === id);
    if (choice) return choice.tc;
  }
  return id;
}

function summaryView() {
  const summary = endSummary(ui.state);
  const flags = Object.keys(summary.flags);
  const rows = summary.history.map((item) => {
    if (item.skipped) return `<li><span>${item.index} · ${t(ui.lang, "skip")}</span><strong>0</strong></li>`;
    const sign = item.profit >= 0 ? "+" : "";
    return `<li><span>${item.index} · ${escapeHtml(districtLabel(ui.lang, item.district))}</span><strong>${sign}${compactHkd(item.profit)}</strong></li>`;
  }).join("");
  return `<section class="card"><h2>${t(ui.lang, "summaryKicker")}</h2>
    <p class="note">${escapeHtml(ui.state.company.name)}</p>
    ${row(t(ui.lang, "cash"), formatHkd(summary.cash))}
    ${row(t(ui.lang, "reputation"), String(summary.reputation))}
    ${row(t(ui.lang, "summarySold"), String(summary.unitsSold))}
    <p class="fine">${t(ui.lang, "summaryFlags")} · ${flags.length ? flags.map((id) => escapeHtml(flagText(id))).join(" · ") : t(ui.lang, "noFlags")}</p>
    <ul class="history">${rows}</ul>
  </section>`;
}

function mainView() {
  if (!ui.state) return companyView();
  if (ui.state.phase === "land") return landView();
  if (ui.state.phase === "build") return buildView();
  if (ui.state.phase === "sell") return sellView();
  if (ui.state.phase === "settle") return settleView();
  if (ui.state.phase === "story") return storyView();
  return summaryView();
}

function companyView() {
  const names = NAMES.map((name) => `<button class="chip${ui.draft.name === name ? " on" : ""}" data-action="preset-name" data-name="${escapeHtml(name)}">${escapeHtml(name)}</button>`).join("");
  const logos = COMPANY_LOGOS.map((id) => `<button class="chip logo-pick${ui.draft.logo === id ? " on" : ""}" data-action="logo" data-id="${id}" aria-pressed="${ui.draft.logo === id}">${logoSvg(id, ui.draft.color, ui.draft.name)}</button>`).join("");
  const colors = COMPANY_COLORS.map((color) => `<button class="swatch${ui.draft.color === color ? " on" : ""}" style="background:${color}" data-action="color" data-color="${color}" aria-label="${color}"></button>`).join("");
  return `<section class="card">
      <p class="kicker">${t(ui.lang, "companyKicker")}</p>
      <h3>${t(ui.lang, "title")}</h3>
      <p class="note">${t(ui.lang, "companyLead")}</p>
      <div class="preview">${logoSvg(ui.draft.logo, ui.draft.color, ui.draft.name)}</div>
      <div class="names">${names}</div>
      <input id="company-name" class="name-field" maxlength="16" value="${escapeHtml(ui.draft.name)}" aria-label="${escapeHtml(t(ui.lang, "companyName"))}">
      <div class="chips">${logos}</div>
      <div class="swatches">${colors}</div>
    </section>`;
}

function buildHint(left) {
  if (left < 0) return t(ui.lang, "overGfa");
  if (!ui.build?.contractor) return t(ui.lang, "pickContractor");
  return `${t(ui.lang, "leftGfa")} ${left.toLocaleString("en-US")} ${t(ui.lang, "ft")}`;
}

function dock() {
  if (ui.menu) return "";
  if (!ui.state) return `<footer class="dock"><button class="go" data-action="found">${t(ui.lang, "found")}</button></footer>`;
  const phase = ui.state.phase;
  if (phase === "land") {
    return `<footer class="dock"><button class="wide" data-action="skip">${t(ui.lang, "skip")}<small>${t(ui.lang, "skipSub")}</small></button></footer>`;
  }
  if (phase === "build") {
    ensureBuild();
    const used = gfaUsed(ui.build.mix);
    const left = ui.state.project.offer.gfaFt2 - used;
    const blocked = left < 0 || used <= 0 || !ui.build.contractor;
    const small = buildHint(left);
    return `<footer class="dock"><button class="go" data-action="confirm-build" ${blocked ? "disabled" : ""}>${t(ui.lang, "confirmBuild")}<small id="build-small">${small}</small></button></footer>`;
  }
  if (phase === "sell") {
    ensureSale();
    if (ui.sale.mode === "setup") return `<footer class="dock"><button class="go" data-action="launch-sale">${t(ui.lang, "openSale")}</button></footer>`;
    const left = ui.catalog.balance.cheerMax - ui.sale.choices.cheer;
    const cheer = `<button class="go" data-action="cheer" ${left <= 0 ? "disabled" : ""}>${t(ui.lang, "cheer")}<small>${t(ui.lang, "cheerLeft", { n: left })}</small></button>`;
    const settle = `<button class="go" data-action="commit-sale">${t(ui.lang, "toSettle")}</button>`;
    if (ui.sale.mode === "done" || ui.sale.reduced) return `<footer class="dock cols-2">${cheer}${settle}</footer>`;
    return `<footer class="dock">${cheer}</footer>`;
  }
  if (phase === "settle") return `<footer class="dock"><button class="go" data-action="confirm-settle">${t(ui.lang, "nextStep")}</button></footer>`;
  if (phase === "story") {
    const buttons = ui.state.story.choices.map((choice) => `<button data-action="story" data-id="${choice.id}">${escapeHtml(choice.tc)}<small>${escapeHtml(effectLine(choice) || choice.en)}</small></button>`).join("");
    const cols = ui.state.story.choices.length > 1 ? "cols-2" : "";
    return `<footer class="dock ${cols}">${buttons}</footer>`;
  }
  return `<footer class="dock"><button class="go" data-action="new-game">${t(ui.lang, "again")}</button></footer>`;
}

function hud() {
  const projects = ui.catalog.balance.projects;
  const cash = ui.state ? ui.state.cash : ui.catalog.balance.startingCash;
  const rep = ui.state ? ui.state.reputation : ui.catalog.balance.startingReputation;
  const number = ui.state ? projectNumber(ui.state) : 0;
  const company = ui.state?.company || ui.draft;
  const step = ui.state ? t(ui.lang, stepKey(ui.state.phase)) : t(ui.lang, "stepCompany");
  const heat = ui.state ? campaignHeat(ui.state, ui.catalog.balance) : null;
  const heatWord = heat === "loose" ? t(ui.lang, "heatLoose") : heat === "spicy" ? t(ui.lang, "heatSpicy") : "—";
  let sellRow = "";
  if (ui.state?.phase === "sell") {
    ensureSale();
    const quote = currentQuote();
    sellRow = `<div class="stats sell-stats">
      <div class="stat"><span class="k">${t(ui.lang, "bowl")}</span><strong id="hud-bowl-word" class="${quote.bowl.ok ? "ok" : "bad"}">${quote.bowl.ok ? t(ui.lang, "bowlOk") : t(ui.lang, "bowlCrack")}</strong></div>
      <div class="stat"><span class="k">${t(ui.lang, "poolLeft")}</span><strong id="hud-pool-num">${poolSum(quote.poolsAfter)}</strong></div>
    </div>`;
  }
  return `<header class="hud">
    <div class="brand">${logoSvg(company.logo, company.color, company.name)}<div><h1>${escapeHtml(company.name)}</h1><p>${t(ui.lang, "tagline")}</p></div></div>
    <div class="stats">
      <div class="stat"><span class="k">${t(ui.lang, "cash")}</span><strong>${compactHkd(cash)}</strong></div>
      <div class="stat"><span class="k">${t(ui.lang, "reputation")}</span><strong>${rep}</strong></div>
      <div class="stat heat-stat ${heat || ""}"><span class="k">${t(ui.lang, "heatName")}</span><strong>${heatWord}</strong></div>
      <div class="stat"><span class="k">${t(ui.lang, "project")}</span><strong>${number ? `${number} / ${projects}` : `— / ${projects}`}</strong></div>
      <div class="stat"><span class="k">${t(ui.lang, "nextStep")}</span><strong>${step}</strong></div>
    </div>
    <div class="hud-actions">
      <button class="ghost" data-action="lang">${t(ui.lang, "langName")}</button>
      ${ui.state ? `<button class="ghost" data-action="menu">${t(ui.lang, "menu")}</button>` : ""}
    </div>
    ${sellRow}
  </header>`;
}

function menuOverlay() {
  if (!ui.menu) return "";
  return `<div class="menu"><div class="card">
    <h3>${t(ui.lang, "menu")}</h3>
    <div class="stack">
      <button class="primary" data-action="close-menu">${t(ui.lang, "close")}</button>
      <button class="ghost" data-action="new-game">${t(ui.lang, "newGame")}</button>
    </div>
  </div></div>`;
}

function render() {
  if (!ui.catalog) return;
  if (ui.state?.phase !== "sell") stopSaleTimer();
  document.documentElement.lang = ui.lang === "en" ? "en" : "zh-Hant";
  const phase = ui.state?.phase || "company";
  app.innerHTML = `${hud()}
    <div class="shell" data-phase="${phase}">
      <main class="stack" id="main">${mainView()}</main>
    </div>
    <p class="legal">${t(ui.lang, "disclaimer")} · ${t(ui.lang, "disclaimerEn")}</p>
    ${dock()}
    ${menuOverlay()}`;
}

function foundCompany() {
  const name = document.querySelector("#company-name")?.value ?? ui.draft.name;
  ui.draft.name = String(name || "").trim().slice(0, 16) || "啟岸發展";
  const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
  ui.state = createCampaign(ui.catalog, { company: ui.draft, seed });
  ui.menu = false;
  ui.error = null;
  ui.build = null;
  ui.sale = null;
  persist();
  render();
}

function newGame() {
  stopSaleTimer();
  ui.state = null;
  ui.sale = null;
  ui.build = null;
  ui.menu = false;
  ui.error = null;
  localStorage.removeItem(SAVE_KEY);
  render();
}

function onClick(event) {
  const target = event.target.closest("[data-action]");
  if (!target || target.disabled) return;
  const { action, id, slot } = target.dataset;
  if (action === "lang") {
    ui.lang = ui.lang === "tc" ? "en" : "tc";
    localStorage.setItem(LANG_KEY, ui.lang);
    render();
    return;
  }
  if (action === "menu") {
    ui.menu = true;
    render();
    return;
  }
  if (action === "close-menu") {
    ui.menu = false;
    render();
    return;
  }
  if (action === "new-game") {
    newGame();
    return;
  }
  if (action === "preset-name") {
    ui.draft.name = target.dataset.name;
    render();
    return;
  }
  if (action === "logo") {
    ui.draft.logo = id;
    render();
    return;
  }
  if (action === "color") {
    ui.draft.color = target.dataset.color;
    render();
    return;
  }
  if (action === "found") {
    foundCompany();
    return;
  }
  if (!ui.state) return;
  if (action === "buy") apply(chooseLand(ui.catalog, ui.state, slot));
  if (action === "skip") apply(skipLand(ui.catalog, ui.state));
  if (action === "pick-contractor") {
    ensureBuild();
    ui.build.contractor = id;
    render();
    return;
  }
  if (action === "preset-mix") {
    ensureBuild();
    const offer = ui.state.project.offer;
    ui.build.mix = presetMix(offer.gfaFt2, offer.flavour, campaignHeat(ui.state, ui.catalog.balance), ui.catalog.balance);
    render();
    return;
  }
  if (action === "confirm-build") {
    ensureBuild();
    apply(chooseContractor(ui.catalog, ui.state, ui.build.contractor, ui.build.mix));
    return;
  }
  if (action === "showflat") {
    ensureSale();
    if (ui.sale.mode !== "setup") return;
    ui.sale.choices.showflat = !ui.sale.choices.showflat;
    render();
    return;
  }
  if (action === "leftover") {
    ensureSale();
    if (ui.sale.mode !== "setup") return;
    ui.sale.choices.leftover = id === "hold" ? "hold" : "cut";
    render();
    return;
  }
  if (action === "launch-sale") {
    launchSale();
    return;
  }
  if (action === "cheer") {
    ensureSale();
    if (ui.sale.mode === "setup") return;
    if (ui.sale.choices.cheer >= ui.catalog.balance.cheerMax) return;
    ui.sale.choices.cheer += 1;
    const quote = currentQuote();
    if (ui.sale.reduced || ui.sale.mode === "done") {
      ui.sale.shownSold = quote.sold;
      render();
      return;
    }
    const tProgress = Math.min(1, (performance.now() - ui.sale.started) / 7000);
    const bumped = Math.max(ui.sale.shownSold, Math.round(quote.sold * Math.max(tProgress, 0.25)));
    if (bumped > ui.sale.shownSold) {
      ui.sale.pops.unshift({ text: `+${bumped - ui.sale.shownSold}` });
      ui.sale.pops = ui.sale.pops.slice(0, 3);
      ui.sale.shownSold = bumped;
    }
    paintSale(quote, tProgress);
    return;
  }
  if (action === "commit-sale") {
    stopSaleTimer();
    apply(commitSale(ui.catalog, ui.state, ui.sale.choices));
    ui.sale = null;
    return;
  }
  if (action === "confirm-settle") apply(confirmSettle(ui.catalog, ui.state));
  if (action === "story") apply(chooseStory(ui.catalog, ui.state, id));
}

function onInput(event) {
  if (event.target.id === "company-name") ui.draft.name = event.target.value.slice(0, 16);
  const unit = event.target.dataset.unit;
  if (!unit || !ui.build) return;
  ui.build.mix[unit] = Math.max(0, Math.round(Number(event.target.value) || 0));
  paintBuild();
}

async function boot() {
  ui.lang = localStorage.getItem(LANG_KEY) === "en" ? "en" : "tc";
  const balanceUrl = new URL("./campaign-balance.json", import.meta.url);
  const marketUrl = new URL("../data/market-stats.json", import.meta.url);
  const [balance, market] = await Promise.all([
    fetch(balanceUrl).then((response) => response.json()),
    fetch(marketUrl).then((response) => response.json()),
  ]);
  ui.catalog = createCampaignCatalog({ balance, market });
  for (const key of OLD_KEYS) localStorage.removeItem(key);
  let raw = null;
  try {
    raw = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
  } catch {
    raw = null;
  }
  const migrated = migrateSave(raw);
  if (migrated.ok) {
    try {
      ui.state = hydrateCampaign(ui.catalog, migrated.state);
    } catch {
      ui.state = null;
      localStorage.removeItem(SAVE_KEY);
    }
  } else if (raw) {
    localStorage.removeItem(SAVE_KEY);
  }
  app.addEventListener("click", onClick);
  app.addEventListener("input", onInput);
  render();
}

boot().catch((error) => {
  app.textContent = error.message;
});
