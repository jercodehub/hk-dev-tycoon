import {
  buy,
  build,
  createCatalog,
  createGame,
  gameIndex,
  hold,
  hydrate,
  marketPath,
  netWorth,
  quote,
  rent,
  sell,
  serialize,
  tick,
} from "./engine.js";
import {
  DISTRICTS,
  districtLabel,
  errorText,
  formatHkd,
  regionLabel,
  t,
} from "./i18n.js";

const SAVE_KEY = "hk-dev-tycoon-v1";
const LANG_KEY = "hk-dev-tycoon-lang";

const ui = {
  lang: "tc",
  catalog: null,
  state: null,
  selectedId: null,
  district: "沙田區",
  error: null,
  saved: null,
  map: null,
  layer: null,
};

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

function figureRow(label, valueText, kind) {
  return `<div class="money-row"><div class="money-top"><span>${label}</span><strong>${valueText}</strong></div>${badge(kind)}</div>`;
}

function moneyRow(label, value, kind, suffix = "") {
  return figureRow(label, `${formatHkd(value)}${suffix}`, kind);
}

function statusLabel(owned) {
  if (!owned) return t(ui.lang, "market");
  if (owned.status === "land") return t(ui.lang, "landStatus");
  if (owned.use === "rent") return t(ui.lang, "rentStatus");
  return t(ui.lang, "holdStatus");
}

function ownedById() {
  return new Map((ui.state?.parcels ?? []).map((parcel) => [parcel.id, parcel]));
}

function selectedParcel() {
  if (!ui.selectedId || !ui.catalog) return null;
  return ui.catalog.byId.get(ui.selectedId) || null;
}

function persist() {
  if (!ui.state) return;
  localStorage.setItem(SAVE_KEY, JSON.stringify(serialize(ui.state)));
  localStorage.setItem(LANG_KEY, ui.lang);
  ui.saved = serialize(ui.state);
}

function apply(result) {
  if (!result.ok) {
    ui.error = result.error;
    render();
    return;
  }
  ui.state = result.state;
  ui.error = null;
  persist();
  render();
}

function cheapestProject(district) {
  if (!ui.state) return null;
  let best = null;
  for (const parcel of ui.catalog.parcels) {
    if (parcel.district !== district) continue;
    if (ui.state.parcels.some((owned) => owned.id === parcel.id)) continue;
    const priced = quote(ui.catalog, ui.state, parcel);
    const cost = priced.game.landPrice + priced.game.buildCost;
    if (!best || cost < best.cost) best = { parcel, priced, cost };
  }
  return best;
}

function sparkline(points, tick) {
  const levels = points.map((point) => point.gameLevel);
  const min = Math.min(...levels);
  const max = Math.max(...levels);
  const width = 320;
  const height = 52;
  const coords = points.map((point, index) => {
    const x = (index / (points.length - 1)) * (width - 8) + 4;
    const y = height - 6 - ((point.gameLevel - min) / (max - min || 1)) * (height - 14);
    return [x, y];
  });
  const line = coords.map((coord, index) => `${index ? "L" : "M"}${coord[0].toFixed(1)},${coord[1].toFixed(1)}`).join(" ");
  const here = coords[Math.min(tick, coords.length - 1)];
  return `<svg class="spark" viewBox="0 0 ${width} ${height}" role="img">
    <path d="${line}" fill="none" stroke="#f0c27a" stroke-width="2"></path>
    <circle cx="${here[0].toFixed(1)}" cy="${here[1].toFixed(1)}" r="3.5" fill="#ffffff"></circle>
  </svg>`;
}

