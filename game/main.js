import {
  CHAIR_AVATARS,
  COMPANY_COLORS,
  COMPANY_LOGOS,
  JV_SHARES,
  UNIT_SPECS,
  acknowledgeMismatch,
  addUnits,
  buildOutlook,
  buildSalesBand,
  campaignHeat,
  canAddUnit,
  celebrateClear,
  closingLine,
  chooseContractor,
  chooseLand,
  chooseRemedy,
  chooseStory,
  commentForPhase,
  commitSale,
  confirmSettle,
  contractorQuote,
  contractorRisk,
  createCampaign,
  createCampaignCatalog,
  endSummary,
  explainForecastGap,
  formatCount,
  fundBuild,
  gfaUsed,
  heatProjectsLeft,
  hydrateCampaign,
  loanAdjustments,
  isTutorial,
  isOnboarding,
  jvEligible,
  migrateSave,
  mismatchEcho,
  mixDelta,
  mixPreset,
  popularityNote,
  priceRemedy,
  policyNotes,
  poolMultipliers,
  projectNumber,
  projectPresetMix,
  remedyExtra,
  renameProject,
  resolveSale,
  saleForecast,
  saleLedger,
  saleReveal,
  serializeCampaign,
  settlementPreview,
  shouldTeachMismatch,
  similarProject,
  sizePools,
  skipLand,
  stakeOf,
  towerShares,
  towerWord,
  unitPopularity,
  unlockedAchievements,
  victoryTitle,
  unitRowNote,
  updateCompany,
} from "./campaign.js";
import { t } from "./copy.js";
import { STORIES } from "./stories.js";
import { districtLabel, formatHkd } from "./i18n.js";
import { settlementGroups } from "./ui/settlement.js";

const SAVE_KEY = "hk-dev-tycoon-v3";
const OLD_KEYS = ["hk-dev-tycoon-v2", "hk-dev-tycoon-v1"];
const LANG_KEY = "hk-dev-tycoon-lang";
const NAMES = ["洪興地產", "九龍實業", "雞地發展"];
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
  draft: { name: "洪興地產", logo: "tower", color: "#e2b15a", chairName: "主席", avatar: CHAIR_AVATARS[0] },
  renaming: false,
  identity: false,
  build: null,
  sale: null,
  drawer: null,
  historyFocus: null,
  thaw: null,
  lapse: false,
  ceremony: false,
  flourish: false,
  toast: null,
  toastQueue: [],
  legacyNotice: false,
  legacyGuide: false,
  confirmNewGame: false,
  teach: null,
  similarOpen: true,
  ignoreClick: false,
};

let saleTimer = null;
let lapseTimer = null;
let ceremonyTimer = null;
let toastTimer = null;
let flourishTimer = null;
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
  if (abs >= 100000000) {
    const yi = abs / 100000000;
    const digits = yi >= 100 ? 0 : yi >= 10 ? 1 : 2;
    return `${sign}$${yi.toFixed(digits).replace(/\.0+$/, "")}億`;
  }
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

function avatarSvg(id, color) {
  const ink = /^#[0-9a-f]{6}$/i.test(color) ? color : "#e2b15a";
  const skin = "#f3d2b0";
  const hair = {
    crop: `<path d="M20 24c0-9 5-14 12-14s12 5 12 14c-2 2-22 2-24 0z" fill="${ink}"/>`,
    bob: `<path d="M16 28c0-14 7-20 16-20s16 6 16 20v14H16z" fill="${ink}"/>`,
    glasses: `<path d="M20 22c1-8 6-12 12-12s11 4 12 12" fill="${ink}"/>`,
    bun: `<circle cx="32" cy="10" r="5" fill="${ink}"/><path d="M21 24c0-8 5-12 11-12s11 4 11 12" fill="${ink}"/>`,
    wave: `<path d="M16 30c2-16 10-20 16-18 2 6 8 6 12-4 4 6 6 14 4 22H16z" fill="${ink}"/>`,
    fringe: `<path d="M17 30c1-16 8-20 15-18-2 8-1 10 0 12-4-8-8-6-15 6z" fill="${ink}"/><path d="M32 24c2-10 8-14 15-12 1 8 1 12-2 16-6-6-10-2-13-4z" fill="${ink}"/>`,
  };
  const glasses = id === "glasses"
    ? `<circle cx="26" cy="31" r="5" fill="none" stroke="${ink}" stroke-width="2.4"/><circle cx="39" cy="31" r="5" fill="none" stroke="${ink}" stroke-width="2.4"/><path d="M31 31h3" stroke="${ink}" stroke-width="2.2"/>`
    : "";
  return `<svg class="avatar" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="31" fill="#0e1622" stroke="${ink}" stroke-width="2"/><path d="M14 58c3-12 10-16 18-16s15 4 18 16" fill="${ink}"/>${hair[id] || hair.crop}<circle cx="32" cy="30" r="11" fill="${skin}"/>${glasses}</svg>`;
}

