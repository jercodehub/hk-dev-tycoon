import {
  COMPANY_COLORS,
  COMPANY_LOGOS,
  chooseContractor,
  chooseLand,
  chooseStory,
  commitSale,
  confirmSettle,
  contractorQuote,
  createCampaign,
  createCampaignCatalog,
  endSummary,
  hydrateCampaign,
  isTutorial,
  migrateSave,
  projectNumber,
  resolveSale,
  serializeCampaign,
  skipLand,
} from "./campaign.js";
import { t } from "./copy.js";
import { STORIES } from "./stories.js";
import { districtLabel, formatHkd, regionLabel } from "./i18n.js";

const SAVE_KEY = "hk-dev-tycoon-v2";
const LEGACY_KEY = "hk-dev-tycoon-v1";
const LANG_KEY = "hk-dev-tycoon-lang";
const NAMES = ["啟岸發展", "維港置業", "山海發展", "新界共建", "港灣創建", "青嵐地產"];
const PLACES = [
  ["離島區", 36, 150],
  ["屯門區", 78, 86],
  ["元朗區", 118, 42],
  ["荃灣區", 124, 96],
  ["葵青區", 150, 112],
  ["北區", 176, 28],
  ["大埔區", 210, 58],
  ["沙田區", 188, 90],
  ["西貢區", 248, 86],
  ["深水埗區", 156, 132],
  ["油尖旺區", 176, 146],
  ["九龍城區", 198, 132],
  ["黃大仙區", 214, 116],
  ["觀塘區", 230, 142],
  ["中西區", 158, 168],
  ["灣仔區", 186, 174],
  ["東區", 230, 168],
  ["南區", 176, 196],
];