function goalCard() {
  const { state, lang } = ui;
  if (!state) return "";
  if (state.goals.mode === "tutorial") {
    const steps = state.goals.steps;
    const items = [
      ["buy", "stepBuy"],
      ["build", "stepBuild"],
      ["rent", "stepRent"],
      ["collect", "stepCollect"],
    ];
    return `<section class="card"><h2>${t(lang, "tutorialTitle")}</h2><ul class="checks">${items
      .map(([key, label]) => `<li class="${steps[key] ? "done" : ""}">${t(lang, label)}</li>`)
      .join("")}</ul></section>`;
  }
  const worth = netWorth(ui.catalog, state);
  return `<section class="card"><h2>${t(lang, "freeTitle")}</h2><p class="note">${t(lang, "freeNeed", {
    target: formatHkd(state.goals.targetNetWorth),
  })}</p>${moneyRow(t(lang, "netWorth"), worth, "game")}</section>`;
}

function banner() {
  const { state, lang, error } = ui;
  if (error) return `<div class="banner bad">${escapeHtml(errorText(lang, error))}</div>`;
  if (!state) return "";
  if (state.goals.bankrupt) return `<div class="banner bad">${t(lang, "bankrupt")}</div>`;
  if (state.goals.finished && state.goals.won) return `<div class="banner ok">${t(lang, "finishedWin")}</div>`;
  if (state.goals.finished) return `<div class="banner bad">${t(lang, "finishedLose")}</div>`;
  if (state.goals.won && state.goals.mode === "tutorial") {
    return `<div class="banner ok">${t(lang, "won")} ${t(lang, "wonKeep")}</div>`;
  }
  if (state.goals.won) return `<div class="banner ok">${t(lang, "wonFree")} ${t(lang, "wonKeep")}</div>`;
  if (state.goals.mode === "tutorial") {
    return `<div class="banner info">${t(lang, "tutorial")}</div>`;
  }
  return "";
}

function reportCard() {
  const report = ui.state?.report;
  if (!report) return "";
  return `<section class="card"><h2>${t(ui.lang, "last")}</h2>
    ${moneyRow(t(ui.lang, "rentIn"), report.rentIncome, "game")}
    ${moneyRow(t(ui.lang, "costOut"), report.holdingCost, "game")}
  </section>`;
}

function openDataCard() {
  const { market } = ui.catalog;
  const prices = market.prices.averagePrices;
  const index = market.prices.priceIndex.series.all;
  const regions = ["港島", "九龍", "新界"].map((region) => {
    const cell = prices.areas[region].B;
    return `<div class="money-row"><div class="money-top"><span>${t(ui.lang, "regionPrice", {
      region: regionLabel(ui.lang, region),
    })}</span><strong>${formatHkd(cell.value)} / m²</strong></div>${badge("open")}</div>`;
  });
  const provisional = prices.provisional ? `<p class="fine">${t(ui.lang, "provisional")} · ${escapeHtml(prices.month)}</p>` : "";
  return `<section class="card"><h2>${t(ui.lang, "openTitle")}</h2>
    <div class="money-row"><div class="money-top"><span>${t(ui.lang, "index")}</span><strong>${index.value}</strong></div>${badge("open")}<p class="fine">${escapeHtml(market.prices.priceIndex.base)} · ${escapeHtml(market.prices.priceIndex.month)}</p></div>
    <div class="region-prices">${regions.join("")}</div>
    ${provisional}
    <p class="fine">${t(ui.lang, "noDistrictPrices")}</p>
  </section>`;
}

function pathCard() {
  const points = marketPath(ui.catalog);
  const current = gameIndex(ui.catalog, ui.state?.tick ?? 0);
  return `<section class="card"><h2>${t(ui.lang, "gameTitle")}</h2>
    ${sparkline(points, ui.state?.tick ?? 0)}
    ${figureRow(t(ui.lang, "index"), String(current.gameLevel), "game")}
    <p class="fine">${t(ui.lang, "script")}</p>
  </section>`;
}