function errorText(code) {
  const table = {
    tc: {
      insufficient_cash: "現金唔夠。",
      bad_phase: "而家未到呢一步。",
      bad_slot: "冇呢幅地。",
      bad_contractor: "冇呢間承建商。",
      bad_choice: "冇呢一下。",
      over_gfa: "超咗可建樓面。",
      empty_mix: "未分配單位。",
      short_cash: "現金唔夠你份額。",
      need_remedy: "先揀趕工定接受差啲銷情。",
      bad_stake: "呢幅地未開合營。",
    },
    en: {
      insufficient_cash: "Not enough cash.",
      bad_phase: "That step is not open.",
      bad_slot: "That plot is not on offer.",
      bad_contractor: "Unknown contractor.",
      bad_choice: "Unknown choice.",
      over_gfa: "Over the buildable area.",
      empty_mix: "No flats allocated.",
      short_cash: "Cash does not cover your share.",
      need_remedy: "Choose a stall fix first.",
      bad_stake: "This site has no venture.",
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
    gameover: "stepGameOver",
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

function siteKey(tier) {
  return { mid: "siteMid", large: "siteLarge", flagship: "siteFlagship" }[tier] || "siteSmall";
}

function loanBaseCost() {
  const offer = ui.state?.project?.offer;
  const stake = stakeOf(offer);
  if (ui.build?.contractor) return contractorQuote(ui.catalog, ui.state, ui.build.contractor)?.playerCost || 0;
  return Math.round((offer?.estBuildTotal || 0) * stake);
}

function funding(mode = "cash") {
  return fundBuild(ui.catalog.balance, {
    cash: ui.state?.cash || 0,
    cost: loanBaseCost(),
    mode,
    adjust: loanAdjustments(ui.state),
  });
}

function yellowBanner() {
  if (!ui.state?.credit?.yellow || !ui.state.credit.owed) return "";
  return `<div class="banner warn">${t(ui.lang, "yellowBanner", { owed: compactHkd(ui.state.credit.owed) })}</div>`;
}

function riskMeters(id) {
  const spec = ui.catalog.balance.contractors[id];
  const risk = contractorRisk(spec, ui.catalog.balance);
  const bar = (key, ratio) => `<span class="risk"><em>${t(ui.lang, key)}</em><b><i style="width:${Math.round(ratio * 100)}%"></i></b></span>`;
  return `<span class="risks">${bar("leak", risk.leak)}${bar("collapse", risk.collapse)}</span>`;
}

function needsRemedy() {
  return Boolean(ui.state?.phase === "sell" && ui.state.project?.contractor?.remedyPending && !ui.lapse && !ui.teach);
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

function stopLapse() {
  if (lapseTimer) {
    clearTimeout(lapseTimer);
    lapseTimer = null;
  }
}

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function persist() {
  if (!ui.state) return;
  localStorage.setItem(SAVE_KEY, JSON.stringify(serializeCampaign(ui.state)));
  localStorage.setItem(LANG_KEY, ui.lang);
}

function frozenTotal(state) {
  return (state?.frozen || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
}

function frozenInfo(state) {
  const items = state?.frozen || [];
  if (!items.length) return null;
  const amount = frozenTotal(state);
  const soonest = Math.min(...items.map((item) => Number(item.releaseAt) || 0));
  const left = Math.max(1, soonest - (state.completed || 0));
  return { amount, left };
}

function freshAchievements(before, after) {
  const seen = new Set(before?.seenAchievements || []);
  return unlockedAchievements(after, ui.catalog.balance).filter((id) => !seen.has(id));
}

function remember(ids) {
  if (!ui.state || !ids?.length) return;
  const seen = new Set(ui.state.seenAchievements || []);
  for (const id of ids) seen.add(id);
  ui.state = { ...ui.state, seenAchievements: [...seen] };
}

function stopCeremony() {
  if (ceremonyTimer) {
    clearTimeout(ceremonyTimer);
    ceremonyTimer = null;
  }
}

function stopToast() {
  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }
}

function stopFlourish() {
  if (flourishTimer) {
    clearTimeout(flourishTimer);
    flourishTimer = null;
  }
}

function armToast() {
  if (ui.ceremony || ui.toast || !(ui.toastQueue || []).length) return;
  const id = ui.toastQueue.shift();
  remember([id]);
  ui.toast = id;
  stopToast();
  toastTimer = setTimeout(() => {
    ui.toast = null;
    armToast();
    render();
  }, reducedMotion() ? 400 : 1600);
}

function queueToasts(before, after) {
  const fresh = freshAchievements(before, after);
  const sellout = after.phase === "settle" && celebrateClear(after.project?.sale?.outcome);
  if (sellout) {
    remember(fresh.filter((id) => id === "clear"));
    ui.toastQueue = fresh.filter((id) => id !== "clear");
    if (!ui.ceremony) armToast();
    return;
  }
  ui.toastQueue = fresh.filter((id) => id !== "clear" || after.phase !== "settle");
  if (!ui.ceremony) armToast();
}

function beginCeremony() {
  stopCeremony();
  ui.ceremony = !reducedMotion();
  if (!ui.ceremony) return;
  ceremonyTimer = setTimeout(() => {
    ceremonyTimer = null;
    ui.ceremony = false;
    armToast();
    render();
  }, 1600);
}

function beginFlourish() {
  stopFlourish();
  ui.flourish = !reducedMotion();
  if (!ui.flourish) return;
  flourishTimer = setTimeout(() => {
    flourishTimer = null;
    ui.flourish = false;
    render();
  }, 1600);
}

function apply(result) {
  if (!result.ok) {
    ui.error = result.error;
    render();
    return;
  }
  const before = ui.state;
  const released = Math.max(0, frozenTotal(ui.state) - frozenTotal(result.state));
  ui.state = result.state;
  ui.error = null;
  ui.thaw = released > 0 ? released : null;
  if (ui.state.phase !== "sell") {
    ui.sale = null;
    ui.similarOpen = false;
  }
  if (ui.state.phase !== "build") ui.build = null;
  if (ui.state.phase !== "sell") ui.lapse = false;
  ui.ceremony = false;
  stopCeremony();
  if (ui.state.phase === "settle" && celebrateClear(ui.state.project?.sale?.outcome)) beginCeremony();
  if (ui.state.phase === "summary") beginFlourish();
  else {
    ui.flourish = false;
    stopFlourish();
  }
  queueToasts(before, ui.state);
  persist();
  render();
}

function beginLapse() {
  stopLapse();
  ui.lapse = true;
  ui.ignoreClick = false;
  render();
  lapseTimer = setTimeout(() => {
    lapseTimer = null;
    endLapse();
  }, reducedMotion() ? 500 : 2200);
}

function endLapse() {
  stopLapse();
  ui.lapse = false;
  ui.ignoreClick = true;
  render();
  setTimeout(() => {
    ui.ignoreClick = false;
  }, 320);
}

function commitBuild() {
  ensureBuild();
  const result = chooseContractor(
    ui.catalog,
    ui.state,
    ui.build.contractor,
    ui.build.mix,
    ui.build.loan || "cash",
  );
  if (!result.ok) {
    ui.error = result.error;
    ui.teach = null;
    render();
    return;
  }
  ui.state = result.state;
  ui.error = null;
  ui.thaw = null;
  ui.build = null;
  ui.teach = null;
  ui.similarOpen = false;
  persist();
  beginLapse();
}

function ensureBuild() {
  if (ui.state?.phase !== "build") return;
  if (ui.build && ui.build.index === ui.state.project.index) return;
  ui.build = {
    index: ui.state.project.index,
    mix: { ...ui.state.project.offer.mixHint },
    contractor: null,
    loan: "cash",
  };
}

function ensureSale() {
  if (ui.state?.phase !== "sell") return;
  if (ui.sale && ui.sale.index === ui.state.project.index) return;
  ui.sale = {
    index: ui.state.project.index,
    choices: { showflat: false, cheer: 0, leftover: "cut", price: "fair", rebate: "none", adBudget: "none", adTarget: null },
    mode: "setup",
    started: 0,
    shownSold: 0,
    pops: [],
    reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  };
}

function currentQuote() {
  const quote = resolveSale(ui.catalog, ui.state, ui.sale.choices);
  quote.forecastPct = saleForecast(ui.catalog, ui.state, ui.sale.choices).pct;
  return quote;
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

function onboardingBanner() {
  if (!isOnboarding(ui.state)) return "";
  return `<section class="banner info onboarding-banner">
    <strong>${t(ui.lang, "onboardingTitle")}</strong>
    <span>${t(ui.lang, "onboardingBody")}</span>
    ${ui.state.phase === "build" ? `<button class="chip" type="button" data-action="suggested-build"><strong>${t(ui.lang, "onboardingSuggested")}</strong><small>${t(ui.lang, "onboardingSuggestedSub")}</small></button>` : ""}
  </section>`;
}

function onboardingLock() {
  return `<p class="fine onboarding-lock"><strong>${t(ui.lang, "locked")}</strong> · ${t(ui.lang, "onboardingLocked")}</p>`;
}

function shareSentence(stake) {
  const you = Math.round(Number(stake) * 100);
  const partner = 100 - you;
  return t(ui.lang, "jvLine", { you, partner });
}

function landCard(offer) {
  const broke = ui.state.cash < offer.landTotal;
  const pct = Math.round((offer.profitShare || 0) * 100);
  const deal = offer.type === "mtr"
    ? `${t(ui.lang, "mtrCut")} ${pct}%`
    : offer.type === "ura"
      ? `${t(ui.lang, "uraCut")} ${pct}%`
      : t(ui.lang, "typeGovNote");
  const venture = jvEligible(offer) ? ` · ${t(ui.lang, "partnerShare")}` : "";
  const priceName = offer.type === "ura" ? t(ui.lang, "upfrontCost") : t(ui.lang, "landCost");
  const rail = offer.type === "mtr" ? `<p class="deal rail">${t(ui.lang, "mtrRail")}</p>` : "";
  const body = `<div class="head"><h3>${t(ui.lang, "slot", { slot: offer.slot })} · ${t(ui.lang, typeKey(offer.type))}</h3>${stamp(offer.verdict)}</div>
    <p class="note">${escapeHtml(districtLabel(ui.lang, offer.district))} · ${t(ui.lang, flavourKey(offer.flavour))} · ${formatCount(offer.gfaFt2)} ${t(ui.lang, "ft")} · ${t(ui.lang, siteKey(offer.siteTier))}</p>
    <p class="fine plot-price">${priceName} ${formatHkd(offer.landPerFt2)}${t(ui.lang, "perFt")} · ${compactHkd(offer.landTotal)}</p>
    <p class="fine ledger-preview">${deal}${venture}</p>${rail}`;
  if (!jvEligible(offer)) {
    return `<button class="choice plot" data-action="buy" data-slot="${offer.slot}" data-stake="1" ${broke ? "disabled" : ""}>
      ${body}
      ${broke ? `<p class="fine">${t(ui.lang, "broke")}</p>` : ""}
    </button>`;
  }
  const cells = [
    [1, "jvFull"],
    [JV_SHARES[0], "jv25"],
    [JV_SHARES[1], "jv35"],
    [JV_SHARES[2], "jv50"],
  ].map(([stake, key]) => {
    const share = Math.round(offer.landTotal * stake);
    const short = ui.state.cash < share;
    return `<button data-action="buy" data-slot="${offer.slot}" data-stake="${stake}" ${short ? "disabled" : ""}>${t(ui.lang, key)}<small>${t(ui.lang, "youPay", { cash: compactHkd(share) })}</small></button>`;
  }).join("");
  return `<article class="choice plot venture">
    ${body}
    <div class="stake-grid">${cells}</div>
    <p class="fine jv-line" data-jv-line>${shareSentence(0.35)}</p>
  </article>`;
}

function landView() {
  const venture = (ui.state.offers || []).some((offer) => jvEligible(offer));
  return `${errorBanner()}${yellowBanner()}${tutorialBanner()}${onboardingBanner()}
    <p class="kicker">${t(ui.lang, "landKicker")}</p>
    ${venture ? `<p class="fine jv-disclaimer">${t(ui.lang, "jvDisclaimer")}</p>` : ""}
    <div class="land-grid">${ui.state.offers.map(landCard).join("")}</div>`;
}

function popWord(band) {
  if (band === "high") return t(ui.lang, "popHigh");
  if (band === "low") return t(ui.lang, "popLow");
  return t(ui.lang, "popMid");
}

function toneKey(tone) {
  if (tone === "hot") return "toneHot";
  if (tone === "steady") return "toneSteady";
  return "toneQuiet";
}

function salesBlock(sales) {
  const outlook = buildOutlook(ui.catalog, ui.state, ui.build.mix, ui.build.contractor, ui.build.loan || "cash");
  const tone = outlook.tone;
  const fill = tone === "hot" ? 100 : tone === "steady" ? 50 : 0;
  return `<div class="sales-band tone-${tone}" id="sales-band">
    <p class="sales-label">${t(ui.lang, "salesBand", { low: sales.low, high: sales.high })} ${t(ui.lang, toneKey(tone))}</p>
    <span class="tone-bar" aria-hidden="true"><i style="width:${fill}%"></i></span>
  </div>`;
}

function buildView() {
  ensureBuild();
  const onboarding = isOnboarding(ui.state);
  const offer = ui.state.project.offer;
  const gfa = offer.gfaFt2;
  const used = gfaUsed(ui.build.mix);
  const left = gfa - used;
  const heat = campaignHeat(ui.state, ui.catalog.balance);
  const popularity = unitPopularity(offer.flavour, heat, ui.catalog.balance);
  const pools = sizePools(ui.catalog, {
    gfaFt2: gfa,
    flavour: offer.flavour,
    heat,
    buyer: ui.state.market?.buyer || 1,
    bias: ui.state.poolBias || {},
    poolMul: poolMultipliers(ui.state),
  });
  const picked = ui.build.contractor ? contractorQuote(ui.catalog, ui.state, ui.build.contractor) : null;
  const costPsf = picked ? picked.buildPerFt2 : offer.estBuildPerFt2;
  const step = mixDelta(gfa);
  const rows = UNIT_SPECS.map((spec) => {
    const [nameKey, whoKey] = UNIT_KEYS[spec.id];
    const count = ui.build.mix[spec.id] || 0;
    const band = popularity[spec.id]?.band || "mid";
    const note = popularityNote(offer.flavour, heat, band);
    const canAdd = canAddUnit(gfa, ui.build.mix, spec.id);
    const stepLabel = step > 1 ? ` ±${formatCount(step)}` : "";
    const caption = unitRowNote([
      `${spec.ft2}${t(ui.lang, "ft")}`,
      t(ui.lang, whoKey),
      popWord(band),
      note,
    ]);
    return `<div class="mix-row">
      <span><b>${t(ui.lang, nameKey)}</b><small>${caption}</small></span>
      <span class="guests">${t(ui.lang, "guests", { n: formatCount(pools[spec.pool] || 0) })}</span>
      <span class="stepper">
        <button type="button" class="step" data-action="mix-step" data-unit="${spec.id}" data-delta="${-step}" ${count <= 0 ? "disabled" : ""} aria-label="−${stepLabel}">−</button>
        <strong id="count-${spec.id}">${formatCount(count)}</strong>
        ${step > 1 ? `<small class="step-size">${stepLabel}</small>` : ""}
        <button type="button" class="step" data-action="mix-step" data-unit="${spec.id}" data-delta="${step}" ${canAdd ? "" : "disabled"} aria-label="+${stepLabel}">+</button>
      </span>
    </div>`;
  }).join("");
  const presets = [
    ["studio", "presetStudio"],
    ["starter", "presetStarter"],
    ["upgrade", "presetUpgrade"],
    ["luxury", "presetLuxury"],
  ].map(([id, key]) => `<button class="chip" data-action="mix-preset" data-id="${id}">${t(ui.lang, key)}</button>`).join("");
  const loans = ["cash", "small", "big"].map((mode) => {
    const quote = funding(mode);
    const on = (ui.build.loan || "cash") === mode;
    const key = mode === "big" ? "creditBig" : mode === "small" ? "creditSmall" : "creditCash";
    const sub = quote.principal > 0
      ? t(ui.lang, "creditTerms", {
        principal: compactHkd(quote.principal),
        interest: compactHkd(quote.interest),
        due: compactHkd(quote.due),
      })
      : quote.ok
        ? t(ui.lang, "creditNone")
        : t(ui.lang, "creditShort", { gap: compactHkd(quote.shortfall) });
    return `<button class="chip${on ? " on" : ""}" data-action="loan" data-id="${mode}" aria-pressed="${on}"><strong>${t(ui.lang, key)}</strong><small>${sub}</small></button>`;
  }).join("");
  const selectedPlan = funding(ui.build.loan || "cash");
  const shortLine = selectedPlan.ok
    ? ""
    : `<p class="fine short-cash">${t(ui.lang, "creditShort", { gap: compactHkd(selectedPlan.shortfall) })} · ${t(ui.lang, "creditShortHint", {
      small: compactHkd(funding("small").principal),
      big: compactHkd(funding("big").principal),
    })}</p>`;
  const sales = buildSalesBand(ui.catalog, ui.state, ui.build.mix, ui.build.contractor);
  const outlook = buildOutlook(ui.catalog, ui.state, ui.build.mix, ui.build.contractor, ui.build.loan || "cash");
  const warn = outlook.warnBig ? `<p class="loan-warn">${t(ui.lang, "loanWarn")}</p>` : "";
  const cards = ["jingjin", "huimen", "xinjing"].map((id) => {
    const quote = contractorQuote(ui.catalog, ui.state, id);
    const spec = ui.catalog.balance.contractors[id];
    const on = ui.build.contractor === id;
    const risk = spec.collapse > 0
      ? `<p class="fine risk-preview">${t(ui.lang, "collapseRisk", { extra: compactHkd(remedyExtra(ui.catalog.balance, quote.cost, stakeOf(offer), "rush")) })}</p>`
      : "";
    return `<button class="choice contractor${on ? " on" : ""}" data-action="pick-contractor" data-id="${id}" aria-pressed="${on}">
      <div class="head"><h3>${t(ui.lang, id)}</h3><strong>${compactHkd(quote.playerCost)}</strong></div>
      ${riskMeters(id)}
      <p class="fine">${t(ui.lang, `${id}Note`)}</p>
      ${risk}
    </button>`;
  }).join("");
  const width = Math.max(0, Math.min(100, (used / gfa) * 100));
  const stake = stakeOf(offer);
  const stakeNote = stake < 1 ? `<p class="fine jv-line">${shareSentence(stake)}</p>` : "";
  return `${errorBanner()}${yellowBanner()}${tutorialBanner()}${onboardingBanner()}
    <section class="card build-card">
      <div class="title-row">
        ${projectTitle()}
        <span class="kicker">${t(ui.lang, "buildKicker")} · ${t(ui.lang, siteKey(offer.siteTier))}</span>
      </div>
      ${stakeNote}
      <div id="gfa-live" class="${left < 0 ? "over" : ""}">
        <span>${t(ui.lang, "gfa")} ${formatCount(gfa)}</span>
        <span class="psf" id="gfa-psf">${t(ui.lang, "costPsf", { n: formatHkd(costPsf) })}</span>
        <span>${t(ui.lang, "usedGfa")} <strong id="gfa-used">${formatCount(used)}</strong></span>
        <span>${t(ui.lang, "leftGfa")} <strong id="gfa-left">${formatCount(left)}</strong></span>
      </div>
      <div class="bar"><span id="gfa-bar" style="width:${width}%"></span></div>
      ${salesBlock(sales)}
      ${sales.weak ? `<p class="mismatch-line">${t(ui.lang, "mismatchTitle")}</p>` : ""}
      <div class="preset-line">
        <button type="button" class="reset-mix" data-action="reset-mix">${t(ui.lang, "resetMix")}</button>
        <div class="chips preset-row">${presets}</div>
      </div>
      <p id="over-line" class="fine bad-text"${left < 0 ? "" : " hidden"}>${t(ui.lang, "overGfa")}</p>
      <div class="mixes">${rows}</div>
      ${onboarding ? onboardingLock() : `<div class="credit-row"><span>${t(ui.lang, "creditKicker")}</span>${loans}</div>
      <p class="loan-compare">${t(ui.lang, "loanCompare", { interest: compactHkd(outlook.interest), profit: compactHkd(outlook.profit) })}</p>
      ${warn}
      ${shortLine}
      <p class="fine credit-note">${t(ui.lang, "loanDisclaimer")}</p>`}
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
  if (usedEl) usedEl.textContent = formatCount(used);
  const leftEl = document.querySelector("#gfa-left");
  if (leftEl) leftEl.textContent = formatCount(left);
  const bar = document.querySelector("#gfa-bar");
  if (bar) bar.style.width = `${Math.max(0, Math.min(100, (used / gfa) * 100))}%`;
  const over = document.querySelector("#over-line");
  if (over) over.hidden = left >= 0;
  for (const spec of UNIT_SPECS) {
    const count = document.querySelector(`#count-${spec.id}`);
    if (count) count.textContent = formatCount(ui.build.mix[spec.id] || 0);
  }
  const blocked = left < 0 || used <= 0 || !ui.build.contractor || !funding(ui.build.loan || "cash").ok;
  const go = document.querySelector("[data-action='confirm-build']");
  if (go) {
    go.disabled = blocked;
    go.classList.toggle("is-blocked", blocked);
  }
  const small = document.querySelector("#build-small");
  if (small) {
    small.textContent = buildHint(left);
    small.classList.toggle("quiet", !blocked);
  }
}

function poolLine(pools) {
  return POOL_KEYS.map(([key, label]) => `${t(ui.lang, label)} ${pools[key] ?? 0}`).join(" · ");
}

function mixLine(mix) {
  return UNIT_SPECS.map((spec) => `${t(ui.lang, UNIT_KEYS[spec.id][0])} ${mix[spec.id] || 0}`).join(" · ");
}

function presetWhyKey(flavour, heat) {
  const place = flavour === "uni" ? "Uni" : flavour === "core" ? "Core" : "Starter";
  const market = heat === "spicy" ? "Spicy" : "Loose";
  return `why${place}${market}`;
}

function projectTitle() {
  const name = ui.state?.project?.name || "";
  if (ui.renaming) {
    return `<label class="title-line editing">
      <input id="project-name" maxlength="12" value="${escapeHtml(name)}" aria-label="${escapeHtml(t(ui.lang, "projectName"))}">
    </label>`;
  }
  return `<button type="button" class="title-line" data-action="rename-edit">
    <span class="title-text">${escapeHtml(name)}</span>
    <span class="rename-tag">${t(ui.lang, "rename")}</span>
  </button>`;
}

function fact(label, value) {
  return `<div class="fact"><span>${label}</span><strong>${value}</strong></div>`;
}

function forecastBlock(forecast) {
  const sticky = forecast.sticky
    ? ` · ${t(ui.lang, "forecastSticky", { type: t(ui.lang, UNIT_KEYS[forecast.sticky][0]) })}`
    : "";
  return `<p class="forecast" data-forecast-pct="${forecast.pct}">${t(ui.lang, "forecastPct", { pct: forecast.pct })} · ${t(ui.lang, "forecastBefore")}${sticky}</p>`;
}

function unitBars(bars) {
  return `<div class="unit-bars">${UNIT_SPECS.map((spec) => {
    const row = bars?.[spec.id] || { offered: 0, sold: 0, unsold: 0, pct: 0 };
    const width = row.offered ? Math.max(0, Math.min(100, row.pct)) : 0;
    const stuck = row.offered > 0 && row.pct < 45;
    const meta = row.offered
      ? t(ui.lang, "barMeta", { n: formatCount(row.offered), sold: formatCount(row.sold), left: formatCount(row.unsold) })
      : t(ui.lang, "barEmpty");
    return `<div class="unit-bar${stuck ? " stuck" : ""}${row.offered ? "" : " none"}" data-bar="${spec.id}" data-sold="${row.sold}" data-offered="${row.offered}">
      <span>${t(ui.lang, UNIT_KEYS[spec.id][0])}</span>
      <div class="track"><span style="width:${width}%"></span></div>
      <small>${meta}</small>
    </div>`;
  }).join("")}</div>`;
}

function priceChips() {
  return ["cheap", "fair", "expensive"].map((id) => {
    const on = (ui.sale.choices.price || "fair") === id;
    const quote = resolveSale(ui.catalog, ui.state, { ...ui.sale.choices, price: id });
    const key = id === "cheap" ? "priceCheap" : id === "expensive" ? "priceExpensive" : "priceFair";
    const stance = id === "cheap" ? "stanceThin" : id === "expensive" ? "stanceFat" : "stanceBalance";
    return `<button class="chip price-chip${on ? " on" : ""}" data-action="price" data-id="${id}" aria-pressed="${on}">
      <strong>${t(ui.lang, key)}</strong>
      <small>${t(ui.lang, "salePsf", { n: formatHkd(quote.askPerFt2) })}</small>
      <small>${t(ui.lang, "twoBed")} ${compactHkd(quote.byType.two.ask)}</small>
      <em>${t(ui.lang, stance)}</em>
    </button>`;
  }).join("");
}

function promoRow() {
  const gfa = ui.state.project.offer.gfaFt2;
  const adTable = ui.catalog.balance.promo?.ad || { low: { perFt2: 0 }, high: { perFt2: 0 } };
  const rebates = ["none", "std", "high"].map((id) => {
    const on = (ui.sale.choices.rebate || "none") === id;
    const quote = resolveSale(ui.catalog, ui.state, { ...ui.sale.choices, rebate: id });
    const key = id === "high" ? "rebateHigh" : id === "std" ? "rebateStd" : "rebateNone";
    return `<button class="chip${on ? " on" : ""}" data-action="rebate" data-id="${id}" aria-pressed="${on}"><strong>${t(ui.lang, key)}</strong><small>${compactHkd(quote.rebateCost)}</small></button>`;
  }).join("");
  const targets = [["rent", "adRent"], ["starter", "adStarter"], ["upgrade", "adUpgrade"], ["feature", "adFeature"]].map(([id, key]) => {
    const on = ui.sale.choices.adTarget === id && ui.sale.choices.adBudget !== "none";
    return `<button class="chip${on ? " on" : ""}" data-action="ad-target" data-id="${id}" aria-pressed="${on}">${t(ui.lang, key)}</button>`;
  }).join("");
  const budgets = [["none", "adNone", 0], ["low", "adLow", adTable.low.perFt2], ["high", "adHigh", adTable.high.perFt2]].map(([id, key, per]) => {
    const on = (ui.sale.choices.adBudget || "none") === id;
    const cost = id === "none" ? 0 : Math.round(per * gfa);
    return `<button class="chip${on ? " on" : ""}" data-action="ad-budget" data-id="${id}" aria-pressed="${on}"><strong>${t(ui.lang, key)}</strong><small>${compactHkd(cost)}</small></button>`;
  }).join("");
  return `<div class="promo">
    <div class="promo-line"><span>${t(ui.lang, "rebate")}</span>${rebates}</div>
    <div class="promo-line"><span>${t(ui.lang, "ad")}</span>${targets}${budgets}</div>
    <p class="fine">${t(ui.lang, "promoNote")}</p>
  </div>`;
}

function collapseBanner() {
  const contractor = ui.state.project?.contractor;
  if (!contractor?.collapsed) return "";
  const extra = Math.max(0, contractor.total - contractor.cost);
  return `<div class="banner bad">${t(ui.lang, "collapsedBanner", { extra: compactHkd(extra) })} · ${t(ui.lang, "collapseCompare", { quote: compactHkd(contractor.cost), remedy: compactHkd(contractor.total) })}</div>`;
}

function signed(value) {
  const number = Math.round(value);
  return number > 0 ? `+${number}` : String(number);
}

function leftoverButton(id, quote, live) {
  const on = ui.sale.choices.leftover === id;
  const label = t(ui.lang, id === "hold" ? "leftoverHold" : "leftoverCut");
  let sub = t(ui.lang, "leftoverClear");
  if (live.unsold > 0) {
    const rep = id === "hold" ? ui.catalog.balance.repHold : ui.catalog.balance.repCut;
    const cash = id === "hold" ? quote.frozenAmount : quote.fireNet;
    const key = id === "hold" ? "leftoverHoldSub" : "leftoverCutSub";
    sub = t(ui.lang, key, { rep: signed(rep), cash: compactHkd(cash) });
  }
  return `<button class="chip toggle${on ? " on" : ""}" data-action="leftover" data-id="${id}" aria-pressed="${on}"><strong>${label}</strong><small>${sub}</small></button>`;
}

function cheerNote(left) {
  return left > 0 ? t(ui.lang, "cheerLeft", { n: left }) : t(ui.lang, "cheerDone");
}

function liveComment() {
  const state = ui.state;
  if (!state) return null;
  if (state.phase === "sell" && state.project?.contractor && !state.project.skipped) {
    ensureSale();
    return commentForPhase("sell", { ...state.project, sale: currentQuote() }, state.voice);
  }
  if (state.phase === "settle" && state.project?.sale && !state.project.skipped) {
    return commentForPhase("settle", state.project, state.voice);
  }
  return commentForPhase(state.phase, null, state.voice);
}

function similarPeek() {
  const item = similarProject(ui.state);
  if (!item) return `<p class="similar">${t(ui.lang, "similarPeek")} · ${t(ui.lang, "similarEmpty")}</p>`;
  const price = priceWord(item.price) || "—";
  const psf = item.askPerFt2 ? `${formatHkd(item.askPerFt2)}${t(ui.lang, "perFt")}` : "";
  const title = item.name || districtLabel(ui.lang, item.district);
  return `<p class="similar">${t(ui.lang, "similarPeek")} · ${escapeHtml(title)} · ${price} ${psf} · ${outcomeShort(item.outcome) || "—"} ${formatCount(item.sold)}/${formatCount(item.units)}</p>`;
}

function salePnl(choices) {
  const ledger = saleLedger(ui.catalog, ui.state, choices);
  return `<p class="pnl">${t(ui.lang, "buildCost")} ${compactHkd(ledger.build)} · ${t(ui.lang, "promoBill")} ${compactHkd(ledger.promo)} · ${t(ui.lang, "expectMultiple", { n: ledger.multiple.toFixed(2) })}</p>`;
}

function cheerExtraLine(choices) {
  if (!choices || (choices.cheer || 0) <= 0) return "";
  const now = saleLedger(ui.catalog, ui.state, choices);
  const before = saleLedger(ui.catalog, ui.state, { ...choices, cheer: 0 });
  const extra = now.profit - before.profit;
  const sign = extra > 0 ? "+" : "";
  return `<p class="pnl cheer-extra">${t(ui.lang, "cheerExtra", { cash: `${sign}${compactHkd(extra)}` })}</p>`;
}

function bridgeBanner() {
  const unpaid = ui.state?.project?.contractor?.unpaid || 0;
  if (unpaid <= 0) return "";
  return `<div class="banner warn">${t(ui.lang, "unpaidBridge", { cash: compactHkd(unpaid) })}</div>`;
}

function sellSetup() {
  const offer = ui.state.project.offer;
  const onboarding = isOnboarding(ui.state);
  const quote = currentQuote();
  const forecast = saleForecast(ui.catalog, ui.state, ui.sale.choices);
  const cut = resolveSale(ui.catalog, ui.state, { ...ui.sale.choices, leftover: "cut" });
  const hold = resolveSale(ui.catalog, ui.state, { ...ui.sale.choices, leftover: "hold" });
  const heat = quote.marketHeat;
  const showOn = ui.sale.choices.showflat;
  return `${tutorialBanner()}${yellowBanner()}${onboardingBanner()}${bridgeBanner()}${collapseBanner()}
    <section class="card sell-setup showroom">
      <div class="title-row">
        <span class="kicker">${t(ui.lang, "showroom")}</span>
        ${projectTitle()}
      </div>
      <p class="note">${escapeHtml(districtLabel(ui.lang, offer.district))} · ${t(ui.lang, flavourKey(offer.flavour))} · ${t(ui.lang, siteKey(offer.siteTier))}</p>
      <div class="chips price-chips">${priceChips()}</div>
      ${forecastBlock(forecast)}
      ${towerRow(offer.units || quote.units, 0, { empty: true })}
      ${salePnl(ui.sale.choices)}
      ${similarPeek()}
      ${onboarding ? "" : promoRow()}
      ${unitBars(forecast.bars)}
      <p class="bowl ${quote.bowl.ok ? "ok" : "bad"}">${t(ui.lang, "bowl")} ${quote.bowl.ok ? t(ui.lang, "bowlOk") : t(ui.lang, "bowlCrack")} · ${t(ui.lang, "twoBed")} ${compactHkd(quote.bowl.lump)}</p>
      ${onboarding ? onboardingLock() : `<button class="chip toggle${showOn ? " on" : ""}" data-action="showflat" aria-pressed="${showOn}">
        <strong>${t(ui.lang, "showflat")}${showOn ? ` · ${t(ui.lang, "picked")}` : ""}</strong>
        <small>${compactHkd(ui.catalog.balance.showflatPerFt2 * offer.gfaFt2)}</small>
      </button>
      <div class="pair">
        ${leftoverButton("cut", cut, quote)}
        ${leftoverButton("hold", hold, quote)}
      </div>`}
      <p class="fine heat-hint">${heat === "loose" ? t(ui.lang, "looseHint") : t(ui.lang, "spicyHint")}</p>
    </section>`;
}

function outcomeLine(quote) {
  const pair = {
    clear: t(ui.lang, "outcomeClear"),
    almost: t(ui.lang, "outcomeAlmost"),
    partial: t(ui.lang, "outcomePartial"),
    fail: t(ui.lang, "outcomeFail"),
  }[quote.outcome] || t(ui.lang, "outcomeFail");
  const cls = quote.outcome === "clear" ? "ok" : quote.outcome === "fail" ? "bad" : "mid";
  return `<div class="outcome ${cls}">${pair}</div>`;
}

function gapLine(quote) {
  const gap = explainForecastGap(quote?.forecastPct, quote);
  if (!gap) return "";
  const key = gap.reasons.includes("cheer") && gap.reasons.includes("cake")
    ? "gapCheerCake"
    : gap.reasons.includes("cake")
      ? "gapCake"
      : gap.reasons.includes("cheer")
        ? "gapCheer"
        : "gapLow";
  return `<p class="fine gap-line">${t(ui.lang, key)} ${t(ui.lang, "forecastPct", { pct: gap.forecast })} → ${gap.actual}%</p>`;
}

function barsFromQuote(quote) {
  const bars = {};
  for (const spec of UNIT_SPECS) {
    const row = quote.byType[spec.id];
    const offered = row?.offered || 0;
    const sold = row?.sold || 0;
    bars[spec.id] = {
      offered,
      sold,
      unsold: row?.unsold || 0,
      pct: offered ? Math.round((sold / offered) * 100) : 0,
    };
  }
  return bars;
}

function towerRow(units, sold, { empty = false, gold = false } = {}) {
  if (empty) {
    const count = Math.max(2, towerShares(units || 0, 0).length);
    return `<div class="towers towers-empty" data-towers>${Array.from({ length: count }, (_, index) => `<button type="button" class="tower empty" data-action="floor" data-index="${index}"><i></i><b>—</b><small>${t(ui.lang, "planEmpty")}</small></button>`).join("")}</div>`;
  }
  const rows = towerShares(units, sold);
  return `<div class="towers${gold ? " towers-gold" : ""}" data-towers>${rows.map((row) => {
    const word = towerWord(row.pct);
    const key = word === "clear" ? "outcomeClear" : word === "hot" ? "toneHot" : word === "steady" ? "toneSteady" : "toneQuiet";
    const tone = word === "clear" ? "gold" : word;
    return `<button type="button" class="tower ${tone}" data-action="floor" data-index="${row.index}"><i></i><b data-tower-pct="${row.index}">${row.pct}%</b><small data-tower-word="${row.index}">${t(ui.lang, key)}</small></button>`;
  }).join("")}</div>`;
}

function fillMarks(quote, shown) {
  return towerRow(quote.units, shown, { gold: quote.outcome === "clear" && shown >= quote.units && quote.units > 0 });
}

function sellLive() {
  const quote = currentQuote();
  const showOutcome = ui.sale.mode === "done";
  const shown = showOutcome ? quote.sold : ui.sale.shownSold;
  const heat = showOutcome ? quote.heat : Math.round(quote.heat * 0.15);
  return `<section class="card sale-stage showroom">
      <p class="kicker">${t(ui.lang, "showroom")} · ${escapeHtml(ui.state.project.name || "")}</p>
      <div class="heat" aria-hidden="true"><span id="heat-fill" style="width:${heat}%"></span></div>
      <div class="sale-nums">
        <div><span>${t(ui.lang, "heat")}</span><strong id="heat-num">${heat}</strong></div>
        <div><span>${t(ui.lang, "soldNow")}</span><strong id="sold-num">${formatCount(shown)}</strong></div>
        <div><span>${t(ui.lang, "unitsLeft")}</span><strong id="left-num">${formatCount(Math.max(0, quote.units - shown))}</strong></div>
      </div>
      ${fillMarks(quote, shown)}
      <div class="pops" id="pops"></div>
      <p class="fine" id="cake-line">${quote.cakeSweep > 0 && shown > 0 ? t(ui.lang, "cakeLine", { n: quote.cakeSweep }) : ""}</p>
      <p class="fine">${t(ui.lang, "floorCash")} <strong id="tally">${compactHkd(shown && quote.sold ? Math.round((quote.gross * shown) / quote.sold) : 0)}</strong></p>
      ${cheerExtraLine(ui.sale.choices)}
      ${showOutcome ? `${outcomeLine(quote)}${gapLine(quote)}${unitBars(barsFromQuote(quote))}` : `<p class="kicker">${t(ui.lang, "selling", { n: Math.max(0, ui.catalog.balance.cheerMax - ui.sale.choices.cheer) })}</p>`}
    </section>`;
}

function sellView() {
  ensureSale();
  if (ui.sale.mode === "setup") return `${errorBanner()}${sellSetup()}`;
  return sellLive();
}

function revealNow(quote) {
  return saleReveal(quote.sold, ui.sale.choices.cheer, ui.catalog.balance.cheerMax);
}

function launchSale() {
  ui.sale.mode = "live";
  ui.sale.started = performance.now();
  ui.sale.shownSold = 0;
  ui.sale.pops = [];
  const quote = currentQuote();
  if (ui.sale.reduced) {
    ui.sale.shownSold = revealNow(quote).shown;
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
    const live = currentQuote();
    const reveal = revealNow(live);
    const tProgress = Math.min(1, (performance.now() - ui.sale.started) / 7000);
    const target = Math.min(reveal.shown, Math.round(reveal.shown * Math.min(1, 0.25 + 0.75 * tProgress)));
    if (target > ui.sale.shownSold) {
      ui.sale.pops.unshift({ text: `+${target - ui.sale.shownSold}` });
      ui.sale.pops = ui.sale.pops.slice(0, 3);
      ui.sale.shownSold = target;
    }
    if (reveal.done) {
      ui.sale.shownSold = live.sold;
      ui.sale.mode = "done";
      stopSaleTimer();
      render();
      return;
    }
    paintSale(live, tProgress);
  }, 160);
}

function paintSale(quote, tProgress) {
  const shownHeat = Math.round(quote.heat * (0.2 + 0.8 * tProgress));
  const heat = document.querySelector("#heat-fill");
  if (heat) heat.style.width = `${Math.min(100, shownHeat)}%`;
  const heatNum = document.querySelector("#heat-num");
  if (heatNum) heatNum.textContent = String(Math.min(100, shownHeat));
  const sold = document.querySelector("#sold-num");
  if (sold) sold.textContent = formatCount(ui.sale.shownSold);
  const left = document.querySelector("#left-num");
  if (left) left.textContent = formatCount(Math.max(0, quote.units - ui.sale.shownSold));
  const tally = document.querySelector("#tally");
  if (tally) {
    const cash = quote.sold ? Math.round((quote.gross * ui.sale.shownSold) / quote.sold) : 0;
    tally.textContent = compactHkd(cash);
  }
  const pops = document.querySelector("#pops");
  if (pops) pops.innerHTML = ui.sale.pops.map((pop) => `<span class="pop">${escapeHtml(pop.text)}</span>`).join("");
  const towers = document.querySelector("[data-towers]");
  if (towers) {
    const rows = towerShares(quote.units, ui.sale.shownSold);
    rows.forEach((row) => {
      const pct = towers.querySelector(`[data-tower-pct="${row.index}"]`);
      const word = towers.querySelector(`[data-tower-word="${row.index}"]`);
      const button = word?.closest(".tower");
      const tone = towerWord(row.pct);
      const key = tone === "clear" ? "outcomeClear" : tone === "hot" ? "toneHot" : tone === "steady" ? "toneSteady" : "toneQuiet";
      if (pct) pct.textContent = `${row.pct}%`;
      if (word) word.textContent = t(ui.lang, key);
      if (button) button.className = `tower ${tone === "clear" ? "gold" : tone}`;
    });
  }
  const cheerLeftText = cheerNote(ui.catalog.balance.cheerMax - ui.sale.choices.cheer);
  for (const note of document.querySelectorAll("[data-action='cheer'] small")) note.textContent = cheerLeftText;
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
  const preview = settlementPreview(ui.catalog, ui.state);
  const cls = sale.profit >= 0 ? "ok" : "bad";
  const sign = sale.profit >= 0 ? "+" : "";
  const owed = preview.owed > 0 ? `<p class="mismatch-line owed-line">${t(ui.lang, "stillOwed", { owed: compactHkd(preview.owed) })}</p>` : "";
  const loanLine = project.loan?.principal > 0
    ? row(t(ui.lang, "loanRow"), t(ui.lang, "creditTerms", {
      principal: compactHkd(project.loan.principal),
      interest: compactHkd(project.loan.interest),
      due: compactHkd(project.loan.due),
    }))
    : "";
  const party = celebrateClear(sale.outcome);
  const motion = party && ui.ceremony && !reducedMotion();
  const confetti = motion
    ? `<div class="confetti" aria-hidden="true">${Array.from({ length: 10 }, () => "<i></i>").join("")}</div>`
    : "";
  const stampClear = party ? `<p class="clear-stamp${motion ? "" : " is-static"}">${t(ui.lang, "outcomeClear")}</p>` : "";
  const landKey = project.offer.type === "ura" ? "upfrontCost" : "landCost";
  const cut = project.offer.type === "ura" ? "uraCut" : project.offer.type === "mtr" ? "mtrCut" : "";
  const pct = Math.round((sale.profitShare || 0) * 100);
  const shareLine = cut && sale.partnerShare > 0
    ? row(`${t(ui.lang, cut)} ${pct}%`, formatHkd(sale.partnerShare))
    : project.offer.type === "gov"
      ? row(t(ui.lang, "mtrCut"), t(ui.lang, "noShareLine"))
      : "";
  const stake = stakeOf(project.offer);
  const youLine = stake < 1 ? row(t(ui.lang, "partnerShare"), t(ui.lang, "ledgerYou", { pct: Math.round(stake * 100) })) : "";
  const promo = (sale.promoFull || 0) > 0 ? row(t(ui.lang, "promoBill"), formatHkd(sale.promoFull)) : "";
  const revenue = sale.revenue || sale.gross || 0;
  const { ledger, cashFlow } = settlementGroups({
    t, row, formatHkd, compactHkd, lang: ui.lang, revenue,
    landLabel: t(ui.lang, landKey), landCost: sale.landFull || project.offer.landTotal,
    buildCost: sale.buildFull || project.contractor.total, promo, shareLine, youLine,
    profit: sale.profit, profitClass: cls, profitSign: sign,
    currentCash: ui.state.cash || 0, settledCash: preview.cash, owed: preview.owed, bankPaid: preview.paid,
  });
  return `${bridgeBanner()}<section class="card${party ? " clear-card" : ""}" data-action="skip-ceremony"><h2>${t(ui.lang, "settleKicker")}</h2>
    ${stampClear}
    ${confetti}
    ${towerRow(sale.units, sale.sold, { gold: party })}
    ${outcomeLine(sale)}
    ${row(t(ui.lang, "repChange"), `${sale.reputationDelta >= 0 ? "+" : ""}${sale.reputationDelta}`)}
    ${sale.clearBonus ? row(t(ui.lang, "clearBonus"), `+${formatHkd(sale.clearBonus)}`) : ""}
    <p class="fine">${escapeHtml(districtLabel(ui.lang, project.offer.district))} · ${t(ui.lang, flavourKey(project.offer.flavour))} · ${t(ui.lang, typeKey(project.offer.type))}</p>
    ${project.offer.type === "gov" ? `<p class="deal">${t(ui.lang, "govSettle")}</p>` : ""}
    ${ledger}
    ${sale.frozenAmount ? `<p class="fine">${t(ui.lang, "frozenLine", { cash: formatHkd(sale.frozenAmount) })}</p>` : ""}
    ${gapLine(sale)}
    ${mismatchEcho(project) ? `<p class="mismatch-line">${t(ui.lang, "mismatchTitle")}</p>` : ""}
    ${project.contractor.collapsed ? `${row(t(ui.lang, "quoteCost"), formatHkd(project.contractor.cost))}${row(t(ui.lang, "remedyExtra"), formatHkd(project.contractor.extra || (project.contractor.total - project.contractor.cost)))}` : ""}
    ${loanLine}
    ${liveComment() ? `<p class="rep-line">${escapeHtml(t(ui.lang, liveComment()))}</p>` : ""}
    ${row(t(ui.lang, "soldNow"), `${sale.sold} / ${sale.units}`)}
    ${cashFlow}
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
  if (ui.lang === "en" && choice.costEn) return choice.costEn;
  if (choice.cost) return choice.cost;
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

function titleKey(id) {
  return {
    megaChair: "titleMegaChair",
    mega: "titleMega",
    comeback: "titleComeback",
    clear: "titleClear",
    flagship: "titleFlagship",
    chair: "titleChair",
  }[id] || "";
}

function achievementKey(id) {
  return { clear: "achClear", mega: "achMega", flagship: "achFlagship", comeback: "achComeback", finished: "achDone" }[id] || "";
}

function skylineMarkup(history, { boarded = false } = {}) {
  if (boarded) {
    return `<div class="skyline boarded" aria-hidden="true">${[34, 52, 70, 44].map((height) => `<i style="height:${height}px"></i>`).join("")}</div>`;
  }
  const groups = { small: 0, mid: 0, large: 0, flagship: 0, mega: 0 };
  for (const item of history || []) {
    if (!item || item.skipped) continue;
    if ((item.units || 0) >= 10000) groups.mega += 1;
    else groups[item.siteTier || "small"] += 1;
  }
  const specs = [["small", 28], ["mid", 40], ["large", 56], ["flagship", 72], ["mega", 88]];
  const towers = specs.filter(([id]) => groups[id] > 0).map(([id, height]) => `<i class="sky ${id}" style="height:${height}px"><b>${groups[id]}</b></i>`);
  const body = towers.length ? towers.join("") : `<i class="sky small" style="height:36px"></i>`;
  return `<div class="skyline" aria-hidden="true">${body}</div>`;
}

function summaryView() {
  const summary = endSummary(ui.state);
  const company = ui.state.company;
  const titleId = victoryTitle(ui.state, ui.catalog.balance);
  const seal = titleId ? `<p class="title-seal${ui.flourish ? " live" : ""}">${t(ui.lang, titleKey(titleId))}</p>` : "";
  const chips = [];
  if ((summary.history || []).some((item) => item.outcome === "clear")) chips.push(t(ui.lang, "achClear"));
  if ((summary.history || []).some((item) => !item.skipped && (item.units || 0) >= 10000)) chips.push(t(ui.lang, "achMega"));
  if (ui.state.credit?.hadYellow) chips.push(t(ui.lang, "achComeback"));
  const chipRow = chips.length ? `<div class="chips highlight-chips">${chips.slice(0, 3).map((chip) => `<span class="chip on">${escapeHtml(chip)}</span>`).join("")}</div>` : "";
  const seals = unlockedAchievements(ui.state, ui.catalog.balance);
  const sealRow = seals.length
    ? `<div class="seal-row">${seals.map((id) => `<span class="mini-seal">${t(ui.lang, achievementKey(id))}</span>`).join("")}</div>`
    : "";
  const startCash = ui.catalog.balance.startingCash;
  const startRep = ui.catalog.balance.startingReputation;
  return `<section class="card ending-card${ui.flourish ? " flourish" : ""}" data-action="skip-flourish">
    <div class="ending-brand">${logoSvg(company.logo, company.color, company.name)}<h2>${escapeHtml(company.name)}</h2></div>
    ${skylineMarkup(summary.history)}
    <p class="story-line">${escapeHtml(closingLine(ui.state, ui.catalog.balance))}</p>
    ${chipRow}
    ${seal}
    <div class="compare">
      <div><span>${t(ui.lang, "compareStart")}</span><strong>${compactHkd(startCash)}</strong><small>${t(ui.lang, "reputation")} ${startRep}</small></div>
      <div><span>${t(ui.lang, "compareEnd")}</span><strong>${compactHkd(summary.cash)}</strong><small>${t(ui.lang, "reputation")} ${summary.reputation}</small></div>
    </div>
    ${sealRow}
    <div class="record-links">
      <button type="button" class="ghost" data-action="history">${t(ui.lang, "records")}</button>
      <button type="button" class="ghost" data-action="locked">${t(ui.lang, "locked")}</button>
    </div>
  </section>`;
}

function lapseView() {
  const name = ui.state?.project?.name || "";
  return `<section class="card lapse-card">
    <p class="kicker">${t(ui.lang, "lapseKicker")}</p>
    <div class="lapse-site" aria-hidden="true"><i></i><i></i><i></i></div>
    <p class="story-line">${escapeHtml(t(ui.lang, "lapseBody", { name }))}</p>
  </section>`;
}

function remedyView() {
  const contractor = ui.state.project.contractor;
  const rush = priceRemedy(ui.catalog.balance, { ...contractor, collapsed: true, remedy: "rush" });
  const worse = priceRemedy(ui.catalog.balance, { ...contractor, collapsed: true, remedy: "worse" });
  const extra = Math.max(0, rush.total - contractor.cost);
  return `${yellowBanner()}${bridgeBanner()}
    <section class="card remedy-card">
      <p class="kicker">${t(ui.lang, "remedyKicker")}</p>
      <p class="story-line">${t(ui.lang, "remedyLead", { extra: compactHkd(extra) })}</p>
      <p class="fine">${t(ui.lang, "collapseCompare", { quote: compactHkd(contractor.cost), remedy: compactHkd(rush.total) })}</p>
      <p class="fine">${t(ui.lang, "remedyRush")} ${compactHkd(rush.total)} · ${t(ui.lang, "remedyWorse")} ${compactHkd(worse.total)}</p>
    </section>`;
}

function mismatchView() {
  const types = (ui.teach || []).map((gap) => t(ui.lang, UNIT_KEYS[gap.unit][0])).join("、");
  return `<section class="card mismatch-card">
    <p class="kicker">${t(ui.lang, "buildKicker")}</p>
    <h3>${t(ui.lang, "mismatchTitle")}</h3>
    <p class="story-line">${t(ui.lang, "mismatchBody", { types: types || "—" })}</p>
  </section>`;
}

function gameOverView() {
  const owed = ui.state.credit?.owed || 0;
  const company = ui.state.company;
  return `<section class="card ending-card muted">
    <div class="ending-brand">${logoSvg(company.logo, company.color, company.name)}<h2>${escapeHtml(company.name)}</h2></div>
    ${skylineMarkup(ui.state.history, { boarded: true })}
    <h3>${t(ui.lang, "gameOverTitle")}</h3>
    <p class="story-line">${t(ui.lang, "gameOverBody", { owed: compactHkd(owed) })}</p>
    <div class="compare">
      <div><span>${t(ui.lang, "cash")}</span><strong>${compactHkd(ui.state.cash)}</strong></div>
      <div><span>${t(ui.lang, "reputation")}</span><strong>${ui.state.reputation}</strong></div>
    </div>
    <p class="fine">${t(ui.lang, "gameOverNote")}</p>
  </section>`;
}

function mainView() {
  if (!ui.state) return companyView();
  if (ui.lapse) return lapseView();
  if (ui.teach) return mismatchView();
  if (needsRemedy()) return remedyView();
  if (ui.state.phase === "land") return landView();
  if (ui.state.phase === "build") return buildView();
  if (ui.state.phase === "sell") return sellView();
  if (ui.state.phase === "settle") return settleView();
  if (ui.state.phase === "story") return storyView();
  if (ui.state.phase === "gameover") return gameOverView();
  return summaryView();
}

function identityFields() {
  const names = NAMES.map((name) => `<button type="button" class="chip${ui.draft.name === name ? " on" : ""}" data-action="preset-name" data-name="${escapeHtml(name)}">${escapeHtml(name)}</button>`).join("");
  const avatars = CHAIR_AVATARS.map((id) => `<button type="button" class="avatar-pick${ui.draft.avatar === id ? " on" : ""}" data-action="avatar" data-id="${id}" aria-pressed="${ui.draft.avatar === id}" aria-label="${id}">${avatarSvg(id, ui.draft.color)}</button>`).join("");
  const logos = COMPANY_LOGOS.map((id) => `<button type="button" class="chip logo-pick${ui.draft.logo === id ? " on" : ""}" data-action="logo" data-id="${id}" aria-pressed="${ui.draft.logo === id}">${logoSvg(id, ui.draft.color, ui.draft.name)}</button>`).join("");
  const colors = COMPANY_COLORS.map((color) => `<button type="button" class="swatch${ui.draft.color === color ? " on" : ""}" style="background:${color}" data-action="color" data-color="${color}" aria-label="${color}"></button>`).join("");
  return `<label class="field-label">${t(ui.lang, "chairName")}
      <input id="chair-name" class="name-field" maxlength="10" value="${escapeHtml(ui.draft.chairName || "主席")}" aria-label="${escapeHtml(t(ui.lang, "chairName"))}">
    </label>
    <div class="avatar-row">${avatars}</div>
    <label class="field-label">${t(ui.lang, "companyName")}
      <input id="company-name" class="name-field" maxlength="16" value="${escapeHtml(ui.draft.name)}" aria-label="${escapeHtml(t(ui.lang, "companyName"))}">
    </label>
    <div class="names">${names}</div>
    <div class="chips">${logos}</div>
    <div class="swatches">${colors}</div>`;
}

function companyView() {
  return `<section class="card company-card">
      <div class="hoarding" style="--brand:${ui.draft.color}">
        ${skylineMarkup([], { boarded: true })}
        <div class="hoarding-sign">${logoSvg(ui.draft.logo, ui.draft.color, ui.draft.name)}<strong>${escapeHtml(ui.draft.name || t(ui.lang, "gameTitle"))}</strong></div>
      </div>
      <h1 class="game-title">${t(ui.lang, "gameTitle")}</h1>
      <p class="game-sub">${t(ui.lang, "gameSub")}</p>
      <p class="note">${t(ui.lang, "disclaimer")}</p>
      <p class="fine">${t(ui.lang, "companyLead")}</p>
      ${identityFields()}
    </section>`;
}

function buildHint(left) {
  if (left < 0) return t(ui.lang, "overGfa");
  if (!ui.build?.contractor) return t(ui.lang, "pickContractor");
  const plan = funding(ui.build.loan || "cash");
  if (!plan.ok) return t(ui.lang, "creditShort", { gap: compactHkd(plan.shortfall) });
  return `${t(ui.lang, "leftGfa")} ${left.toLocaleString("en-US")} ${t(ui.lang, "ft")}`;
}

function dock() {
  if (ui.menu) return "";
  if (!ui.state) return `<footer class="dock"><button class="go" data-action="found">${t(ui.lang, "found")}</button></footer>`;
  if (ui.lapse) return `<footer class="dock"><button class="go" data-action="skip-lapse">${t(ui.lang, "lapseSkip")}</button></footer>`;
  if (ui.teach) {
    return `<footer class="dock cols-2"><button data-action="mismatch-edit">${t(ui.lang, "mismatchEdit")}</button><button class="go" data-action="mismatch-keep">${t(ui.lang, "mismatchKeep")}</button></footer>`;
  }
  if (needsRemedy()) {
    const contractor = ui.state.project.contractor;
    const rush = priceRemedy(ui.catalog.balance, { ...contractor, collapsed: true, remedy: "rush" });
    const worse = priceRemedy(ui.catalog.balance, { ...contractor, collapsed: true, remedy: "worse" });
    return `<footer class="dock cols-2">
      <button data-action="remedy" data-id="rush">${t(ui.lang, "remedyRush")}<small>${t(ui.lang, "remedyRushSub", { extra: compactHkd(rush.total - contractor.cost) })}</small></button>
      <button data-action="remedy" data-id="worse">${t(ui.lang, "remedyWorse")}<small>${t(ui.lang, "remedyWorseSub", { extra: compactHkd(worse.total - contractor.cost) })}</small></button>
    </footer>`;
  }
  const phase = ui.state.phase;
  if (phase === "land") {
    return `<footer class="dock"><button class="wide" data-action="skip">${t(ui.lang, "skip")}<small>${t(ui.lang, "skipSub")}</small></button></footer>`;
  }
  if (phase === "build") {
    ensureBuild();
    const used = gfaUsed(ui.build.mix);
    const left = ui.state.project.offer.gfaFt2 - used;
    const blocked = left < 0 || used <= 0 || !ui.build.contractor || !funding(ui.build.loan || "cash").ok;
    return `<footer class="dock"><button class="go${blocked ? " is-blocked" : ""}" data-action="confirm-build" ${blocked ? "disabled" : ""}>${t(ui.lang, "confirmBuild")}<small id="build-small">${buildHint(left)}</small></button></footer>`;
  }
  if (phase === "sell") {
    ensureSale();
    if (ui.sale.mode === "setup") return `<footer class="dock"><button class="go" data-action="launch-sale">${t(ui.lang, "openSale")}</button></footer>`;
    const left = ui.catalog.balance.cheerMax - ui.sale.choices.cheer;
    const cheer = `<button class="go" data-action="cheer" ${left <= 0 ? "disabled" : ""}>${t(ui.lang, "cheer")}<small>${cheerNote(left)}</small></button>`;
    const settle = `<button class="go" data-action="commit-sale">${t(ui.lang, "toSettle")}</button>`;
    if (ui.sale.mode === "done") return `<footer class="dock cols-2">${cheer}${settle}</footer>`;
    return `<footer class="dock">${cheer}</footer>`;
  }
  if (phase === "settle") return `<footer class="dock"><button class="go" data-action="confirm-settle">${t(ui.lang, "nextStep")}</button></footer>`;
  if (phase === "story") {
    const buttons = ui.state.story.choices.map((choice) => `<button data-action="story" data-id="${choice.id}">${escapeHtml(choice.tc)}<small>${escapeHtml(effectLine(choice) || choice.en)}</small></button>`).join("");
    const cols = ui.state.story.choices.length > 1 ? "cols-2" : "";
    return `<footer class="dock ${cols}">${buttons}</footer>`;
  }
  if (phase === "gameover") return `<footer class="dock"><button class="go" data-action="new-game">${t(ui.lang, "again")}</button></footer>`;
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
  const heatNote = heat === "loose" ? t(ui.lang, "heatLooseNote") : heat === "spicy" ? t(ui.lang, "heatSpicyNote") : "";
  const heatLeft = ui.state ? t(ui.lang, "heatLeft", { n: heatProjectsLeft(ui.state, ui.catalog.balance) }) : "";
  const heatSmall = heatNote ? `${heatNote}${heatLeft ? ` · ${heatLeft}` : ""}` : heatLeft;
  const policy = ui.state ? policyNotes(ui.state) : [];
  const comment = ui.state ? liveComment() : null;
  const frozen = ui.state ? frozenInfo(ui.state) : null;
  const thaw = ui.thaw ? `<small class="thaw">${t(ui.lang, "thawTick", { cash: compactHkd(ui.thaw) })}</small>` : "";
  let sellRow = "";
  if (ui.state?.phase === "sell") {
    ensureSale();
    const quote = currentQuote();
    sellRow = `<div class="stats sell-stats">
      <div class="stat"><span class="k">${t(ui.lang, "bowl")}</span><strong id="hud-bowl-word" class="${quote.bowl.ok ? "ok" : "bad"}">${quote.bowl.ok ? t(ui.lang, "bowlOk") : t(ui.lang, "bowlCrack")}</strong></div>
      <div class="stat"><span class="k">${t(ui.lang, "poolLeft")}</span><strong id="hud-pool-num">${poolSum(quote.poolsAfter)}</strong></div>
    </div>`;
  }
  const mark = ui.state
    ? `<button type="button" class="avatar-btn" data-action="identity" aria-label="${escapeHtml(t(ui.lang, "identity"))}">${avatarSvg(company.avatar || CHAIR_AVATARS[0], company.color)}</button>`
    : logoSvg(company.logo, company.color, company.name);
  return `<header class="hud">
    <div class="brand">${mark}<div class="brand-copy"><h1>${escapeHtml(company.name)}</h1><p>${t(ui.lang, "tagline")}</p></div></div>
    <div class="stats">
      <div class="stat stat-cash"><span class="k">${t(ui.lang, "cash")}</span><strong>${compactHkd(cash)}</strong>${thaw}</div>
      <div class="stat stat-rep"><span class="k">${t(ui.lang, "reputation")}</span><strong>${rep}</strong></div>
      <div class="stat stat-heat heat-stat ${heat || ""}"><span class="k">${t(ui.lang, "heatName")}</span><strong>${heatWord}</strong>${heatSmall ? `<small>${heatSmall}</small>` : ""}</div>
      <div class="stat stat-project"><span class="k">${t(ui.lang, "project")}</span><strong>${number ? `${number} / ${projects}` : `— / ${projects}`}</strong></div>
      <div class="stat stat-next"><span class="k">${t(ui.lang, "nextStep")}</span><strong>${step}</strong></div>
      ${frozen ? `<div class="stat stat-frozen"><span class="k">${t(ui.lang, "frozenChip")}</span><strong>${compactHkd(frozen.amount)}</strong><small>${t(ui.lang, "frozenLeft", { n: frozen.left })}</small></div>` : ""}
    </div>
    <div class="hud-actions">
      <button class="ghost" data-action="lang">${t(ui.lang, "langName")}</button>
      ${ui.state ? `<button class="ghost" data-action="history">${t(ui.lang, "history")}</button>` : ""}
      ${ui.state ? `<button class="ghost" data-action="menu">${t(ui.lang, "menu")}</button>` : ""}
    </div>
    ${sellRow}
    ${policy.length ? `<p class="policy-line">${escapeHtml(policy.join(" · "))}</p>` : ""}
    ${comment ? `<p class="hud-comment">${escapeHtml(t(ui.lang, comment))}</p>` : ""}
  </header>`;
}

function priceWord(price) {
  if (price === "cheap") return t(ui.lang, "priceCheap");
  if (price === "expensive") return t(ui.lang, "priceExpensive");
  if (price === "fair") return t(ui.lang, "priceFair");
  return "";
}

function outcomeShort(outcome) {
  return {
    clear: t(ui.lang, "outcomeClear"),
    almost: t(ui.lang, "outcomeAlmost"),
    partial: t(ui.lang, "outcomePartialShort"),
    fail: t(ui.lang, "outcomeFail"),
    skip: t(ui.lang, "skip"),
  }[outcome] || "";
}

function historyMeta(item) {
  if (item.skipped) return t(ui.lang, "skip");
  const bits = [];
  if (["jingjin", "huimen", "xinjing"].includes(item.contractor)) bits.push(t(ui.lang, item.contractor));
  const price = priceWord(item.price);
  if (price) bits.push(price);
  const outcome = outcomeShort(item.outcome);
  if (outcome) bits.push(outcome);
  if (item.collapsed) bits.push(t(ui.lang, "collapse"));
  return bits.join(" · ");
}

function historyPlace(item) {
  if (item.skipped) return t(ui.lang, "skip");
  const heat = item.heat === "spicy" ? t(ui.lang, "heatSpicy") : t(ui.lang, "heatLoose");
  const flavour = item.flavour ? t(ui.lang, flavourKey(item.flavour)) : "";
  return [districtLabel(ui.lang, item.district), flavour, t(ui.lang, typeKey(item.type)), heat].filter(Boolean).join(" · ");
}

function historyDetail(item) {
  if (!item || item.skipped) {
    return `<h3>${item?.index || ""} · ${t(ui.lang, "skip")}</h3><p class="note">${t(ui.lang, "skippedBody")}</p>`;
  }
  const leftover = item.unsold > 0
    ? (item.leftover === "hold" ? t(ui.lang, "leftoverHold") : t(ui.lang, "leftoverCut"))
    : t(ui.lang, "outcomeClear");
  const ask = item.askPerFt2 ? `${priceWord(item.price)} · ${formatHkd(item.askPerFt2)}${t(ui.lang, "perFt")}` : (priceWord(item.price) || "—");
  const contractor = ["jingjin", "huimen", "xinjing"].includes(item.contractor) ? t(ui.lang, item.contractor) : "—";
  return `<h3>${escapeHtml(item.name || districtLabel(ui.lang, item.district))}</h3>
    <p class="note">${escapeHtml(historyPlace(item))}</p>
    ${item.comment ? `<p class="rep-line">${escapeHtml(t(ui.lang, item.comment))}</p>` : ""}
    ${fact(t(ui.lang, "historyContractor"), contractor)}
    ${fact(t(ui.lang, "collapse"), item.collapsed ? t(ui.lang, "collapse") : t(ui.lang, "collapseNone"))}
    ${fact(t(ui.lang, "historyMix"), mixLine(item.mix || {}))}
    ${fact(t(ui.lang, "historyPrice"), ask)}
    ${fact(t(ui.lang, "historySold"), `${item.sold} / ${item.units} · ${outcomeShort(item.outcome) || "—"}`)}
    ${fact(t(ui.lang, "historyLeft"), `${item.unsold ?? Math.max(0, (item.units || 0) - (item.sold || 0))} · ${leftover}`)}
    ${item.collapsed ? fact(t(ui.lang, "quoteCost"), `${formatHkd(item.quoteCost || 0)} → ${formatHkd(item.remedyCost || 0)}`) : ""}
    ${fact(t(ui.lang, "profit"), `${item.profit >= 0 ? "+" : ""}${formatHkd(item.profit)}`)}
    ${fact(t(ui.lang, "historyRep"), item.reputationDelta == null ? "—" : signed(item.reputationDelta))}`;
}

function floorPlan() {
  return `<svg class="floor-plan" viewBox="0 0 160 100" aria-hidden="true">
    <rect x="4" y="4" width="152" height="92" rx="4" fill="none" stroke="currentColor" stroke-width="3"/>
    <path d="M4 62 H100 V4 M100 40 H156 M58 62 V96" fill="none" stroke="currentColor" stroke-width="2"/>
    <text x="32" y="36" text-anchor="middle">廳</text>
    <text x="128" y="28" text-anchor="middle">房</text>
    <text x="40" y="82" text-anchor="middle">廚</text>
  </svg>`;
}

function floorDrawer() {
  if (ui.drawer !== "plan" || !ui.state) return "";
  return `<div class="drawer" data-action="close-drawer"><div class="drawer-panel" data-action="stop">
    <div class="head"><h3>${t(ui.lang, "floorTitle")}</h3><button class="ghost drawer-close" data-action="close-drawer">${t(ui.lang, "closeDrawer")}</button></div>
    <div class="drawer-body">${floorPlan()}<p class="note">${t(ui.lang, "floorNote")}</p></div>
  </div></div>`;
}

function lockedDrawer() {
  if (ui.drawer !== "locked" || !ui.state) return "";
  const have = new Set(unlockedAchievements(ui.state, ui.catalog.balance));
  const slots = ["clear", "mega", "flagship", "comeback", "finished"].map((id) => {
    if (!have.has(id)) return `<span class="mini-seal empty" aria-hidden="true"></span>`;
    return `<span class="mini-seal">${t(ui.lang, achievementKey(id))}</span>`;
  }).join("");
  return `<div class="drawer" data-action="close-drawer"><div class="drawer-panel" data-action="stop">
    <div class="head"><h3>${t(ui.lang, "locked")}</h3><button class="ghost drawer-close" data-action="close-drawer">${t(ui.lang, "closeDrawer")}</button></div>
    <div class="drawer-body"><div class="seal-row slots">${slots}</div></div>
  </div></div>`;
}

function historyDrawer() {
  if (ui.drawer !== "history" || !ui.state) return "";
  const items = [...(ui.state.history || [])].reverse();
  const focus = items.find((item) => item.index === ui.historyFocus);
  const body = focus
    ? `<button class="ghost" data-action="history-back">${t(ui.lang, "historyBack")}</button>${historyDetail(focus)}`
    : items.length
      ? `<ul class="record-list">${items.map((item) => {
          const title = item.skipped ? t(ui.lang, "skip") : (item.name || districtLabel(ui.lang, item.district));
          const sign = item.profit >= 0 ? "+" : "";
          return `<li><button data-action="history-open" data-index="${item.index}">
            <span><b>${escapeHtml(title)}</b><small>${escapeHtml(historyMeta(item))}</small><small>${escapeHtml(historyPlace(item))}</small></span>
            <strong>${item.skipped ? "0" : `${sign}${compactHkd(item.profit)}`}</strong>
          </button></li>`;
        }).join("")}</ul>`
      : `<p class="note">${t(ui.lang, "historyEmpty")}</p>`;
  return `<div class="drawer" data-action="close-drawer"><div class="drawer-panel" data-action="stop">
    <div class="head"><h3>${t(ui.lang, "history")}</h3><button class="ghost drawer-close" data-action="close-drawer">${t(ui.lang, "closeDrawer")}</button></div>
    <div class="drawer-body">${body}</div>
  </div></div>`;
}

function menuOverlay() {
  if (!ui.menu) return "";
  if (ui.confirmNewGame) {
    return `<div class="menu"><div class="card">
      <h3>${t(ui.lang, "newGame")}</h3>
      <p class="note">${t(ui.lang, "newGameConfirm")}</p>
      <div class="stack"><button class="primary" data-action="confirm-new-game">${t(ui.lang, "confirmNewGame")}</button><button class="ghost" data-action="cancel-new-game">${t(ui.lang, "cancelNewGame")}</button></div>
    </div></div>`;
  }
  return `<div class="menu"><div class="card">
    <h3>${t(ui.lang, "menu")}</h3>
    <div class="stack">
      <button class="primary" data-action="close-menu">${t(ui.lang, "close")}</button>
      <button class="ghost" data-action="identity">${t(ui.lang, "identity")}</button>
      <button class="ghost" data-action="new-game">${t(ui.lang, "newGame")}</button>
      <button class="ghost" data-action="export-save">${t(ui.lang, "exportSave")}</button>
      <label class="ghost file-button">${t(ui.lang, "importSave")}<input type="file" accept="application/json,.json" data-action="import-save" /></label>
      <p class="fine">${t(ui.lang, "saveVersion", { n: ui.state?.v || 8 })}</p>
      ${ui.error === "saveImportInvalid" ? `<p class="banner bad">${t(ui.lang, "saveImportInvalid")}</p>` : ""}
    </div>
  </div></div>`;
}

function identityOverlay() {
  if (!ui.identity || !ui.state) return "";
  return `<div class="menu identity-menu"><div class="card company-card">
    <p class="kicker">${t(ui.lang, "identity")}</p>
    ${identityFields()}
    <div class="stack">
      <button class="primary" data-action="save-identity">${t(ui.lang, "saveIdentity")}</button>
      <button class="ghost" data-action="close-identity">${t(ui.lang, "close")}</button>
    </div>
  </div></div>`;
}

function legacyGuideOverlay() {
  if (!ui.legacyNotice && !ui.legacyGuide) return "";
  const guide = ui.legacyGuide;
  return `<div class="menu legacy-notice" role="dialog" aria-modal="true">
    <div class="card">
      <p class="kicker">${t(ui.lang, guide ? "legacyGuideTitle" : "legacyNoticeTitle")}</p>
      <p class="note">${t(ui.lang, guide ? "legacyGuideBody" : "legacyNoticeBody")}</p>
      <div class="stack">
        ${guide ? `<button class="primary" data-action="legacy-close-guide">${t(ui.lang, "legacyGuideClose")}</button>` : `<button class="primary" data-action="legacy-guide">${t(ui.lang, "legacyNoticeGuide")}</button><button class="ghost" data-action="legacy-dismiss">${t(ui.lang, "legacyNoticeDismiss")}</button>`}
      </div>
    </div>
  </div>`;
}

function render() {
  if (!ui.catalog) return;
  if (ui.state?.phase !== "sell" || ui.lapse || ui.teach) stopSaleTimer();
  document.documentElement.lang = ui.lang === "en" ? "en" : "zh-Hant";
  document.title = t(ui.lang, "title");
  const phase = !ui.state ? "company" : ui.lapse ? "lapse" : ui.teach ? "mismatch" : needsRemedy() ? "remedy" : ui.state.phase;
  app.innerHTML = `${hud()}
    <div class="shell" data-phase="${phase}">
      <main class="stack" id="main">${mainView()}</main>
    </div>
    <p class="legal"><span>${t(ui.lang, "disclaimer")}</span><span class="legal-en"> · ${t(ui.lang, "disclaimerEn")}</span>${jvVisible() ? `<span class="legal-jv"> · ${t(ui.lang, "jvDisclaimer")}</span>` : ""}</p>
    ${dock()}
    ${menuOverlay()}
    ${identityOverlay()}
    ${historyDrawer()}
    ${floorDrawer()}
    ${lockedDrawer()}
    ${legacyGuideOverlay()}
    ${ui.toast ? `<button type="button" class="toast" data-action="toast-dismiss">${t(ui.lang, achievementKey(ui.toast))}<small>${t(ui.lang, "toastDismiss")}</small></button>` : ""}`;
  if (ui.renaming) {
    const field = document.querySelector("#project-name");
    if (field) {
      field.focus();
      field.select();
    }
  }
}

function readIdentityInputs() {
  const name = document.querySelector("#company-name");
  const chair = document.querySelector("#chair-name");
  if (name) ui.draft.name = String(name.value || "").trim().slice(0, 16) || ui.draft.name || "啟岸發展";
  if (chair) ui.draft.chairName = String(chair.value || "").trim().slice(0, 10) || "主席";
  if (!CHAIR_AVATARS.includes(ui.draft.avatar)) ui.draft.avatar = CHAIR_AVATARS[0];
}

function foundCompany() {
  readIdentityInputs();
  ui.draft.name = String(ui.draft.name || "").trim().slice(0, 16) || "啟岸發展";
  const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
  ui.state = createCampaign(ui.catalog, { company: ui.draft, seed });
  ui.menu = false;
  ui.identity = false;
  ui.renaming = false;
  ui.drawer = null;
  ui.historyFocus = null;
  ui.error = null;
  ui.build = null;
  ui.sale = null;
  ui.lapse = false;
  ui.legacyNotice = false;
  ui.legacyGuide = false;
  ui.teach = null;
  ui.similarOpen = false;
  stopLapse();
  persist();
  render();
}

function exportSave() {
  if (!ui.state) return;
  const blob = new Blob([JSON.stringify(serializeCampaign(ui.state), null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${String(ui.state.company?.name || "hk-dev-tycoon").replace(/[^\w\-]+/g, "-")}-save.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function importSave(file) {
  if (!file || !ui.catalog) return;
  try {
    const raw = JSON.parse(await file.text());
    const migrated = migrateSave(raw);
    if (!migrated.ok) throw new Error("invalid_save");
    const restored = hydrateCampaign(ui.catalog, migrated.state);
    ui.state = restored;
    ui.error = null;
    ui.menu = false;
    ui.confirmNewGame = false;
    ui.legacyNotice = Boolean(raw && !raw.onboarding && !raw.flags?.legacyNoticeSeen);
    persist();
  } catch {
    ui.error = "saveImportInvalid";
    ui.menu = true;
  }
  render();
}

function newGame() {
  stopSaleTimer();
  ui.state = null;
  ui.sale = null;
  ui.build = null;
  ui.menu = false;
  ui.identity = false;
  ui.renaming = false;
  ui.drawer = null;
  ui.historyFocus = null;
  ui.error = null;
  ui.lapse = false;
  ui.legacyNotice = false;
  ui.legacyGuide = false;
  ui.confirmNewGame = false;
  ui.teach = null;
  ui.similarOpen = false;
  stopLapse();
  localStorage.removeItem(SAVE_KEY);
  render();
}

function jvVisible() {
  if (!ui.state) return false;
  if (ui.state.phase === "land" && (ui.state.offers || []).some((offer) => jvEligible(offer))) return true;
  return stakeOf(ui.state.project?.offer) < 1;
}

function onClick(event) {
  const target = event.target.closest("[data-action]");
  if (!target || target.disabled) return;
  if (ui.ignoreClick && target.dataset.action !== "skip-lapse") return;
  if (target.dataset.action !== "confirm-settle") ui.thaw = null;
  const { action, id, slot } = target.dataset;
  if (action === "lang") {
    ui.lang = ui.lang === "tc" ? "en" : "tc";
    localStorage.setItem(LANG_KEY, ui.lang);
    render();
    return;
  }
  if (action === "menu") {
    ui.menu = true;
    ui.identity = false;
    ui.drawer = null;
    render();
    return;
  }
  if (action === "identity") {
    if (ui.state) ui.draft = { ...ui.state.company };
    ui.identity = true;
    ui.menu = false;
    ui.drawer = null;
    render();
    return;
  }
  if (action === "close-identity") {
    ui.identity = false;
    render();
    return;
  }
  if (action === "save-identity") {
    readIdentityInputs();
    const saved = updateCompany(ui.state, ui.draft);
    if (saved.ok) {
      ui.state = saved.state;
      ui.identity = false;
      persist();
    }
    render();
    return;
  }
  if (action === "avatar") {
    if (CHAIR_AVATARS.includes(id)) ui.draft.avatar = id;
    readIdentityInputs();
    render();
    return;
  }
  if (action === "rename-edit") {
    ui.renaming = true;
    render();
    return;
  }
  if (action === "reset-mix") {
    ensureBuild();
    ui.build.mix = projectPresetMix(ui.catalog, ui.state);
    render();
    return;
  }
  if (action === "suggested-build") {
    if (!isOnboarding(ui.state) || ui.state.phase !== "build") return;
    ensureBuild();
    ui.build.mix = projectPresetMix(ui.catalog, ui.state);
    ui.build.contractor = "huimen";
    ui.build.loan = "cash";
    ui.error = null;
    render();
    return;
  }
  if (action === "history") {
    ui.drawer = "history";
    ui.historyFocus = null;
    ui.menu = false;
    render();
    return;
  }
  if (action === "locked") {
    ui.drawer = "locked";
    ui.menu = false;
    render();
    return;
  }
  if (action === "floor") {
    ui.drawer = "plan";
    render();
    return;
  }
  if (action === "toast-dismiss") {
    ui.toast = null;
    stopToast();
    armToast();
    render();
    return;
  }
  if (action === "skip-ceremony") {
    if (!ui.ceremony) return;
    ui.ceremony = false;
    stopCeremony();
    armToast();
    render();
    return;
  }
  if (action === "skip-flourish") {
    if (!ui.flourish) return;
    ui.flourish = false;
    stopFlourish();
    render();
    return;
  }
  if (action === "close-drawer") {
    ui.drawer = null;
    ui.historyFocus = null;
    render();
    return;
  }
  if (action === "stop") return;
  if (action === "history-back") {
    ui.historyFocus = null;
    render();
    return;
  }
  if (action === "history-open") {
    ui.historyFocus = Number(target.dataset.index);
    render();
    return;
  }
  if (action === "close-menu") {
    ui.menu = false;
    ui.confirmNewGame = false;
    render();
    return;
  }
  if (action === "export-save") {
    exportSave();
    return;
  }
  if (action === "new-game") {
    ui.confirmNewGame = true;
    render();
    return;
  }
  if (action === "cancel-new-game") {
    ui.confirmNewGame = false;
    render();
    return;
  }
  if (action === "confirm-new-game") {
    newGame();
    return;
  }
  if (action === "legacy-dismiss" || action === "legacy-guide") {
    ui.state = { ...ui.state, flags: { ...(ui.state.flags || {}), legacyNoticeSeen: true } };
    ui.legacyNotice = false;
    ui.legacyGuide = action === "legacy-guide";
    persist();
    render();
    return;
  }
  if (action === "legacy-close-guide") {
    ui.legacyGuide = false;
    render();
    return;
  }
  if (action === "preset-name") {
    readIdentityInputs();
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
  if (action === "buy") {
    const stake = target.dataset.stake ? Number(target.dataset.stake) : 1;
    apply(chooseLand(ui.catalog, ui.state, slot, stake));
  }
  if (action === "skip") apply(skipLand(ui.catalog, ui.state));
  if (action === "pick-contractor") {
    ensureBuild();
    ui.build.contractor = id;
    render();
    return;
  }
  if (action === "mix-preset") {
    ensureBuild();
    ui.build.mix = mixPreset(ui.state.project.offer.gfaFt2, id);
    render();
    return;
  }
  if (action === "mix-step") {
    ensureBuild();
    const unit = target.dataset.unit;
    const delta = Number(target.dataset.delta) || 0;
    const gfa = ui.state.project.offer.gfaFt2;
    if (delta > 0 && !canAddUnit(gfa, ui.build.mix, unit)) return;
    ui.build.mix = addUnits(gfa, ui.build.mix, unit, delta);
    render();
    return;
  }
  if (action === "loan") {
    ensureBuild();
    if (id === "cash" || id === "small" || id === "big") ui.build.loan = id;
    render();
    return;
  }
  if (action === "confirm-build") {
    ensureBuild();
    const sales = buildSalesBand(ui.catalog, ui.state, ui.build.mix, ui.build.contractor);
    const gaps = sales.gaps?.length
      ? sales.gaps
      : UNIT_SPECS.filter((spec) => (ui.build.mix[spec.id] || 0) > 0).map((spec) => ({ unit: spec.id }));
    if (shouldTeachMismatch(ui.state, sales)) {
      ui.teach = gaps;
      render();
      return;
    }
    commitBuild();
    return;
  }
  if (action === "mismatch-edit") {
    ui.teach = null;
    render();
    return;
  }
  if (action === "mismatch-keep") {
    const noted = acknowledgeMismatch(ui.state);
    if (noted.ok) ui.state = noted.state;
    ui.teach = null;
    persist();
    commitBuild();
    return;
  }
  if (action === "skip-lapse") {
    endLapse();
    return;
  }
  if (action === "remedy") {
    apply(chooseRemedy(ui.catalog, ui.state, id));
    return;
  }
  if (action === "similar") {
    ui.similarOpen = !ui.similarOpen;
    render();
    return;
  }
  if (action === "price") {
    ensureSale();
    if (ui.sale.mode !== "setup") return;
    if (id === "cheap" || id === "fair" || id === "expensive") ui.sale.choices.price = id;
    render();
    return;
  }
  if (action === "showflat") {
    ensureSale();
    if (ui.sale.mode !== "setup") return;
    ui.sale.choices.showflat = !ui.sale.choices.showflat;
    render();
    return;
  }
  if (action === "rebate") {
    ensureSale();
    if (ui.sale.mode !== "setup") return;
    ui.sale.choices.rebate = id === "std" || id === "high" ? id : "none";
    render();
    return;
  }
  if (action === "ad-target") {
    ensureSale();
    if (ui.sale.mode !== "setup") return;
    if (ui.sale.choices.adTarget === id && ui.sale.choices.adBudget !== "none") {
      ui.sale.choices.adBudget = "none";
    } else {
      ui.sale.choices.adTarget = id;
      if (ui.sale.choices.adBudget === "none") ui.sale.choices.adBudget = "low";
    }
    render();
    return;
  }
  if (action === "ad-budget") {
    ensureSale();
    if (ui.sale.mode !== "setup") return;
    ui.sale.choices.adBudget = id === "low" || id === "high" ? id : "none";
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
    const reveal = revealNow(quote);
    const bumped = reveal.done ? quote.sold : Math.max(ui.sale.shownSold, reveal.shown);
    if (bumped > ui.sale.shownSold) {
      ui.sale.pops.unshift({ text: `+${bumped - ui.sale.shownSold}` });
      ui.sale.pops = ui.sale.pops.slice(0, 3);
    }
    ui.sale.shownSold = bumped;
    if (reveal.done) {
      ui.sale.mode = "done";
      stopSaleTimer();
      render();
      return;
    }
    if (ui.sale.reduced) {
      render();
      return;
    }
    const tProgress = Math.min(1, (performance.now() - ui.sale.started) / 7000);
    paintSale(quote, tProgress);
    return;
  }
  if (action === "commit-sale") {
    stopSaleTimer();
    apply(commitSale(ui.catalog, ui.state, ui.sale.choices));
    ui.sale = null;
    return;
  }
  if (action === "confirm-settle") {
    ui.ceremony = false;
    stopCeremony();
    apply(confirmSettle(ui.catalog, ui.state));
    return;
  }
  if (action === "story") apply(chooseStory(ui.catalog, ui.state, id));
}

function writeProjectName(value, restore) {
  if (!ui.state || (ui.state.phase !== "build" && ui.state.phase !== "sell")) return;
  if (ui.state.phase === "sell" && ui.sale?.mode && ui.sale.mode !== "setup") return;
  const next = renameProject(ui.catalog, ui.state, value);
  if (!next.ok) return;
  ui.state = next.state;
  persist();
  if (restore) {
    const field = document.querySelector("#project-name");
    if (field) field.value = ui.state.project.name;
  }
}

function onInput(event) {
  if (event.target.id === "company-name") {
    ui.draft.name = event.target.value.slice(0, 16);
    const shown = ui.draft.name.trim() || "啟岸發展";
    for (const node of document.querySelectorAll(".brand h1")) node.textContent = shown;
    const letter = shown.slice(0, 1) || "啟";
    for (const node of document.querySelectorAll(".brand text, .logo-pick text")) node.textContent = letter;
    return;
  }
  if (event.target.id === "chair-name") {
    ui.draft.chairName = event.target.value.slice(0, 10);
    return;
  }
  if (event.target.id === "project-name") {
    if (event.target.value.trim()) writeProjectName(event.target.value, false);
    return;
  }
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
      ui.legacyNotice = Boolean(raw && !raw.onboarding && !raw.flags?.legacyNoticeSeen);
    } catch {
      ui.state = null;
      localStorage.removeItem(SAVE_KEY);
    }
  } else if (raw) {
    localStorage.removeItem(SAVE_KEY);
  }
  app.addEventListener("click", onClick);
  app.addEventListener("input", onInput);
  app.addEventListener("change", (event) => {
    if (event.target.matches("input[data-action='import-save']")) importSave(event.target.files?.[0]);
  });
  app.addEventListener("focusout", (event) => {
    if (event.target.id !== "project-name") return;
    writeProjectName(event.target.value, false);
    ui.renaming = false;
    render();
  });
  app.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target.id === "project-name") {
      event.preventDefault();
      event.target.blur();
    }
  });
  app.addEventListener("pointerover", (event) => {
    const button = event.target.closest?.(".stake-grid button");
    if (!button) return;
    const line = button.closest(".venture")?.querySelector("[data-jv-line]");
    if (!line) return;
    const stake = Number(button.dataset.stake);
    if (!Number.isFinite(stake) || stake <= 0) return;
    line.textContent = shareSentence(stake);
  });
  render();
}

boot().catch((error) => {
  app.textContent = error.message;
});