const ui = {
  lang: "tc",
  catalog: null,
  state: null,
  notice: null,
  error: null,
  menu: false,
  draft: { name: "啟岸發展", logo: "tower", color: "#e2b15a" },
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

function badge(kind) {
  const cls = kind === "game" ? "badge-game" : "badge-open";
  const label = kind === "game" ? "遊戲數值 / Game economy" : "開放數據 / Open data";
  return `<span class="badge ${cls}">${label}</span>`;
}

function moneyRow(label, value, kind) {
  return `<div class="money"><div class="top"><span>${label}</span><strong>${value}</strong></div>${badge(kind)}</div>`;
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

function mul(move) {
  const sign = move > 0 ? "+" : "";
  return `${sign}${(move * 100).toFixed(1)}%`;
}

function levelText(value) {
  return `×${value.toFixed(2)}`;
}

function stamp(verdict) {
  const word = t(ui.lang, verdict === "expensive" ? "expensive" : verdict === "cheap" ? "cheap" : "fair");
  const en = t(ui.lang, verdict === "expensive" ? "expensiveEn" : verdict === "cheap" ? "cheapEn" : "fairEn");
  return `<span class="stamp ${verdict}" data-verdict="${verdict}"><b>${word}</b><span>${en}</span></span>`;
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
    },
    en: {
      insufficient_cash: "Not enough cash.",
      bad_phase: "That step is not open.",
      bad_slot: "That plot is not on offer.",
      bad_contractor: "Unknown contractor.",
      bad_choice: "Unknown choice.",
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
  persist();
  render();
}

function currentQuote() {
  return resolveSale(ui.catalog, ui.state, ui.sale.choices);
}

function ensureSale() {
  if (ui.state?.phase !== "sell") return;
  if (ui.sale) return;
  ui.sale = {
    choices: { ask: "market", agents: "one", ads: "web", mix: "blend", rebate: "std", cheer: 0 },
    mode: "setup",
    started: 0,
    shownSold: 0,
    pops: [],
    reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  };
}

function launchSale() {
  ui.sale.mode = "live";
  ui.sale.started = performance.now();
  ui.sale.shownSold = 0;
  ui.sale.pops = [];
  if (ui.sale.reduced) {
    ui.sale.shownSold = 0;
    render();
    return;
  }
  render();
  stopSaleTimer();
  saleTimer = setInterval(() => {
    if (ui.state?.phase !== "sell" || ui.sale?.mode !== "live" || ui.sale.reduced) {
      stopSaleTimer();
      return;
    }
    const quote = currentQuote();
    const tProgress = Math.min(1, (performance.now() - ui.sale.started) / 8000);
    const target = Math.round(quote.sold * tProgress);
    if (target > ui.sale.shownSold) {
      const gain = target - ui.sale.shownSold;
      ui.sale.pops.unshift({ text: `+${formatHkd(quote.askPerUnit * gain)}` });
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
  const heat = document.querySelector("#heat-fill");
  if (!heat) return;
  const shownHeat = Math.round(quote.heat * (ui.sale?.reduced ? 1 : 0.3 + 0.7 * tProgress));
  heat.style.width = `${Math.min(100, shownHeat)}%`;
  const heatNum = document.querySelector("#heat-num");
  if (heatNum) heatNum.textContent = String(Math.min(100, shownHeat));
  const sold = document.querySelector("#sold-num");
  if (sold) sold.textContent = String(ui.sale.shownSold);
  const left = document.querySelector("#left-num");
  if (left) left.textContent = String(Math.max(0, quote.units - ui.sale.shownSold));
  const tally = document.querySelector("#tally");
  if (tally) tally.textContent = formatHkd(quote.askPerUnit * ui.sale.shownSold);
  const pops = document.querySelector("#pops");
  if (pops) pops.innerHTML = ui.sale.pops.map((pop) => `<span class="pop">${escapeHtml(pop.text)}</span>`).join("");
  const dots = document.querySelector("#dots");
  if (dots && Number(dots.dataset.sold) !== ui.sale.shownSold) {
    dots.dataset.sold = String(ui.sale.shownSold);
    dots.innerHTML = Array.from({ length: quote.units }, (_, index) => `<i class="${index < ui.sale.shownSold ? "sold" : ""}"></i>`).join("");
  }
  const cheerLeft = document.querySelector("#cheer-left");
  if (cheerLeft) {
    cheerLeft.textContent = t(ui.lang, "cheerLeft", {
      n: ui.catalog.balance.cheerMax - ui.sale.choices.cheer,
    });
  }
  const cheerOff = ui.sale.choices.cheer >= ui.catalog.balance.cheerMax;
  for (const cheerBtn of document.querySelectorAll("[data-action='cheer']")) {
    if (!ui.sale.reduced && ui.sale.mode === "done") cheerBtn.disabled = true;
    else cheerBtn.disabled = cheerOff;
  }
}

function flavourMap() {
  const highlights = new Map();
  for (const offer of ui.state?.offers || []) highlights.set(offer.district, offer.slot);
  if (!highlights.size && ui.state?.project?.offer) {
    highlights.set(ui.state.project.offer.district, ui.state.project.offer.slot);
  }
  const marks = PLACES.map(([district, x, y]) => {
    const slot = highlights.get(district);
    return `<g><circle class="dot${slot ? " on" : ""}" cx="${x}" cy="${y}" r="${slot ? 11 : 4}"></circle>${
      slot ? `<text x="${x}" y="${y + 3}" text-anchor="middle">${slot}</text>` : ""
    }</g>`;
  }).join("");
  const legend = [...highlights.entries()]
    .map(([district, slot]) => `${slot} ${escapeHtml(districtLabel(ui.lang, district))}`)
    .join(" · ");
  return `<section class="card map-card"><h2>${t(ui.lang, "mapTitle")}</h2>
    <svg viewBox="0 0 320 210" role="img" aria-label="${escapeHtml(t(ui.lang, "mapCaption"))}">${marks}</svg>
    <p class="fine">${legend}</p>
    <p class="fine">${t(ui.lang, "mapCaption")}</p>
  </section>`;
}

function marketCard() {
  const levels = ui.state?.market;
  if (!levels) return "";
  const items = [
    ["marketPrice", levels.price],
    ["marketLand", levels.land],
    ["marketBuild", levels.build],
    ["marketBuyer", levels.buyer],
  ];
  const bars = items
    .map(([key, value]) => `<div class="level"><span class="k">${t(ui.lang, key)}</span><strong>${levelText(value)}</strong><div class="bar"><span style="width:${Math.max(8, Math.min(100, (value / 2) * 100))}%"></span></div></div>`)
    .join("");
  const move = levels.lastMove
    ? `<p class="fine">${t(ui.lang, "lastMove")} ${mul(levels.lastMove)}</p>${badge("game")}`
    : "";
  return `<section class="card"><h2>${t(ui.lang, "marketTitle")}</h2>
    <div class="levels">${bars}</div>
    ${move}
    <p class="fine">${t(ui.lang, "moveNote")}</p>
    <p class="fine">${t(ui.lang, "scriptNote")}</p>
  </section>`;
}

function openCard() {
  const prices = ui.catalog.market.prices;
  const index = prices.priceIndex.series.all;
  const regions = ["港島", "九龍", "新界"].map((region) => {
    const cell = prices.averagePrices.areas[region].B;
    return moneyRow(
      t(ui.lang, "regionPrice", { region: regionLabel(ui.lang, region) }),
      `${formatHkd(cell.value)} / m²`,
      "open",
    );
  }).join("");
  const provisional = prices.averagePrices.provisional ? `<p class="fine">${t(ui.lang, "provisional")} · ${escapeHtml(prices.averagePrices.month)}</p>` : "";
  return `<section class="card"><h2>${t(ui.lang, "openTitle")}</h2>
    ${moneyRow(t(ui.lang, "indexLabel"), String(index.value), "open")}
    <p class="fine">${escapeHtml(prices.priceIndex.base)} · ${escapeHtml(prices.priceIndex.month)}</p>
    ${regions}
    ${provisional}
    <p class="fine">${t(ui.lang, "noDistrict")}</p>
  </section>`;
}

function noticeBanner() {
  if (ui.notice !== "phase1_reset") return "";
  return `<div class="banner warn">${t(ui.lang, "phase1Notice")}</div>`;
}

function errorBanner() {
  if (!ui.error) return "";
  return `<div class="banner bad">${escapeHtml(errorText(ui.error))}</div>`;
}

function tutorialBanner() {
  const state = ui.state;
  if (!state || !isTutorial(state)) return "";
  if (state.phase === "land") {
    return `<div class="banner info">${t(ui.lang, state.completed === 0 ? "tutorialLand" : "tutorialLand2")}</div>`;
  }
  if (state.phase === "build") return `<div class="banner info">${t(ui.lang, "tutorialBuild")}</div>`;
  if (state.phase === "sell" && ui.sale?.mode === "setup") return `<div class="banner info">${t(ui.lang, "tutorialSell")}</div>`;
  return "";
}

function landCard(offer) {
  const region = regionLabel(ui.lang, offer.region);
  const district = districtLabel(ui.lang, offer.district);
  const broke = ui.state.cash < offer.landTotal;
  return `<button class="choice" data-action="buy" data-slot="${offer.slot}" data-verdict="${offer.verdict}" ${broke ? "disabled" : ""}>
    <div class="head"><h3>${t(ui.lang, "slot", { slot: offer.slot })} · ${t(ui.lang, typeKey(offer.type))}</h3>${stamp(offer.verdict)}</div>
    <p class="note">${escapeHtml(district)} · ${escapeHtml(region)}</p>
    <p class="fine">${t(ui.lang, typeNote(offer.type))}</p>
    <div class="row"><span>${t(ui.lang, "gfa")}</span><strong>${offer.gfaFt2.toLocaleString("en-US")} ${t(ui.lang, "ft")}</strong></div>
    <div class="row"><span>${t(ui.lang, "units")}</span><strong>${offer.units}</strong></div>
    ${moneyRow(t(ui.lang, "landRate"), `${formatHkd(offer.landPerFt2)} ${t(ui.lang, "perFt")}`, "game")}
    ${moneyRow(t(ui.lang, "fairRate"), `${formatHkd(offer.fairLandPerFt2)} ${t(ui.lang, "perFt")}`, "game")}
    ${moneyRow(t(ui.lang, "landTotal"), formatHkd(offer.landTotal), "game")}
    <div class="row"><span>${t(ui.lang, "partner")}</span><strong>${t(ui.lang, "shareOf", { pct: `${Math.round(offer.partnerRate * 100)}%` })}</strong></div>
    <p class="fine">${badge("open")} ${t(ui.lang, "regionPrice", { region })} ${formatHkd(offer.openData.hkdPerM2)} / m²</p>
    <p class="fine">${t(ui.lang, "notDistrict", { region, district })} ${t(ui.lang, "vacancyNote", { pct: offer.vacancyPct })}</p>
    ${broke ? `<p class="fine">${t(ui.lang, "broke")}</p>` : ""}
  </button>`;
}

function landView() {
  return `${noticeBanner()}${errorBanner()}${tutorialBanner()}
    <section class="card"><h2>${t(ui.lang, "landKicker")}</h2>
      <p class="note">${t(ui.lang, "vs")} · ${t(ui.lang, "gameTier")}</p>
      <p class="fine">${t(ui.lang, "estBuildNote")}</p>
    </section>
    ${ui.state.offers.map(landCard).join("")}`;
}

function buildView() {
  const offer = ui.state.project.offer;
  const district = districtLabel(ui.lang, offer.district);
  const cards = ["jingjin", "huimen", "xinjing"].map((id) => {
    const quote = contractorQuote(ui.catalog, ui.state, id);
    const spec = ui.catalog.balance.contractors[id];
    return `<button class="choice" data-action="contractor" data-id="${id}">
      <div class="head"><h3>${t(ui.lang, id)}</h3><span class="note">${quote.overdraft ? t(ui.lang, "broke") : ""}</span></div>
      <p class="fine">${t(ui.lang, `${id}Note`)}</p>
      ${moneyRow(t(ui.lang, "buildCost"), formatHkd(quote.total), "game")}
      <div class="row"><span>${t(ui.lang, "leak")}</span><strong>${leakWord(spec.leak)}</strong></div>
      <div class="row"><span>${t(ui.lang, "collapse")}</span><strong>${collapseWord(spec.collapse)}</strong></div>
      <div class="row"><span>${t(ui.lang, "quality")}</span><strong>${spec.quality.toFixed(2)}</strong></div>
      ${quote.overdraft ? `<p class="fine">${t(ui.lang, "overdraft")}</p>` : ""}
    </button>`;
  }).join("");
  return `${errorBanner()}${tutorialBanner()}
    <section class="card"><h2>${t(ui.lang, "buildKicker")}</h2>
      <p class="note">${escapeHtml(district)} · ${t(ui.lang, typeKey(offer.type))} · ${offer.units} ${t(ui.lang, "units")}</p>
      ${ui.state.market.lastMove ? `<p class="fine">${t(ui.lang, "lastMove")} ${mul(ui.state.market.lastMove)} ${badge("game")}</p>` : ""}
    </section>
    ${cards}`;
}

function choiceChip(action, id, label, sub, on) {
  return `<button class="chip${on ? " on" : ""}" data-action="${action}" data-id="${id}" aria-pressed="${on ? "true" : "false"}"><strong>${label}</strong>${sub ? `<small>${sub}</small>` : ""}</button>`;
}

function sellSetup() {
  const offer = ui.state.project.offer;
  const district = districtLabel(ui.lang, offer.district);
  const sample = resolveSale(ui.catalog, ui.state, { ...ui.sale.choices, cheer: 0 });
  const risks = { loss_risk: "riskLoss", balanced: "riskBalanced", slow: "riskSlow", fail_risk: "riskFail" };
  const asks = ["cheap", "market", "stretch", "steep"].map((id) => {
    const quote = resolveSale(ui.catalog, ui.state, { ...ui.sale.choices, ask: id, cheer: 0 });
    return choiceChip("pick-ask", id, t(ui.lang, `ask${id[0].toUpperCase()}${id.slice(1)}`), `${formatHkd(quote.askPerFt2)} ${t(ui.lang, "perFt")} · ${t(ui.lang, risks[quote.risk])}`, ui.sale.choices.ask === id);
  }).join("");
  const groups = [
    ["agents", "pick-agents", [["none", "agentNone"], ["one", "agentOne"], ["many", "agentMany"]]],
    ["ads", "pick-ads", [["none", "adNone"], ["web", "adWeb"], ["media", "adMedia"]]],
    ["mix", "pick-mix", [["whale", "mixWhale"], ["retail", "mixRetail"], ["blend", "mixBlend"]]],
    ["rebate", "pick-rebate", [["low", "rebateLow"], ["std", "rebateStd"], ["high", "rebateHigh"]]],
  ];
  const blocks = groups.map(([key, action, options]) => {
    const chips = options.map(([id, label]) => choiceChip(action, id, t(ui.lang, label), "", ui.sale.choices[key] === id)).join("");
    return `<span class="chip-label">${t(ui.lang, key)}</span><div class="chips">${chips}</div>`;
  }).join("");
  const collapsed = ui.state.project.contractor.collapsed ? `<div class="banner bad">${t(ui.lang, "collapsedBanner")}</div>` : "";
  return `${tutorialBanner()}${collapsed}
    <section class="card"><h2>${t(ui.lang, "sellKicker")}</h2>
      <p class="note">${escapeHtml(district)} · ${offer.units} ${t(ui.lang, "units")} · ${t(ui.lang, ui.state.project.contractor.id)}</p>
      ${moneyRow(t(ui.lang, "marketBuyer"), `${formatHkd(sample.fairPerFt2)} ${t(ui.lang, "perFt")}`, "game")}
      <span class="chip-label">${t(ui.lang, "ask")}</span>
      <div class="chips">${asks}</div>
      ${blocks}
    </section>`;
}

function outcomeLine(quote) {
  const pair = { clear: "沽清 · Sold out", partial: "部分成功 · Partial", fail: "失敗 · Failed" }[quote.outcome];
  const loss = quote.profit < 0 ? " · 蝕" : "";
  const cls = quote.outcome === "clear" ? "ok" : quote.outcome === "fail" ? "bad" : "mid";
  return `<div class="outcome ${cls}" aria-live="polite">${pair}${loss}</div>`;
}

function sellLive() {
  const quote = currentQuote();
  const reduced = ui.sale.reduced;
  const shown = ui.sale.shownSold;
  const showOutcome = reduced ? ui.sale.choices.cheer > 0 : ui.sale.mode === "done";
  const heat = showOutcome ? quote.heat : 0;
  const cast = [
    t(ui.lang, { none: "agentNone", one: "agentOne", many: "agentMany" }[ui.sale.choices.agents]),
    t(ui.lang, { none: "adNone", web: "adWeb", media: "adMedia" }[ui.sale.choices.ads]),
    t(ui.lang, { whale: "mixWhale", retail: "mixRetail", blend: "mixBlend" }[ui.sale.choices.mix]),
    t(ui.lang, { low: "rebateLow", std: "rebateStd", high: "rebateHigh" }[ui.sale.choices.rebate]),
  ].join(" · ");
  const cheerOff = ui.sale.choices.cheer >= ui.catalog.balance.cheerMax || (!reduced && ui.sale.mode === "done");
  return `<section class="card sale-stage" id="sale-stage">
      <h2>${t(ui.lang, "heat")}</h2>
      <button class="go cheer-stage" data-action="cheer" ${cheerOff ? "disabled" : ""}>${t(ui.lang, "cheer")} · ${t(ui.lang, "cheerSub")}<small id="cheer-left">${ui.sale.choices.cheer}/${ui.catalog.balance.cheerMax} · ${t(ui.lang, "cheerLeft", { n: ui.catalog.balance.cheerMax - ui.sale.choices.cheer })}</small></button>
      <div class="heat" aria-hidden="true"><span id="heat-fill" style="width:${heat}%"></span></div>
      <div class="sale-nums">
        <div><span>${t(ui.lang, "heat")}</span><strong id="heat-num">${heat}</strong></div>
        <div><span>${t(ui.lang, "soldNow")}</span><strong id="sold-num">${shown}</strong></div>
        <div><span>${t(ui.lang, "unitsLeft")}</span><strong id="left-num">${Math.max(0, quote.units - shown)}</strong></div>
      </div>
      <div class="dots" id="dots" data-sold="${shown}">${Array.from({ length: quote.units }, (_, index) => `<i class="${index < shown ? "sold" : ""}"></i>`).join("")}</div>
      <div class="pops" id="pops">${ui.sale.pops.map((pop) => `<span class="pop">${escapeHtml(pop.text)}</span>`).join("")}</div>
      <p class="fine">${cast}</p>
      <p class="fine">${t(ui.lang, "provisionalCash")} <strong id="tally">${formatHkd(quote.askPerUnit * shown)}</strong> ${badge("game")}</p>
      ${showOutcome ? outcomeLine(quote) : `<p class="kicker">${t(ui.lang, "selling")}</p>`}
    </section>`;
}

function sellView() {
  ensureSale();
  if (ui.sale.mode === "setup") return `${errorBanner()}${sellSetup()}`;
  return sellLive();
}

function settleView() {
  const project = ui.state.project;
  if (project?.skipped) {
    return `<section class="card"><h2>${t(ui.lang, "settleKicker")}</h2>
      <h3>${t(ui.lang, "skippedTitle")}</h3>
      <p class="note">${t(ui.lang, "skippedBody")}</p>
      <p class="fine">${t(ui.lang, "lastMove")} ${mul(ui.state.market.lastMove)} ${badge("game")}</p>
      <p class="note">${t(ui.lang, "project")} ${ui.state.completed + 1} / ${ui.catalog.balance.projects}</p>
    </section>`;
  }
  const sale = project.sale;
  const after = ui.state.cash + sale.netCash;
  const cls = sale.profit >= 0 ? "ok" : "bad";
  const sign = sale.profit >= 0 ? "+" : "";
  return `<section class="card"><h2>${t(ui.lang, "settleKicker")}</h2>
    ${outcomeLine(sale)}
    <p class="kicker">${t(ui.lang, "profit")}</p>
    <div class="big-profit ${cls}">${sign}${formatHkd(sale.profit)}</div>
    ${badge("game")}
    <p class="fine">${t(ui.lang, "project")} ${project.index} / ${ui.catalog.balance.projects} · ${escapeHtml(districtLabel(ui.lang, project.offer.district))} · ${t(ui.lang, typeKey(project.offer.type))}</p>
    ${moneyRow(t(ui.lang, "saleIn"), formatHkd(sale.afterRebate), "game")}
    ${moneyRow(t(ui.lang, "agentFee"), formatHkd(sale.agentFee), "game")}
    ${moneyRow(t(ui.lang, "adCost"), formatHkd(sale.adCost), "game")}
    ${moneyRow(t(ui.lang, "rebateCost"), formatHkd(sale.rebateCost), "game")}
    ${moneyRow(t(ui.lang, "partnerShare"), formatHkd(sale.partnerShare), "game")}
    ${moneyRow(t(ui.lang, "fireSale"), formatHkd(sale.fireNet), "game")}
    ${moneyRow(t(ui.lang, "landCost"), formatHkd(project.offer.landTotal), "game")}
    ${moneyRow(t(ui.lang, "buildCost"), formatHkd(project.contractor.total), "game")}
    <div class="row"><span>${t(ui.lang, "repChange")}</span><strong>${sale.reputationDelta >= 0 ? "+" : ""}${sale.reputationDelta}</strong></div>
    <div class="row"><span>${t(ui.lang, "soldNow")}</span><strong>${sale.sold} / ${sale.units}</strong></div>
    ${moneyRow(t(ui.lang, "cashNow"), formatHkd(after), "game")}
  </section>`;
}

function storyView() {
  const story = ui.state.story;
  return `<section class="card"><h2>${t(ui.lang, "storyKicker")}</h2>
    <p>${escapeHtml(story.tc)}</p>
    <p class="note">${escapeHtml(story.en)}</p>
  </section>`;
}

function flagText(id) {
  for (const story of STORIES) {
    const choice = story.choices.find((item) => item.flag === id);
    if (choice) return `${choice.tc} · ${choice.en}`;
  }
  return id;
}

function summaryView() {
  const summary = endSummary(ui.state);
  const flags = Object.keys(summary.flags);
  const rows = summary.history.map((item) => {
    if (item.skipped) {
      return `<li><span>${item.index} · ${t(ui.lang, "skip")}</span><strong>0</strong></li>`;
    }
    const outcome = { clear: "沽清", partial: "部分成功", fail: "失敗" }[item.outcome] || item.outcome;
    const sign = item.profit >= 0 ? "+" : "";
    return `<li><span>${item.index} · ${escapeHtml(districtLabel(ui.lang, item.district))} · ${outcome}</span><strong>${sign}${formatHkd(item.profit)}</strong></li>`;
  }).join("");
  return `<section class="card"><h2>${t(ui.lang, "summaryKicker")}</h2>
    <p class="note">${escapeHtml(ui.state.company.name)} · ${t(ui.lang, "project")} 20/20</p>
    ${moneyRow(t(ui.lang, "cash"), formatHkd(summary.cash), "game")}
    <div class="row"><span>${t(ui.lang, "reputation")}</span><strong>${summary.reputation}</strong></div>
    <div class="row"><span>${t(ui.lang, "summarySold")}</span><strong>${summary.unitsSold}</strong></div>
    <p class="chip-label">${t(ui.lang, "summaryFlags")}</p>
    <div class="flags">${flags.length ? flags.map((id) => `<span class="flag">${escapeHtml(flagText(id))}</span>`).join("") : `<span class="flag">${t(ui.lang, "noFlags")}</span>`}</div>
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
  return `${noticeBanner()}
    <section class="card">
      <p class="kicker">${t(ui.lang, "companyKicker")}</p>
      <h3>${t(ui.lang, "title")}</h3>
      <p class="note">${t(ui.lang, "companyLead")}</p>
      <div class="preview">${logoSvg(ui.draft.logo, ui.draft.color, ui.draft.name)}</div>
      <span class="chip-label">${t(ui.lang, "companyName")}</span>
      <div class="names">${names}</div>
      <input id="company-name" class="name-field" maxlength="16" value="${escapeHtml(ui.draft.name)}" aria-label="${escapeHtml(t(ui.lang, "companyName"))}">
      <span class="chip-label">${t(ui.lang, "logo")}</span>
      <div class="chips">${logos}</div>
      <span class="chip-label">${t(ui.lang, "color")}</span>
      <div class="swatches">${colors}</div>
    </section>`;
}

function dock() {
  if (ui.menu) return "";
  if (!ui.state) return `<footer class="dock cols-3"><button class="go" data-action="found">${t(ui.lang, "found")}</button></footer>`;
  const phase = ui.state.phase;
  if (phase === "land") {
    const buttons = ui.state.offers.map((offer) => {
      const broke = ui.state.cash < offer.landTotal;
      const word = t(ui.lang, offer.verdict === "expensive" ? "expensive" : offer.verdict === "cheap" ? "cheap" : "fair");
      const price = `${formatHkd(offer.landPerFt2)}${t(ui.lang, "perFt")}`;
      return `<button data-action="buy" data-slot="${offer.slot}" ${broke ? "disabled" : ""}>${t(ui.lang, "slot", { slot: offer.slot })}<small>${word} · ${price}${broke ? ` · ${t(ui.lang, "broke")}` : ""}</small></button>`;
    }).join("");
    return `<footer class="dock land">${buttons}<button class="wide" data-action="skip">${t(ui.lang, "skip")}<small>${t(ui.lang, "skipSub")}</small></button></footer>`;
  }
  if (phase === "build") {
    const buttons = ["jingjin", "huimen", "xinjing"].map((id) => {
      const quote = contractorQuote(ui.catalog, ui.state, id);
      return `<button data-action="contractor" data-id="${id}">${t(ui.lang, id)}<small>${formatHkd(quote.total)}</small></button>`;
    }).join("");
    return `<footer class="dock cols-3">${buttons}</footer>`;
  }
  if (phase === "sell") {
    ensureSale();
    if (ui.sale.mode === "setup") return `<footer class="dock cols-3"><button class="go" data-action="launch-sale">${t(ui.lang, "openSale")}</button></footer>`;
    const left = ui.catalog.balance.cheerMax - ui.sale.choices.cheer;
    const cheerOff = left <= 0 || (!ui.sale.reduced && ui.sale.mode === "done");
    const cheer = `<button class="go" data-action="cheer" ${cheerOff ? "disabled" : ""}>${t(ui.lang, "cheer")}<small>${t(ui.lang, "cheerSub")} · ${t(ui.lang, "cheerLeft", { n: left })}</small></button>`;
    const settle = `<button class="go" data-action="commit-sale">${t(ui.lang, "toSettle")}</button>`;
    if (ui.sale.reduced) return `<footer class="dock cols-3">${cheer}${settle}</footer>`;
    if (ui.sale.mode === "done") return `<footer class="dock cols-3">${cheer}${settle}</footer>`;
    return `<footer class="dock cols-3">${cheer}</footer>`;
  }
  if (phase === "settle") return `<footer class="dock cols-3"><button class="go" data-action="confirm-settle">${t(ui.lang, "nextStep")}</button></footer>`;
  if (phase === "story") {
    const buttons = ui.state.story.choices.map((choice) => `<button data-action="story" data-id="${choice.id}">${escapeHtml(choice.tc)}<small>${escapeHtml(choice.en)}</small></button>`).join("");
    const cols = ui.state.story.choices.length > 1 ? "cols-2" : "cols-3";
    return `<footer class="dock ${cols}">${buttons}</footer>`;
  }
  return `<footer class="dock cols-3"><button class="go" data-action="new-game">${t(ui.lang, "again")}</button></footer>`;
}

function hud() {
  const projects = ui.catalog.balance.projects;
  const cash = ui.state ? ui.state.cash : ui.catalog.balance.startingCash;
  const rep = ui.state ? ui.state.reputation : ui.catalog.balance.startingReputation;
  const number = ui.state ? projectNumber(ui.state) : 0;
  const company = ui.state?.company || ui.draft;
  const step = ui.state ? t(ui.lang, stepKey(ui.state.phase)) : t(ui.lang, "stepCompany");
  return `<header class="hud">
    <div class="brand">${logoSvg(company.logo, company.color, company.name)}<div><h1>${escapeHtml(company.name)}</h1><p>${t(ui.lang, "tagline")}</p></div></div>
    <div class="stats">
      <div class="stat"><span class="k">${t(ui.lang, "cash")}</span><strong>${compactHkd(cash)}</strong></div>
      <div class="stat"><span class="k">${t(ui.lang, "reputation")}</span><strong>${rep}</strong></div>
      <div class="stat"><span class="k">${t(ui.lang, "project")}</span><strong>${number ? `${number} / ${projects}` : `— / ${projects}`}</strong></div>
      <div class="stat"><span class="k">${t(ui.lang, "nextStep")}</span><strong>${step}</strong></div>
    </div>
    <div class="hud-actions">
      <button class="ghost" data-action="lang">${t(ui.lang, "langName")}</button>
      ${ui.state ? `<button class="ghost" data-action="menu">${t(ui.lang, "menu")}</button>` : ""}
    </div>
  </header>
  <div class="progress" aria-hidden="true"><span style="width:${(number / projects) * 100}%"></span></div>`;
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
  const lang = ui.lang === "en" ? "en" : "zh-Hant";
  document.documentElement.lang = lang;
  const phase = ui.state?.phase || "company";
  app.innerHTML = `${hud()}
    <div class="shell" data-phase="${phase}">
      <main class="stack" id="main">${mainView()}</main>
      <aside class="stack side">${ui.state && ["land", "build", "sell"].includes(ui.state.phase) ? flavourMap() : ""}${marketCard()}${openCard()}</aside>
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
  persist();
  render();
}

function newGame() {
  stopSaleTimer();
  ui.state = null;
  ui.sale = null;
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
  if (action === "contractor") apply(chooseContractor(ui.catalog, ui.state, id));
  if (action === "pick-ask" || action === "pick-agents" || action === "pick-ads" || action === "pick-mix" || action === "pick-rebate") {
    const key = action.replace("pick-", "");
    ui.sale.choices[key] = id;
    render();
    return;
  }
  if (action === "launch-sale") {
    launchSale();
    return;
  }
  if (action === "cheer") {
    if (!ui.sale || ui.sale.choices.cheer >= ui.catalog.balance.cheerMax) return;
    if (!ui.sale.reduced && ui.sale.mode === "done") return;
    if (ui.sale.mode === "setup") return;
    ui.sale.choices.cheer += 1;
    const quote = currentQuote();
    if (ui.sale.reduced) {
      ui.sale.shownSold = quote.sold;
      render();
      return;
    }
    const tProgress = Math.min(1, (performance.now() - ui.sale.started) / 8000);
    const bumped = Math.max(ui.sale.shownSold, Math.round(quote.sold * Math.max(tProgress, 0.2)));
    if (bumped > ui.sale.shownSold) {
      ui.sale.pops.unshift({ text: `+${formatHkd(quote.askPerUnit * (bumped - ui.sale.shownSold))}` });
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
  let raw = null;
  try {
    raw = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
  } catch {
    raw = null;
  }
  const legacy = localStorage.getItem(LEGACY_KEY);
  const migrated = migrateSave(raw);
  if (migrated.ok) {
    try {
      ui.state = hydrateCampaign(ui.catalog, migrated.state);
      if (legacy) localStorage.removeItem(LEGACY_KEY);
    } catch {
      ui.state = null;
      ui.notice = "phase1_reset";
      localStorage.removeItem(SAVE_KEY);
    }
  } else if (raw || legacy) {
    ui.notice = "phase1_reset";
    if (raw) localStorage.removeItem(SAVE_KEY);
    if (legacy) localStorage.removeItem(LEGACY_KEY);
  }
  app.addEventListener("click", onClick);
  app.addEventListener("input", onInput);
  render();
}

boot().catch((error) => {
  app.textContent = error.message;
});