function parcelCard() {
  const parcel = selectedParcel();
  if (!parcel || !ui.state) return `<section class="card"><p class="note">${t(ui.lang, "pick")}</p></section>`;
  const owned = ownedById().get(parcel.id);
  const priced = quote(ui.catalog, ui.state, parcel);
  const counts = ui.catalog.market.areas[parcel.district];
  const region = regionLabel(ui.lang, parcel.region);
  const district = districtLabel(ui.lang, parcel.district);
  const finished = ui.state.goals.finished;
  const tutorialBlocked = ui.state.goals.mode === "tutorial" && parcel.district !== "沙田區";
  const canBuy = !owned && !finished && !tutorialBlocked && ui.state.cash >= priced.game.landPrice;
  const canBuild = owned?.status === "land" && !finished && ui.state.cash >= priced.game.buildCost;
  let affordNote = "";
  if (tutorialBlocked) affordNote = errorText(ui.lang, "tutorial_sha_tin_only");
  else if (!owned && !finished && ui.state.cash < priced.game.landPrice) affordNote = errorText(ui.lang, "insufficient_cash");
  else if (owned?.status === "land" && !finished && ui.state.cash < priced.game.buildCost) {
    affordNote = errorText(ui.lang, "insufficient_cash");
  }
  return `<section class="card">
    <h3>${escapeHtml(parcel.id)} · ${escapeHtml(district)}</h3>
    <p class="note">${escapeHtml(statusLabel(owned))} · ${escapeHtml(region)}</p>
    <p class="fine">${t(ui.lang, "address")}: ${escapeHtml(parcel.sampleAddress || "—")}</p>
    <div class="row"><span>${t(ui.lang, "buildings")}</span><strong>${parcel.buildings}</strong></div>
    <div class="row"><span>${t(ui.lang, "year")}</span><strong>${parcel.medianYear}</strong></div>
    ${badge("open")}
    <p class="fine">${t(ui.lang, "ageNote")}</p>
    <div class="row"><span>${t(ui.lang, "stock")}</span><strong>${counts.stock.toLocaleString("en-US")}</strong></div>
    <div class="row"><span>${t(ui.lang, "completions")}</span><strong>${counts.completions.toLocaleString("en-US")}</strong></div>
    <div class="row"><span>${t(ui.lang, "vacancy")}</span><strong>${counts.vacancyPct}%</strong></div>
    ${badge("open")}
    <p class="fine">${t(ui.lang, "countsNote")}</p>
    ${moneyRow(t(ui.lang, "classB"), priced.openData.hkdPerM2, "open", " / m²")}
    <p class="fine">${t(ui.lang, "notDistrict", { region, district })}</p>
    <div class="row"><span>${t(ui.lang, "units")}</span><strong>${priced.game.units} · ${priced.game.areaM2} m²</strong></div>
    ${moneyRow(t(ui.lang, "land"), priced.game.landPrice, "game")}
    ${moneyRow(t(ui.lang, "buildCost"), priced.game.buildCost, "game")}
    ${moneyRow(t(ui.lang, "saleable"), priced.game.saleable, "game")}
    ${moneyRow(t(ui.lang, "rentQ"), priced.game.rentPerQuarter, "game")}
    ${moneyRow(t(ui.lang, "holdingQ"), owned?.status === "built" ? priced.game.holdingPerQuarter : priced.game.landHoldingPerQuarter, "game")}
    ${owned ? moneyRow(t(ui.lang, "sellNow"), owned.status === "built" ? priced.game.sellProceeds : priced.game.sellLandProceeds, "game") : ""}
    <p class="fine">${t(ui.lang, "supplyNote")}</p>
    ${affordNote ? `<div class="banner bad">${escapeHtml(affordNote)}</div>` : ""}
    <div class="actions">
      <button class="action accent" data-action="buy" data-id="${escapeHtml(parcel.id)}" ${canBuy ? "" : "disabled"}>${t(ui.lang, "buy")}</button>
      <button class="action" data-action="build" data-id="${escapeHtml(parcel.id)}" ${canBuild ? "" : "disabled"}>${t(ui.lang, "build")}</button>
      <button class="action" data-action="hold" data-id="${escapeHtml(parcel.id)}" ${owned?.status === "built" && !finished ? "" : "disabled"}>${t(ui.lang, "hold")}</button>
      <button class="action" data-action="rent" data-id="${escapeHtml(parcel.id)}" ${owned?.status === "built" && !finished ? "" : "disabled"}>${t(ui.lang, "rent")}</button>
      <button class="action" data-action="sell" data-id="${escapeHtml(parcel.id)}" ${owned && !finished ? "" : "disabled"}>${t(ui.lang, "sell")}</button>
    </div>
  </section>`;
}

function listCard() {
  const owned = ownedById();
  const hint = ui.state?.goals.mode === "tutorial" ? cheapestProject("沙田區") : null;
  const options = DISTRICTS.map(([name]) => {
    const selected = name === ui.district ? "selected" : "";
    return `<option value="${escapeHtml(name)}" ${selected}>${escapeHtml(districtLabel(ui.lang, name))}</option>`;
  }).join("");
  const rows = ui.catalog.parcels
    .filter((parcel) => parcel.district === ui.district)
    .sort((a, b) => {
      if (!ui.state) return a.id.localeCompare(b.id);
      return quote(ui.catalog, ui.state, a).game.landPrice - quote(ui.catalog, ui.state, b).game.landPrice;
    })
    .map((parcel) => {
      const mine = owned.get(parcel.id);
      const priced = ui.state ? quote(ui.catalog, ui.state, parcel) : null;
      const price = priced ? formatHkd(priced.game.landPrice) : "";
      return `<button class="parcel-btn ${parcel.id === ui.selectedId ? "active" : ""}" data-action="select" data-id="${escapeHtml(parcel.id)}">
        <span><strong>${escapeHtml(parcel.id)}</strong><small>${escapeHtml(statusLabel(mine))} · ${parcel.buildings}</small></span>
        <span>${price}</span>
      </button>`;
    })
    .join("");
  const hintHtml = hint
    ? `<p class="fine">${t(ui.lang, "hint", { id: hint.parcel.id, cost: formatHkd(hint.cost) })} ${badge("game")}</p>`
    : "";
  return `<section class="card">
    <div class="row"><span>${t(ui.lang, "owned", { n: ui.state?.parcels.length ?? 0 })}</span></div>
    <select data-action="district">${options}</select>
    <p class="fine">遊戲數值 / Game economy</p>
    <div class="parcel-list">${rows}</div>
    ${hintHtml}
  </section>`;
}

function renderStart() {
  const start = document.querySelector("#start");
  const canClose = Boolean(ui.state);
  start.classList.toggle("hidden", false);
  start.innerHTML = `<div class="start-card">
    <h2>${t(ui.lang, "title")}</h2>
    <p>${t(ui.lang, "startLead")}</p>
    <p class="note">${t(ui.lang, "startData")}</p>
    <p class="fine">${t(ui.lang, "disclaimer")} · ${t(ui.lang, "disclaimerEn")}</p>
    ${ui.saved ? `<p class="fine">${t(ui.lang, "saved")}</p>` : ""}
    <div class="modes">
      <button class="mode-btn" data-action="start" data-mode="tutorial"><strong>${t(ui.lang, "tutorial")}</strong><span>Sha Tin</span></button>
      <button class="mode-btn" data-action="start" data-mode="free"><strong>${t(ui.lang, "free")}</strong><span>12 quarters</span></button>
      ${ui.saved ? `<button class="mode-btn" data-action="continue"><strong>${t(ui.lang, "continue")}</strong></button>` : ""}
      ${canClose ? `<button class="mode-btn" data-action="close-menu"><strong>${t(ui.lang, "close")}</strong></button>` : ""}
    </div>
    <div class="modes"><button class="ghost" data-action="lang">${t(ui.lang, "langName")}</button></div>
  </div>`;
}

function render() {
  const lang = ui.lang;
  document.documentElement.lang = lang === "en" ? "en" : "zh-Hant";
  const state = ui.state;
  const cash = state ? state.cash : null;
  const worth = state ? netWorth(ui.catalog, state) : null;
  document.querySelector("#header").innerHTML = `
    <div class="brand"><h1>${t(lang, "title")}</h1><p>${t(lang, "tagline")}</p></div>
    <div class="header-stats">
      <div class="stat"><span class="k">${t(lang, "quarterLabel")}</span><strong>${state ? `${state.tick} / ${state.goals.maxTicks}` : "—"}</strong></div>
      <div class="stat"><span class="k">${t(lang, "cash")}</span><strong>${cash == null ? "—" : formatHkd(cash)}</strong>${badge("game")}</div>
      <div class="stat"><span class="k">${t(lang, "netWorth")}</span><strong>${worth == null ? "—" : formatHkd(worth)}</strong>${badge("game")}</div>
    </div>
    <div class="header-actions">
      <button class="ghost" data-action="lang">${t(lang, "langName")}</button>
      <button class="ghost" data-action="menu">${t(lang, "menu")}</button>
    </div>`;
  const pips = state
    ? `<div class="pips">${Array.from({ length: state.goals.maxTicks }, (_, index) => `<i class="${index < state.tick ? "on" : ""}"></i>`).join("")}</div>`
    : "";
  const panel = document.querySelector("#panel");
  const scrollTop = panel.scrollTop;
  panel.innerHTML = `
    ${banner()}
    ${pips}
    ${state ? `<button class="primary next" data-action="tick" ${state.goals.finished ? "disabled" : ""}>${t(lang, "next")}</button>` : ""}
    ${goalCard()}
    ${reportCard()}
    ${parcelCard()}
    ${listCard()}
    ${pathCard()}
    ${openDataCard()}
    <p class="fine">${t(lang, "disclaimer")} · ${t(lang, "disclaimerEn")}</p>`;
  panel.scrollTop = scrollTop;
  if (ui.selectedId && ui.selectedId !== ui.scrolledId) {
    panel.querySelector(".parcel-btn.active")?.scrollIntoView({ block: "nearest" });
    ui.scrolledId = ui.selectedId;
  }
  document.querySelector("#legend").innerHTML = `
    <span><i class="swatch market"></i>${t(lang, "legendMarket")}</span>
    <span><i class="swatch land"></i>${t(lang, "legendLand")}</span>
    <span><i class="swatch hold"></i>${t(lang, "legendHold")}</span>
    <span><i class="swatch rent"></i>${t(lang, "legendRent")}</span>
    <button class="ghost" data-action="fit">${t(lang, "fit")}</button>`;
  drawMarkers();
}

function drawMarkers() {
  if (!ui.layer || !ui.catalog) return;
  ui.layer.clearLayers();
  const owned = ownedById();
  const tutorial = ui.state?.goals.mode === "tutorial";
  for (const parcel of ui.catalog.parcels) {
    const mine = owned.get(parcel.id);
    let fill = "#7d8da3";
    if (mine?.status === "land") fill = "#e7b15a";
    if (mine?.status === "built" && mine.use !== "rent") fill = "#6ea2ff";
    if (mine?.status === "built" && mine.use === "rent") fill = "#3ecf8e";
    const selected = parcel.id === ui.selectedId;
    const marker = L.circleMarker([parcel.lat, parcel.lng], {
      radius: selected ? 8 : 5.5,
      color: selected ? "#ffffff" : "#0e141d",
      weight: selected ? 2 : 1,
      fillColor: fill,
      fillOpacity: tutorial && parcel.district !== "沙田區" ? 0.28 : 0.92,
    });
    marker.on("click", () => {
      ui.selectedId = parcel.id;
      ui.district = parcel.district;
      ui.error = null;
      render();
    });
    marker.addTo(ui.layer);
  }
}

function fitShaTin() {
  if (!ui.map) return;
  const bounds = ui.catalog.parcels
    .filter((parcel) => parcel.district === "沙田區")
    .map((parcel) => [parcel.lat, parcel.lng]);
  ui.map.fitBounds(bounds, { padding: [28, 28] });
}

function startMode(mode) {
  ui.state = createGame(ui.catalog, { mode });
  ui.district = "沙田區";
  ui.selectedId = cheapestProject("沙田區")?.parcel.id ?? null;
  ui.scrolledId = null;
  ui.error = null;
  document.querySelector("#start").classList.add("hidden");
  persist();
  render();
  if (mode === "tutorial") fitShaTin();
  else ui.map.fitBounds(ui.catalog.parcels.map((parcel) => [parcel.lat, parcel.lng]), { padding: [20, 20] });
  setTimeout(() => ui.map.invalidateSize(), 50);
}

function continueGame() {
  try {
    ui.state = hydrate(ui.catalog, ui.saved);
  } catch {
    localStorage.removeItem(SAVE_KEY);
    ui.saved = null;
    renderStart();
    return;
  }
  ui.district = ui.state.parcels[0]?.district || (ui.state.goals.mode === "tutorial" ? "沙田區" : "沙田區");
  ui.selectedId = ui.state.parcels[0]?.id || null;
  ui.error = null;
  document.querySelector("#start").classList.add("hidden");
  render();
  if (ui.state.goals.mode === "tutorial") fitShaTin();
  setTimeout(() => ui.map.invalidateSize(), 50);
}

function onClick(event) {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const { action, id, mode } = target.dataset;
  if (action === "lang") {
    ui.lang = ui.lang === "tc" ? "en" : "tc";
    localStorage.setItem(LANG_KEY, ui.lang);
    render();
    if (!document.querySelector("#start").classList.contains("hidden")) renderStart();
    return;
  }
  if (action === "menu") {
    renderStart();
    return;
  }
  if (action === "close-menu") {
    document.querySelector("#start").classList.add("hidden");
    return;
  }
  if (action === "start") {
    startMode(mode);
    return;
  }
  if (action === "continue") {
    continueGame();
    return;
  }
  if (action === "fit") {
    fitShaTin();
    return;
  }
  if (action === "select") {
    ui.selectedId = id;
    ui.error = null;
    render();
    return;
  }
  if (!ui.state) return;
  if (action === "tick") apply(tick(ui.catalog, ui.state));
  if (action === "buy") apply(buy(ui.catalog, ui.state, id));
  if (action === "build") apply(build(ui.catalog, ui.state, id));
  if (action === "hold") apply(hold(ui.catalog, ui.state, id));
  if (action === "rent") apply(rent(ui.catalog, ui.state, id));
  if (action === "sell") apply(sell(ui.catalog, ui.state, id));
}

function initMap() {
  ui.map = L.map("map", { zoomControl: true, minZoom: 10 }).setView([22.32, 114.17], 11);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap",
    maxZoom: 19,
  }).addTo(ui.map);
  ui.layer = L.layerGroup().addTo(ui.map);
}

async function boot() {
  ui.lang = localStorage.getItem(LANG_KEY) === "en" ? "en" : "tc";
  const [balance, parcels, market] = await Promise.all([
    fetch("./game/balance.json").then((response) => response.json()),
    fetch("./data/parcels.json").then((response) => response.json()),
    fetch("./data/market-stats.json").then((response) => response.json()),
  ]);
  ui.catalog = createCatalog({ balance, parcels, market });
  try {
    ui.saved = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
    if (!ui.saved || ui.saved.v !== 1) ui.saved = null;
  } catch {
    ui.saved = null;
  }
  app.innerHTML = `<header class="header" id="header"></header>
    <div class="layout">
      <aside class="panel" id="panel"></aside>
      <div class="map-wrap"><div id="map"></div><div class="legend" id="legend"></div></div>
    </div>
    <div id="start" class="start"></div>`;
  app.addEventListener("click", onClick);
  app.addEventListener("change", (event) => {
    if (event.target.matches("[data-action='district']")) {
      ui.district = event.target.value;
      render();
    }
  });
  if (typeof L === "undefined") {
    document.querySelector("#map").textContent = "Leaflet failed to load.";
  } else {
    initMap();
  }
  render();
  renderStart();
}

boot().catch((error) => {
  app.textContent = error.message;
});
