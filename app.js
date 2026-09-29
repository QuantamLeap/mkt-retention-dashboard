const STORAGE_KEY = "retainly-dashboard-v1";

const seedData = {
  events: [
    { id: "evt-cny", name: "CNY Lucky Rewards", festival: "CNY", festivalDate: "2026-02-17", budget: 18000, status: "Completed", market: "MY" },
    { id: "evt-raya", name: "Hari Raya Appreciation", festival: "Hari Raya", festivalDate: "2026-03-20", budget: 12500, status: "Completed", market: "MY" },
    { id: "evt-diwali", name: "Diwali Festival of Wins", festival: "Diwali", festivalDate: "2026-11-08", budget: 15000, status: "Planned", market: "MY" },
    { id: "evt-xmas", name: "Christmas Countdown", festival: "Christmas", festivalDate: "2026-12-25", budget: 22000, status: "Planned", market: "MY" },
    { id: "evt-moon", name: "Mid-Autumn VIP Night", festival: "Mid-Autumn", festivalDate: "2026-09-25", budget: 9000, status: "Planned", market: "MY" }
  ],
  rewards: [
    { id: "r1", playerId: "PL-1042", playerName: "Alicia Tan", tier: "VIP", eventId: "evt-cny", type: "Credit", description: "Lucky bonus credits", quantity: 1, unitCost: 288, date: "2026-02-08", status: "Issued" },
    { id: "r2", playerId: "PL-1189", playerName: "Dev Kumar", tier: "Gold", eventId: "evt-cny", type: "Physical", description: "Premium tea hamper", quantity: 1, unitCost: 145, date: "2026-02-09", status: "Delivered" },
    { id: "r3", playerId: "PL-2031", playerName: "Nur Imani", tier: "VIP", eventId: "evt-raya", type: "Credit", description: "Festive cashback", quantity: 1, unitCost: 500, date: "2026-03-15", status: "Issued" },
    { id: "r4", playerId: "PL-1566", playerName: "Marcus Lee", tier: "Silver", eventId: "evt-raya", type: "Physical", description: "Festive gift box", quantity: 2, unitCost: 88, date: "2026-03-17", status: "Delivered" },
    { id: "r5", playerId: "PL-1007", playerName: "Priya Nair", tier: "VIP", eventId: "evt-moon", type: "Physical", description: "Mooncake collection", quantity: 1, unitCost: 198, date: "2026-09-21", status: "Delivered" },
    { id: "r6", playerId: "PL-2214", playerName: "Ethan Wong", tier: "Gold", eventId: "evt-moon", type: "Credit", description: "VIP night credits", quantity: 1, unitCost: 350, date: "2026-09-22", status: "Issued" },
    { id: "r7", playerId: "PL-1872", playerName: "Siti Rahman", tier: "Standard", eventId: "evt-moon", type: "Physical", description: "Lantern gift set", quantity: 1, unitCost: 75, date: "2026-09-23", status: "Pending" },
    { id: "r8", playerId: "PL-1042", playerName: "Alicia Tan", tier: "VIP", eventId: "evt-raya", type: "Credit", description: "Loyalty credits", quantity: 1, unitCost: 420, date: "2026-03-20", status: "Issued" }
  ],
  payouts: []
};

const hadLocalStoredState = Boolean(localStorage.getItem(STORAGE_KEY));
let state = loadState();
const sharedStorage = window.RetentionSharedStorage;
let sharedStorageReady = false;
let editingEventId = null;
let selectedEventYear = null;
let selectedEventMarket = "MY";
let selectedOverviewYear = null;
let selectedOverviewMarket = "MY";
let bulkImportRows = [];
let bulkImportFileName = "";

const MARKETS = {
  MY: { name: "Malaysia", currency: "MYR", locale: "en-MY" },
  SG: { name: "Singapore", currency: "SGD", locale: "en-SG" },
  ID: { name: "Indonesia", currency: "IDR", locale: "id-ID" },
  TH: { name: "Thailand", currency: "THB", locale: "th-TH" },
  MX: { name: "Mexico", currency: "MXN", locale: "es-MX" }
};
const MARKET_CODES = Object.keys(MARKETS);
const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });

function marketCurrency(market) {
  return MARKETS[market]?.currency || "MYR";
}
function formatMoney(value, market = "MY") {
  const config = MARKETS[market] || MARKETS.MY;
  return new Intl.NumberFormat(config.locale, {
    style: "currency",
    currency: config.currency,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}
function eventMarket(event) {
  return MARKET_CODES.includes(event?.market) ? event.market : "MY";
}
function formatMarketTotals(rewards) {
  const totals = {};
  rewards.forEach(reward => {
    const market = eventMarket(eventById(reward.eventId));
    totals[market] = (totals[market] || 0) + rewardCost(reward);
  });
  return MARKET_CODES
    .filter(market => totals[market])
    .map(market => `${market} ${formatMoney(totals[market], market)}`)
    .join(" · ") || "—";
}

function normalizeEvent(event) {
  const { startDate, endDate, ...rest } = event;
  const status = event.status === "Active"
    ? "Planned"
    : ["Unplan", "Planned", "Completed"].includes(event.status)
      ? event.status
      : "Unplan";

  return {
    ...rest,
    market: MARKET_CODES.includes(event.market) ? event.market : "MY",
    status,
    festivalDate: event.festivalDate || startDate || endDate || ""
  };
}

function loadState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!stored) return structuredClone(seedData);
    return {
      events: Array.isArray(stored.events) ? stored.events.map(normalizeEvent) : [],
      rewards: Array.isArray(stored.rewards) ? stored.rewards : [],
      payouts: Array.isArray(stored.payouts) ? stored.payouts : []
    };
  } catch {
    return structuredClone(seedData);
  }
}

function normalizeDashboardState(raw) {
  return {
    events: Array.isArray(raw?.events) ? raw.events.map(normalizeEvent) : [],
    rewards: Array.isArray(raw?.rewards) ? raw.rewards : [],
    payouts: Array.isArray(raw?.payouts) ? raw.payouts : []
  };
}

function updateStorageStatus(label, detail, tone = "ok") {
  const title = document.querySelector("#storageStatusTitle");
  const subtitle = document.querySelector("#storageStatusDetail");
  const dot = document.querySelector("#storageStatusDot");
  if (title) title.textContent = label;
  if (subtitle) subtitle.textContent = detail;
  if (dot) dot.dataset.tone = tone;
}

function applySharedState(raw, detail = "Supabase · all devices") {
  state = normalizeDashboardState(raw);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
  updateStorageStatus("Shared data synced", detail, "ok");
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (!sharedStorageReady || !sharedStorage) return Promise.resolve();

  const snapshot = normalizeDashboardState(state);
  updateStorageStatus("Saving shared data", "Syncing to Supabase…", "syncing");

  return sharedStorage.save(snapshot).then(() => {
    updateStorageStatus("Shared data synced", "Supabase · all devices", "ok");
  }).catch(async error => {
    console.error("Shared save failed", error);
    if (error?.status === 409) {
      try {
        const latest = await sharedStorage.load();
        if (latest) {
          applySharedState(latest, "Another device updated first");
          showToast("Another device updated the dashboard. Latest shared data loaded.");
          return;
        }
      } catch (refreshError) {
        console.error("Shared refresh after conflict failed", refreshError);
      }
    }
    updateStorageStatus("Sync problem", "Local copy kept on this device", "error");
    showToast("Could not sync shared data. Your local copy is still available.");
  });
}

async function initializeSharedStorage() {
  if (!sharedStorage) {
    updateStorageStatus("Offline local data", "Shared storage client unavailable", "error");
    return;
  }

  updateStorageStatus("Connecting shared data", "Supabase · supabase-mkt", "syncing");

  try {
    const remote = await sharedStorage.load();
    if (remote) {
      sharedStorageReady = true;
      applySharedState(remote);
    } else if (hadLocalStoredState) {
      sharedStorageReady = true;
      await sharedStorage.save(normalizeDashboardState(state));
      updateStorageStatus("Shared data created", "Migrated from this device", "ok");
    } else {
      sharedStorageReady = false;
      updateStorageStatus("Waiting for shared data", "Open the device with existing records first", "warning");
    }

    sharedStorage.startPolling(nextState => {
      sharedStorageReady = true;
      applySharedState(nextState, "Updated from another device");
    });

    window.addEventListener("focus", () => {
      sharedStorage.refresh(nextState => applySharedState(nextState, "Updated from another device")).catch(() => {});
    });
  } catch (error) {
    console.error("Shared storage initialization failed", error);
    sharedStorageReady = false;
    updateStorageStatus("Offline local data", "Supabase connection unavailable", "error");
    showToast("Shared database unavailable. Showing this device's saved data.");
  }
}

function eventById(id) { return state.events.find(event => event.id === id); }
function rewardCost(reward) { return Number(reward.quantity) * Number(reward.unitCost); }
function eventRewardValue(id) { return state.rewards.filter(reward => reward.eventId === id).reduce((sum, reward) => sum + rewardCost(reward), 0); }
function payoutAmount(payout) { return Number(payout.amount) || 0; }
function eventPaidPayout(id) { return eventRewardValue(id); }
function rewardPayoutRecord(reward) {
  return {
    id: `reward-payout-${reward.id}`,
    eventId: reward.eventId,
    date: reward.date,
    type: reward.type === "Credit" ? "Free Credit" : "Physical Gift",
    amount: rewardCost(reward),
    quantity: Number(reward.quantity) || 1,
    playerBatch: reward.playerId,
    reference: reward.reference || reward.description || "Issued reward",
    status: "Paid",
    recordedBy: "Issue Reward",
    notes: "Automatically recorded as paid out when the reward was issued.",
    sourceRewardId: reward.id,
    isRewardPayout: true
  };
}
function allPayoutRecords() {
  return state.rewards.map(rewardPayoutRecord);
}
function eventRecipients(id) { return new Set(state.rewards.filter(reward => reward.eventId === id).map(reward => reward.playerId)).size; }
function formatDate(value) { return value ? dateFormat.format(new Date(`${value}T00:00:00`)) : "—"; }
function initials(name) { return String(name || "?").split(" ").map(part => part[0]).slice(0, 2).join("").toUpperCase(); }
function escapeHtml(value) { const element = document.createElement("div"); element.textContent = String(value ?? ""); return element.innerHTML; }
function today() { return new Date().toISOString().slice(0, 10); }
function eventYear(event) { return String(event.festivalDate || "").slice(0, 4); }
function availableEventYears() {
  return [...new Set(state.events.map(eventYear).filter(Boolean))].sort((a, b) => Number(b) - Number(a));
}
function ensureSelectedEventYear() {
  const years = yearsForMarket(selectedEventMarket);
  if (!years.length) { selectedEventYear = "all"; return; }
  if (selectedEventYear === "all" || years.includes(String(selectedEventYear))) return;
  const currentYear = String(new Date().getFullYear());
  selectedEventYear = years.includes(currentYear) ? currentYear : years[0];
}

function yearsForMarket(market = "all") {
  return [...new Set(
    state.events
      .filter(event => market === "all" || eventMarket(event) === market)
      .map(eventYear)
      .filter(Boolean)
  )].sort((a, b) => Number(b) - Number(a));
}

function ensureSelectedOverviewYear() {
  const years = yearsForMarket(selectedOverviewMarket);
  if (!years.length) { selectedOverviewYear = "all"; return; }
  if (selectedOverviewYear === "all" || years.includes(String(selectedOverviewYear))) return;
  const currentYear = String(new Date().getFullYear());
  selectedOverviewYear = years.includes(currentYear) ? currentYear : years[0];
}

function getOverviewEvents() {
  ensureSelectedOverviewYear();
  return state.events.filter(event => {
    const marketMatch = selectedOverviewMarket === "all" || eventMarket(event) === selectedOverviewMarket;
    const yearMatch = selectedOverviewYear === "all" || eventYear(event) === String(selectedOverviewYear);
    return marketMatch && yearMatch;
  });
}

function getOverviewRewards(events = getOverviewEvents()) {
  const ids = new Set(events.map(event => event.id));
  return state.rewards.filter(reward => ids.has(reward.eventId));
}

function renderOverviewMarketTabs() {
  document.querySelector("#overviewMarketTabs").innerHTML = [
    ...MARKET_CODES.map(market => `<button type="button" class="market-tab ${selectedOverviewMarket === market ? "active" : ""}" data-overview-market="${market}">${market}</button>`),
    `<button type="button" class="market-tab ${selectedOverviewMarket === "all" ? "active" : ""}" data-overview-market="all">All Markets</button>`
  ].join("");
}

function renderOverviewYearTabs() {
  ensureSelectedOverviewYear();
  const years = yearsForMarket(selectedOverviewMarket);
  document.querySelector("#overviewYearTabs").innerHTML = [
    ...years.map(year => `<button type="button" class="year-tab ${String(selectedOverviewYear) === year ? "active" : ""}" data-overview-year="${year}">${year}</button>`),
    `<button type="button" class="year-tab ${selectedOverviewYear === "all" ? "active" : ""}" data-overview-year="all">All Years</button>`
  ].join("");

  const marketLabel = selectedOverviewMarket === "all" ? "All markets" : selectedOverviewMarket;
  const yearLabel = selectedOverviewYear === "all" ? "all years" : selectedOverviewYear;
  document.querySelector("#overviewPeriodLabel").textContent = `${marketLabel} · ${yearLabel} campaign activity`;
}

function render() {
  renderOverviewMarketTabs();
  renderOverviewYearTabs();
  renderMetrics();
  renderCostChart();
  renderRewardMix();
  renderOverviewEvents();
  renderEventGrid();
  renderSelects();
  renderRewards();
  renderPayouts();
}

function renderMetrics() {
  const events = getOverviewEvents();
  const rewards = getOverviewRewards(events);
  const planned = events.filter(event => event.status === "Planned").length;
  const recipients = new Set(rewards.map(reward => `${eventMarket(eventById(reward.eventId))}:${reward.playerId}`)).size;
  const periodLabel = selectedOverviewYear === "all" ? "all years" : selectedOverviewYear;

  let payoutValue;
  let payoutDetail;
  let payoutSymbol;
  if (selectedOverviewMarket === "all") {
    const marketsWithPayouts = MARKET_CODES.filter(market => rewards.some(reward => eventMarket(eventById(reward.eventId)) === market)).length;
    payoutValue = `${marketsWithPayouts} market${marketsWithPayouts === 1 ? "" : "s"}`;
    payoutDetail = "Currencies kept separate — see market breakdown";
    payoutSymbol = "◎";
  } else {
    const paid = rewards.reduce((sum, reward) => sum + rewardCost(reward), 0);
    payoutValue = formatMoney(paid, selectedOverviewMarket);
    payoutDetail = `${rewards.length} paid reward records in ${periodLabel}`;
    payoutSymbol = marketCurrency(selectedOverviewMarket);
  }

  const metrics = [
    ["Actual payout", payoutValue, payoutDetail, payoutSymbol, "#28755a"],
    ["Unique recipients", recipients.toLocaleString(), `Across ${events.length} festival event${events.length === 1 ? "" : "s"}`, "◎", "#3d6781"],
    ["Events tracked", events.length, `${planned} planned`, "◇", "#a56c19"]
  ];
  document.querySelector("#metricGrid").innerHTML = metrics.map(([label, value, detail, symbol, tone]) => `
    <article class="metric-card" style="--tone:${tone}"><div class="metric-label"><span>${label}</span><span class="metric-symbol">${symbol}</span></div><div class="metric-value">${value}</div><div class="metric-detail">${detail}</div></article>`).join("");
}

function renderCostChart() {
  const events = getOverviewEvents();
  const chart = document.querySelector("#costChart");
  const meta = document.querySelector("#averageCost");

  if (selectedOverviewMarket === "all") {
    const marketRows = MARKET_CODES.map(market => {
      const marketEvents = events.filter(event => eventMarket(event) === market);
      const ids = new Set(marketEvents.map(event => event.id));
      const rewards = state.rewards.filter(reward => ids.has(reward.eventId));
      const cost = rewards.reduce((sum, reward) => sum + rewardCost(reward), 0);
      return { market, cost, events: marketEvents.length, records: rewards.length };
    });

    document.querySelector("#payoutChartEyebrow").textContent = "PAYOUT BY MARKET";
    document.querySelector("#payoutChartTitle").textContent = selectedOverviewYear === "all" ? "Market payout summary" : `${selectedOverviewYear} market payout`;
    meta.textContent = "Currencies shown separately";
    chart.innerHTML = `<div class="market-payout-grid">${marketRows.map(row => `
      <article class="market-payout-card">
        <div><span class="market-pill">${row.market}</span><small>${MARKETS[row.market].name}</small></div>
        <strong>${formatMoney(row.cost, row.market)}</strong>
        <span>${row.events} event${row.events === 1 ? "" : "s"} · ${row.records} paid record${row.records === 1 ? "" : "s"}</span>
      </article>`).join("")}</div>`;
    return;
  }

  let values = [];
  if (selectedOverviewYear === "all") {
    values = yearsForMarket(selectedOverviewMarket).slice().sort((a, b) => Number(a) - Number(b)).map(year => {
      const yearEvents = state.events.filter(event => eventMarket(event) === selectedOverviewMarket && eventYear(event) === year);
      const ids = new Set(yearEvents.map(event => event.id));
      const cost = state.rewards.filter(reward => ids.has(reward.eventId)).reduce((sum, reward) => sum + rewardCost(reward), 0);
      return { label: year, cost };
    });
    document.querySelector("#payoutChartEyebrow").textContent = "PAYOUT BY YEAR";
    document.querySelector("#payoutChartTitle").textContent = `${selectedOverviewMarket} annual payout`;
  } else {
    const festivalOrder = ["CNY", "Hari Raya", "Mid-Autumn", "Diwali", "Christmas", "Other"];
    const festivals = [...new Set(events.map(event => event.festival))].sort((a, b) => {
      const ai = festivalOrder.indexOf(a); const bi = festivalOrder.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.localeCompare(b);
    });
    values = festivals.map(festival => {
      const festivalEvents = events.filter(event => event.festival === festival);
      const ids = new Set(festivalEvents.map(event => event.id));
      const cost = state.rewards.filter(reward => ids.has(reward.eventId)).reduce((sum, reward) => sum + rewardCost(reward), 0);
      return { label: festival, cost };
    });
    document.querySelector("#payoutChartEyebrow").textContent = "PAYOUT BY FESTIVAL";
    document.querySelector("#payoutChartTitle").textContent = `${selectedOverviewMarket} · ${selectedOverviewYear} festival payout`;
  }

  const total = values.reduce((sum, item) => sum + item.cost, 0);
  const max = Math.max(...values.map(item => item.cost), 1);
  meta.textContent = `Total ${formatMoney(total, selectedOverviewMarket)}`;
  chart.innerHTML = values.length
    ? values.map(({ label, cost }) => `
      <div class="bar-column" title="${escapeHtml(label)}: ${formatMoney(cost, selectedOverviewMarket)}"><span class="bar-value">${formatMoney(cost, selectedOverviewMarket)}</span><div class="bar" style="height:${Math.max((cost / max) * 150, 4)}px"></div><span class="bar-label">${escapeHtml(label)}</span></div>`).join("")
    : `<div class="chart-empty-state">No payout data for this period.</div>`;
}

function renderRewardMix() {
  const rewards = getOverviewRewards();
  if (selectedOverviewMarket === "all") {
    document.querySelector("#rewardMix").innerHTML = `
      <div class="mix-total"><strong>5 markets</strong><span>Amounts are not combined across currencies</span></div>
      <div class="market-mix-note">Select MY, SG, ID, TH or MX to view the Free Credit vs Physical Gift payout mix in that market's currency.</div>`;
    return;
  }

  const total = rewards.reduce((sum, reward) => sum + rewardCost(reward), 0);
  const credit = rewards.filter(reward => reward.type === "Credit").reduce((sum, reward) => sum + rewardCost(reward), 0);
  const physical = total - credit;
  const creditPct = total ? Math.round(credit / total * 100) : 0;
  document.querySelector("#rewardMix").innerHTML = `
    <div class="mix-total"><strong>${formatMoney(total, selectedOverviewMarket)}</strong><span>Total paid out · ${selectedOverviewMarket}</span></div>
    <div class="mix-row"><div class="mix-line"><span>Free credits</span><span>${creditPct}% · ${formatMoney(credit, selectedOverviewMarket)}</span></div><div class="mix-track"><div class="mix-fill" style="width:${creditPct}%"></div></div></div>
    <div class="mix-row"><div class="mix-line"><span>Physical gifts</span><span>${total ? 100 - creditPct : 0}% · ${formatMoney(physical, selectedOverviewMarket)}</span></div><div class="mix-track"><div class="mix-fill physical" style="width:${total ? 100 - creditPct : 0}%"></div></div></div>`;
}

function eventRow(event) {
  const market = eventMarket(event);
  return `<tr><td><span class="market-pill">${market}</span></td><td><strong>${escapeHtml(event.name)}</strong><small>${escapeHtml(event.festival)}</small></td><td>${formatDate(event.festivalDate)}</td><td>${eventRecipients(event.id)}</td><td>${formatMoney(event.budget, market)}</td><td><strong>${formatMoney(eventPaidPayout(event.id), market)}</strong></td><td><span class="badge ${event.status.toLowerCase()}">${event.status}</span></td></tr>`;
}

function renderOverviewEvents() {
  const events = getOverviewEvents()
    .slice()
    .sort((a, b) => String(b.festivalDate || "").localeCompare(String(a.festivalDate || "")));
  document.querySelector("#overviewEvents").innerHTML = events.slice(0, 5).map(eventRow).join("") || `<tr><td colspan="7" class="empty-state">No events for this period.</td></tr>`;
}

function renderEventGrid() {
  ensureSelectedEventYear();

  document.querySelector("#eventMarketTabs").innerHTML = [
    ...MARKET_CODES.map(market => `<button type="button" class="market-tab ${selectedEventMarket === market ? "active" : ""}" data-event-market="${market}">${market}</button>`),
    `<button type="button" class="market-tab ${selectedEventMarket === "all" ? "active" : ""}" data-event-market="all">All Markets</button>`
  ].join("");

  const years = yearsForMarket(selectedEventMarket);
  const yearTabs = document.querySelector("#eventYearTabs");
  yearTabs.innerHTML = [
    ...years.map(year => `<button type="button" class="year-tab ${String(selectedEventYear) === year ? "active" : ""}" data-event-year="${year}">${year}</button>`),
    `<button type="button" class="year-tab ${selectedEventYear === "all" ? "active" : ""}" data-event-year="all">All Years</button>`
  ].join("");

  const festival = document.querySelector("#eventFestivalFilter").value;
  const status = document.querySelector("#eventStatusFilter").value;

  const filteredEvents = state.events
    .filter(event => selectedEventMarket === "all" || eventMarket(event) === selectedEventMarket)
    .filter(event => selectedEventYear === "all" || eventYear(event) === String(selectedEventYear))
    .filter(event => festival === "all" || event.festival === festival)
    .filter(event => status === "all" || event.status === status)
    .sort((a, b) => String(a.festivalDate || "").localeCompare(String(b.festivalDate || "")));

  document.querySelector("#eventFilterCount").textContent = `Showing ${filteredEvents.length} of ${state.events.length} events`;

  document.querySelector("#eventGrid").innerHTML = filteredEvents.map(event => {
    const paid = eventPaidPayout(event.id);
    const market = eventMarket(event);
    return `<article class="event-card">
      <div class="event-card-top">
        <div class="festival-mark">${escapeHtml(event.festival.slice(0, 3).toUpperCase())}</div>
        <div class="event-card-actions">
          <span class="market-pill">${market}</span>
          <span class="badge ${event.status.toLowerCase()}">${event.status}</span>
          <button class="event-edit-button" type="button" data-edit-event="${escapeHtml(event.id)}">Edit</button>
        </div>
      </div>
      <h3>${escapeHtml(event.name)}</h3>
      <p>${MARKETS[market].name} · Festival date · ${formatDate(event.festivalDate)}</p>
      <div class="event-stats event-stats-three">
        <div class="event-stat"><span>Recipients</span><strong>${eventRecipients(event.id)}</strong></div>
        <div class="event-stat"><span>Budget</span><strong>${formatMoney(Number(event.budget) || 0, market)}</strong></div>
        <div class="event-stat"><span>Paid out</span><strong>${formatMoney(paid, market)}</strong></div>
      </div>
    </article>`;
  }).join("") || `<div class="event-empty-state"><strong>No events found</strong><span>Try another market, year, festival, or status filter.</span></div>`;
}

function renderSelects() {
  const sortedEvents = state.events.slice().sort((a, b) => {
    const marketCompare = eventMarket(a).localeCompare(eventMarket(b));
    return marketCompare || String(a.festivalDate || "").localeCompare(String(b.festivalDate || ""));
  });
  const options = sortedEvents.map(event => `<option value="${event.id}">[${eventMarket(event)}] ${escapeHtml(event.name)}</option>`).join("");

  const eventFilter = document.querySelector("#eventFilter");
  const currentRewardFilter = eventFilter.value;
  eventFilter.innerHTML = `<option value="all">All events</option>${options}`;
  if (["all", ...state.events.map(event => event.id)].includes(currentRewardFilter)) eventFilter.value = currentRewardFilter;

  const payoutEventFilter = document.querySelector("#payoutEventFilter");
  const currentPayoutFilter = payoutEventFilter.value;
  payoutEventFilter.innerHTML = `<option value="all">All campaigns</option>${options}`;
  if (["all", ...state.events.map(event => event.id)].includes(currentPayoutFilter)) payoutEventFilter.value = currentPayoutFilter;

  const payoutYearFilter = document.querySelector("#payoutYearFilter");
  const currentYear = payoutYearFilter.value;
  const years = availableEventYears();
  payoutYearFilter.innerHTML = `<option value="all">All years</option>${years.map(year => `<option value="${year}">${year}</option>`).join("")}`;
  if (["all", ...years].includes(currentYear)) payoutYearFilter.value = currentYear;

  const rewardEventSelect = document.querySelector("#rewardEventSelect");
  const currentRewardEvent = rewardEventSelect.value;
  rewardEventSelect.innerHTML = options;
  if (state.events.some(event => event.id === currentRewardEvent)) rewardEventSelect.value = currentRewardEvent;

  const bulkRewardEventSelect = document.querySelector("#bulkRewardEventSelect");
  const currentBulkEvent = bulkRewardEventSelect.value;
  bulkRewardEventSelect.innerHTML = options;
  if (state.events.some(event => event.id === currentBulkEvent)) bulkRewardEventSelect.value = currentBulkEvent;

  updateRewardCurrencyLabels();
}

function getFilteredRewards() {
  const search = document.querySelector("#searchInput").value.toLowerCase();
  const market = document.querySelector("#rewardMarketFilter").value;
  const eventId = document.querySelector("#eventFilter").value;
  const type = document.querySelector("#typeFilter").value;

  return state.rewards.filter(reward => {
    const campaign = eventById(reward.eventId);
    const rewardMarket = eventMarket(campaign);
    const playerMatch = String(reward.playerId || "").toLowerCase().includes(search);
    return playerMatch
      && (market === "all" || rewardMarket === market)
      && (eventId === "all" || reward.eventId === eventId)
      && (type === "all" || reward.type === type);
  }).sort((a, b) => b.date.localeCompare(a.date));
}

function renderRewards() {
  const filtered = getFilteredRewards();

  document.querySelector("#rewardTable").innerHTML = filtered.map(reward => {
    const event = eventById(reward.eventId);
    const market = eventMarket(event);
    return `<tr>
      <td><span class="market-pill">${market}</span></td>
      <td><div class="player-cell"><span class="avatar">ID</span><div><strong>${escapeHtml(reward.playerId)}</strong></div></div></td>
      <td>${event ? escapeHtml(event.name) : "Unknown"}</td>
      <td><strong>${escapeHtml(reward.description)}</strong><small>${reward.type === "Credit" ? "Free credit" : "Physical gift"} · Qty ${reward.quantity}</small></td>
      <td><strong>${formatMoney(rewardCost(reward), market)}</strong><small>${formatMoney(reward.unitCost, market)} each</small></td>
      <td>${formatDate(reward.date)}</td>
      <td><span class="badge ${reward.status.toLowerCase()}">${reward.status}</span></td>
      <td><button class="delete-button" data-delete-reward="${reward.id}" aria-label="Delete reward" title="Delete reward">×</button></td>
    </tr>`;
  }).join("") || `<tr><td colspan="8" class="empty-state">No reward records match these filters.</td></tr>`;

  document.querySelector("#recordCount").textContent = `Showing ${filtered.length} of ${state.rewards.length} reward records`;
}

function updateClearRecordsDialog() {
  const filtered = getFilteredRewards();

  document.querySelector("#clearFilteredCount").textContent = filtered.length.toLocaleString();
  document.querySelector("#clearFilteredValue").textContent = formatMarketTotals(filtered);
  document.querySelector("#clearAllCount").textContent = state.rewards.length.toLocaleString();
  document.querySelector("#clearAllValue").textContent = formatMarketTotals(state.rewards);

  document.querySelector("#deleteFilteredRewardsButton").disabled = filtered.length === 0;
  document.querySelector("#deleteAllRewardsButton").disabled = state.rewards.length === 0;
}

function openClearRecordsDialog() {
  updateClearRecordsDialog();
  openDialog(document.querySelector("#clearRecordsDialog"));
}

function deleteFilteredRewards() {
  const filtered = getFilteredRewards();
  if (!filtered.length) { showToast("No filtered reward records to delete"); return; }

  const eventId = document.querySelector("#eventFilter").value;
  const eventName = eventId === "all" ? "the current filtered view" : (eventById(eventId)?.name || "the selected campaign");
  const message = `Delete ${filtered.length} reward record${filtered.length === 1 ? "" : "s"} from ${eventName}? This will also remove ${formatMarketTotals(filtered)} from Paid Out. This cannot be undone.`;

  if (!confirm(message)) return;

  const ids = new Set(filtered.map(reward => reward.id));
  state.rewards = state.rewards.filter(reward => !ids.has(reward.id));
  saveState();
  document.querySelector("#clearRecordsDialog").close();
  render();
  showToast(`${filtered.length} reward record${filtered.length === 1 ? "" : "s"} deleted`);
}

function deleteAllRewards() {
  if (!state.rewards.length) { showToast("There are no reward records to delete"); return; }

  const count = state.rewards.length;
  const message = `Delete all ${count} reward records? This will also remove ${formatMarketTotals(state.rewards)} from Paid Out across all campaigns. This cannot be undone.`;

  if (!confirm(message)) return;

  state.rewards = [];
  saveState();
  document.querySelector("#clearRecordsDialog").close();
  render();
  showToast("All reward records deleted");
}

function renderPayouts() {
  const search = document.querySelector("#payoutSearchInput").value.toLowerCase();
  const marketFilter = document.querySelector("#payoutMarketFilter").value;
  const yearFilter = document.querySelector("#payoutYearFilter").value;
  const eventId = document.querySelector("#payoutEventFilter").value;
  const payoutRecords = allPayoutRecords();

  const scopedRecords = payoutRecords.filter(payout => {
    const campaign = eventById(payout.eventId);
    const market = eventMarket(campaign);
    return (marketFilter === "all" || market === marketFilter)
      && (yearFilter === "all" || eventYear(campaign) === yearFilter);
  });

  const payoutSummary = document.querySelector("#payoutSummary");
  payoutSummary.classList.toggle("market-mode", marketFilter === "all");

  if (marketFilter === "all") {
    payoutSummary.innerHTML = MARKET_CODES.map(market => {
      const records = scopedRecords.filter(payout => eventMarket(eventById(payout.eventId)) === market);
      const total = records.reduce((sum, payout) => sum + payoutAmount(payout), 0);
      const campaigns = new Set(records.map(payout => payout.eventId)).size;
      return `<article class="payout-summary-card market-summary-card">
        <span><b class="market-pill">${market}</b> ${MARKETS[market].name}</span>
        <strong>${formatMoney(total, market)}</strong>
        <small>${records.length} paid record${records.length === 1 ? "" : "s"} · ${campaigns} campaign${campaigns === 1 ? "" : "s"}</small>
      </article>`;
    }).join("");
  } else {
    const paidTotal = scopedRecords.reduce((sum, payout) => sum + payoutAmount(payout), 0);
    const campaignCount = new Set(scopedRecords.map(payout => payout.eventId)).size;
    payoutSummary.innerHTML = [
      ["Actual payout", formatMoney(paidTotal, marketFilter), `${marketFilter} · ${MARKETS[marketFilter].name}`],
      ["Paid records", scopedRecords.length.toLocaleString(), "Automatically created from rewards"],
      ["Campaigns", campaignCount.toLocaleString(), "With paid reward records"]
    ].map(([label, value, detail]) => `<article class="payout-summary-card"><span>${label}</span><strong>${value}</strong><small>${detail}</small></article>`).join("");
  }

  const filtered = scopedRecords.filter(payout => {
    const haystack = `${payout.playerBatch || ""} ${payout.reference || ""} ${payout.type || ""}`.toLowerCase();
    return haystack.includes(search) && (eventId === "all" || payout.eventId === eventId);
  }).sort((a, b) => b.date.localeCompare(a.date));

  document.querySelector("#payoutTable").innerHTML = filtered.map(payout => {
    const campaign = eventById(payout.eventId);
    const market = eventMarket(campaign);
    return `<tr>
      <td><span class="market-pill">${market}</span></td>
      <td>${formatDate(payout.date)}</td>
      <td><strong>${campaign ? escapeHtml(campaign.name) : "Unknown"}</strong><small>${campaign ? escapeHtml(campaign.festival) : ""}</small></td>
      <td><strong>${escapeHtml(payout.playerBatch || "—")}</strong><small>${escapeHtml(payout.type)}</small></td>
      <td><strong>${formatMoney(payoutAmount(payout), market)}</strong><small>Qty ${Number(payout.quantity) || 1}</small></td>
      <td>${escapeHtml(payout.reference || "—")}</td>
      <td><span class="badge paid">Paid</span></td>
      <td>Auto from Issue Reward</td>
      <td><button class="delete-button" data-delete-reward="${payout.sourceRewardId}" aria-label="Delete issued reward" title="Delete issued reward">×</button></td>
    </tr>`;
  }).join("") || `<tr><td colspan="9" class="empty-state">No payout records match these filters.</td></tr>`;

  document.querySelector("#payoutRecordCount").textContent = `Showing ${filtered.length} of ${payoutRecords.length} payout records`;
}

function normalizeBulkHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[()]/g, "")
    .replace(/\s+/g, " ");
}

function bulkCell(row, aliases) {
  const normalized = {};
  Object.entries(row).forEach(([key, value]) => { normalized[normalizeBulkHeader(key)] = value; });
  for (const alias of aliases) {
    const key = normalizeBulkHeader(alias);
    if (Object.prototype.hasOwnProperty.call(normalized, key)) return normalized[key];
  }
  return "";
}

function normalizeRewardType(value) {
  const text = String(value || "").trim().toLowerCase();
  if (["credit", "free credit", "free credits", "bonus credit", "bonus credits"].includes(text)) return "Credit";
  if (["physical", "physical gift", "physical gifts", "gift"].includes(text)) return "Physical";
  return "";
}

function normalizeRewardStatus(value) {
  const text = String(value || "Issued").trim().toLowerCase();
  if (text === "issued") return "Issued";
  if (text === "pending") return "Pending";
  if (text === "delivered") return "Delivered";
  return "";
}

function normalizeBulkDate(value) {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const text = String(value).trim();
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return text;
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return "";
}

function validateBulkRows(rawRows) {
  return rawRows.map((row, index) => {
    const playerId = String(bulkCell(row, ["Player ID", "PlayerID", "Username"]) || "").trim();
    const type = normalizeRewardType(bulkCell(row, ["Reward Type", "Type"]));
    const description = String(bulkCell(row, ["Reward Description", "Description"]) || "").trim();
    const quantity = Number(bulkCell(row, ["Quantity", "Qty"]));
    const unitCost = Number(bulkCell(row, ["Unit Cost RM", "Unit Cost (RM)", "Unit Cost", "Amount RM", "Amount"]));
    const date = normalizeBulkDate(bulkCell(row, ["Date Issued", "Issue Date", "Date"]));
    const status = normalizeRewardStatus(bulkCell(row, ["Status", "Fulfilment", "Fulfillment"]));
    const errors = [];
    if (!playerId) errors.push("Missing Player ID");
    if (!type) errors.push("Invalid Reward Type");
    if (!description) errors.push("Missing Reward Description");
    if (!Number.isInteger(quantity) || quantity < 1) errors.push("Quantity must be 1 or more");
    if (!Number.isFinite(unitCost) || unitCost < 0) errors.push("Unit Cost must be 0 or more");
    if (!date) errors.push("Invalid Date Issued");
    if (!status) errors.push("Invalid Status");

    return {
      rowNumber: index + 2,
      playerId,
      type,
      description,
      quantity,
      unitCost,
      date,
      status: status || "Issued",
      errors
    };
  });
}

function renderBulkPreview() {
  const summary = document.querySelector("#bulkImportSummary");
  const table = document.querySelector("#bulkPreviewTable");
  const confirmButton = document.querySelector("#confirmBulkImportButton");
  const fileLabel = document.querySelector("#bulkFileName");

  const validRows = bulkImportRows.filter(row => row.errors.length === 0);
  const invalidRows = bulkImportRows.filter(row => row.errors.length > 0);

  fileLabel.textContent = bulkImportFileName || "No file selected";
  summary.innerHTML = bulkImportRows.length
    ? `<strong>${bulkImportRows.length} rows detected</strong><span>${validRows.length} ready to import · ${invalidRows.length} with errors</span>`
    : `<strong>No data loaded</strong><span>Upload the completed Excel or CSV template to preview it here.</span>`;

  const selectedCampaign = eventById(document.querySelector("#bulkRewardEventSelect").value);
  const selectedMarket = eventMarket(selectedCampaign);

  table.innerHTML = bulkImportRows.slice(0, 100).map(row => `
    <tr class="${row.errors.length ? "bulk-row-error" : ""}">
      <td>${row.rowNumber}</td>
      <td><strong>${escapeHtml(row.playerId || "—")}</strong></td>
      <td>${escapeHtml(row.type || "—")}</td>
      <td>${escapeHtml(row.description || "—")}</td>
      <td>${Number.isFinite(row.quantity) ? row.quantity : "—"}</td>
      <td>${Number.isFinite(row.unitCost) ? formatMoney(row.unitCost, selectedMarket) : "—"}</td>
      <td>${row.date ? formatDate(row.date) : "—"}</td>
      <td><span class="badge ${row.errors.length ? "cancelled" : "issued"}">${row.errors.length ? escapeHtml(row.errors.join("; ")) : "Ready"}</span></td>
    </tr>`).join("") || `<tr><td colspan="8" class="empty-state">Upload a file to preview reward records.</td></tr>`;

  confirmButton.disabled = validRows.length === 0;
  confirmButton.textContent = validRows.length ? `Import ${validRows.length} valid row${validRows.length === 1 ? "" : "s"}` : "Import valid rows";
}

function openBulkRewardDialog() {
  if (!state.events.length) { showToast("Create a campaign before importing rewards"); return; }
  bulkImportRows = [];
  bulkImportFileName = "";
  const form = document.querySelector("#bulkRewardForm");
  form.reset();
  renderSelects();
  document.querySelector("#bulkRewardEventSelect").value = state.events[0]?.id || "";
  renderBulkPreview();
  openDialog(document.querySelector("#bulkRewardDialog"));
}

async function loadBulkRewardFile(file) {
  if (!file) return;
  if (!window.XLSX) {
    showToast("Excel importer is still loading. Please try again.");
    return;
  }

  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array", cellDates: true });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new Error("No worksheet found");
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      defval: "",
      raw: false,
      dateNF: "yyyy-mm-dd"
    });
    bulkImportRows = validateBulkRows(rows);
    bulkImportFileName = file.name;
    renderBulkPreview();
  } catch (error) {
    bulkImportRows = [];
    bulkImportFileName = "";
    renderBulkPreview();
    showToast("Could not read this file. Please use the template.");
  }
}

function downloadBulkRewardTemplate() {
  if (!window.XLSX) {
    showToast("Excel template generator is still loading. Please try again.");
    return;
  }
  const rows = [
    ["Player ID", "Reward Type", "Reward Description", "Quantity", "Unit Cost", "Date Issued", "Status"],
    ["PL-1028", "Free Credit", "Festival bonus credits", 1, 50, today(), "Issued"]
  ];
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = [
    { wch: 18 }, { wch: 18 }, { wch: 28 }, { wch: 10 },
    { wch: 16 }, { wch: 14 }, { wch: 14 }
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Reward Upload");
  XLSX.writeFile(workbook, "bulk-reward-upload-template.xlsx");
  showToast("Excel template downloaded");
}

function confirmBulkImport() {
  const eventId = document.querySelector("#bulkRewardEventSelect").value;
  const campaign = eventById(eventId);
  if (!campaign) { showToast("Select a campaign"); return; }

  const validRows = bulkImportRows.filter(row => row.errors.length === 0);
  if (!validRows.length) { showToast("There are no valid rows to import"); return; }

  const importStamp = Date.now();
  const rewards = validRows.map((row, index) => ({
    id: `reward-bulk-${importStamp}-${index}`,
    playerId: row.playerId,
    eventId,
    type: row.type,
    description: row.description,
    quantity: row.quantity,
    unitCost: row.unitCost,
    date: row.date,
    status: row.status,
    importBatch: bulkImportFileName
  }));

  state.rewards.push(...rewards);
  saveState();
  document.querySelector("#bulkRewardDialog").close();
  render();
  showToast(`${rewards.length} rewards imported and recorded as paid out`);
}

function setView(view) {
  const titles = { overview: "Campaign overview", events: "Festival events", rewards: "Player rewards", payouts: "Campaign payouts" };
  document.querySelectorAll(".view").forEach(element => element.classList.toggle("active", element.id === `${view}View`));
  document.querySelectorAll(".nav-item").forEach(element => element.classList.toggle("active", element.dataset.view === view));
  document.querySelector("#pageTitle").textContent = titles[view];
  document.querySelector("#sidebar").classList.remove("open");
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2400);
}
function openDialog(dialog) { dialog.showModal(); }

function updateEventCurrencyLabel() {
  const market = document.querySelector("#eventMarketSelect")?.value || "MY";
  const label = document.querySelector("#eventBudgetLabel");
  if (label) label.textContent = `Budget (${marketCurrency(market)})`;
}

function updateRewardCurrencyLabels() {
  const select = document.querySelector("#rewardEventSelect");
  const campaign = eventById(select?.value);
  const market = eventMarket(campaign);
  const label = document.querySelector("#rewardUnitCostLabel");
  if (label) label.textContent = `Unit cost (${marketCurrency(market)})`;
  updateCostPreview();
}

function setEventDialogMode(mode) {
  const isEditing = mode === "edit";
  document.querySelector("#eventDialogEyebrow").textContent = isEditing ? "EDIT CAMPAIGN" : "NEW CAMPAIGN";
  document.querySelector("#eventDialogTitle").textContent = isEditing ? "Edit festival event" : "Create festival event";
  document.querySelector("#eventSubmitButton").textContent = isEditing ? "Save changes" : "Create event";
  document.querySelector("#deleteEventButton").classList.toggle("hidden", !isEditing);
}

function openCreateEventDialog() {
  editingEventId = null;
  const form = document.querySelector("#eventForm");
  form.reset();
  const onEventsView = document.querySelector("#eventsView")?.classList.contains("active");
  const preferredMarket = onEventsView
    ? (selectedEventMarket !== "all" ? selectedEventMarket : "MY")
    : (selectedOverviewMarket !== "all" ? selectedOverviewMarket : "MY");
  form.elements.market.value = preferredMarket;
  updateEventCurrencyLabel();
  setEventDialogMode("create");
  openDialog(document.querySelector("#eventDialog"));
}

function openEditEventDialog(id) {
  const campaign = eventById(id);
  if (!campaign) { showToast("Campaign could not be found"); return; }
  editingEventId = id;
  const form = document.querySelector("#eventForm");
  form.elements.name.value = campaign.name;
  form.elements.market.value = eventMarket(campaign);
  form.elements.festival.value = campaign.festival;
  form.elements.status.value = campaign.status;
  form.elements.festivalDate.value = campaign.festivalDate || "";
  form.elements.budget.value = campaign.budget;
  updateEventCurrencyLabel();
  setEventDialogMode("edit");
  openDialog(document.querySelector("#eventDialog"));
}

function deleteEditingEvent() {
  if (!editingEventId) return;
  const campaign = eventById(editingEventId);
  if (!campaign) { showToast("Campaign could not be found"); return; }

  const attachedRewards = state.rewards.filter(reward => reward.eventId === editingEventId);
  const attachedPayouts = state.payouts.filter(payout => payout.eventId === editingEventId);
  const linkedCount = attachedRewards.length + attachedPayouts.length;
  const message = linkedCount
    ? `Delete "${campaign.name}"? This will also permanently delete ${attachedRewards.length} reward record(s) and ${attachedPayouts.length} payout record(s). This cannot be undone.`
    : `Delete "${campaign.name}"? This cannot be undone.`;

  if (!confirm(message)) return;

  const deletedEventId = editingEventId;
  state.events = state.events.filter(event => event.id !== deletedEventId);
  state.rewards = state.rewards.filter(reward => reward.eventId !== deletedEventId);
  state.payouts = state.payouts.filter(payout => payout.eventId !== deletedEventId);
  saveState();
  document.querySelector("#eventDialog").close();
  render();
  showToast("Campaign deleted");
}

document.addEventListener("click", event => {
  const nav = event.target.closest("[data-view]");
  if (nav) setView(nav.dataset.view);

  const go = event.target.closest("[data-go-view]");
  if (go) setView(go.dataset.goView);

  if (event.target.closest("#openEventButton, .open-event")) openCreateEventDialog();

  const editEventButton = event.target.closest("[data-edit-event]");
  if (editEventButton) openEditEventDialog(editEventButton.dataset.editEvent);

  const eventMarketButton = event.target.closest("[data-event-market]");
  if (eventMarketButton) {
    selectedEventMarket = eventMarketButton.dataset.eventMarket;
    ensureSelectedEventYear();
    renderEventGrid();
  }

  const yearButton = event.target.closest("[data-event-year]");
  if (yearButton) {
    selectedEventYear = yearButton.dataset.eventYear;
    renderEventGrid();
  }

  const overviewMarketButton = event.target.closest("[data-overview-market]");
  if (overviewMarketButton) {
    selectedOverviewMarket = overviewMarketButton.dataset.overviewMarket;
    ensureSelectedOverviewYear();
    renderOverviewMarketTabs();
    renderOverviewYearTabs();
    renderMetrics();
    renderCostChart();
    renderRewardMix();
    renderOverviewEvents();
  }

  const overviewYearButton = event.target.closest("[data-overview-year]");
  if (overviewYearButton) {
    selectedOverviewYear = overviewYearButton.dataset.overviewYear;
    renderOverviewYearTabs();
    renderMetrics();
    renderCostChart();
    renderRewardMix();
    renderOverviewEvents();
  }

  if (event.target.closest("#openBulkRewardButton, .open-bulk-reward")) openBulkRewardDialog();
  if (event.target.closest("#downloadBulkTemplateButton")) downloadBulkRewardTemplate();
  if (event.target.closest("#openClearRecordsButton")) openClearRecordsDialog();

  if (event.target.closest("#openRewardButton, .open-reward")) {
    document.querySelector("#rewardForm [name=date]").value = today();
    renderSelects();
    updateRewardCurrencyLabels();
    openDialog(document.querySelector("#rewardDialog"));
  }

  if (event.target.closest(".close-dialog")) event.target.closest("dialog").close();

  const deleteRewardButton = event.target.closest("[data-delete-reward]");
  if (deleteRewardButton && confirm("Delete this issued reward? Its paid-out record will also be removed. This cannot be undone.")) {
    state.rewards = state.rewards.filter(reward => reward.id !== deleteRewardButton.dataset.deleteReward);
    saveState();
    render();
    showToast("Reward and paid-out record deleted");
  }

});

document.querySelector("#menuButton").addEventListener("click", () => document.querySelector("#sidebar").classList.toggle("open"));
["searchInput", "rewardMarketFilter", "eventFilter", "typeFilter"].forEach(id => document.querySelector(`#${id}`).addEventListener(id === "searchInput" ? "input" : "change", renderRewards));
["eventFestivalFilter", "eventStatusFilter"].forEach(id => document.querySelector(`#${id}`).addEventListener("change", renderEventGrid));
["payoutSearchInput", "payoutMarketFilter", "payoutYearFilter", "payoutEventFilter"].forEach(id => document.querySelector(`#${id}`).addEventListener(id === "payoutSearchInput" ? "input" : "change", renderPayouts));
document.querySelector("#eventMarketSelect").addEventListener("change", updateEventCurrencyLabel);
document.querySelector("#rewardEventSelect").addEventListener("change", updateRewardCurrencyLabels);
document.querySelector("#bulkRewardEventSelect").addEventListener("change", renderBulkPreview);

document.querySelector("#bulkRewardFile").addEventListener("change", event => loadBulkRewardFile(event.target.files?.[0]));
document.querySelector("#confirmBulkImportButton").addEventListener("click", confirmBulkImport);
document.querySelector("#deleteFilteredRewardsButton").addEventListener("click", deleteFilteredRewards);
document.querySelector("#deleteAllRewardsButton").addEventListener("click", deleteAllRewards);

document.querySelector("#eventForm").addEventListener("submit", event => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.currentTarget));

  if (editingEventId) {
    const index = state.events.findIndex(campaign => campaign.id === editingEventId);
    if (index === -1) { showToast("Campaign could not be found"); return; }
    state.events[index] = { ...state.events[index], ...values, market: values.market || "MY", budget: Number(values.budget) };
    selectedEventMarket = eventMarket(state.events[index]);
    selectedOverviewMarket = eventMarket(state.events[index]);
    selectedEventYear = eventYear(state.events[index]) || selectedEventYear;
    selectedOverviewYear = eventYear(state.events[index]) || selectedOverviewYear;
    saveState();
    document.querySelector("#eventDialog").close();
    render();
    showToast("Campaign updated");
    return;
  }

  const newEvent = { ...values, id: `evt-${Date.now()}`, market: values.market || "MY", budget: Number(values.budget) };
  state.events.unshift(newEvent);
  selectedEventMarket = eventMarket(newEvent);
  selectedOverviewMarket = eventMarket(newEvent);
  selectedEventYear = eventYear(newEvent) || selectedEventYear;
  selectedOverviewYear = eventYear(newEvent) || selectedOverviewYear;
  saveState();
  document.querySelector("#eventDialog").close();
  render();
  showToast("Festival event created");
});

document.querySelector("#eventDialog").addEventListener("close", () => {
  editingEventId = null;
  document.querySelector("#eventForm").reset();
  setEventDialogMode("create");
});
document.querySelector("#deleteEventButton").addEventListener("click", deleteEditingEvent);

function updateCostPreview() {
  const form = document.querySelector("#rewardForm");
  if (!form) return;
  const campaign = eventById(form.elements.eventId?.value);
  const market = eventMarket(campaign);
  document.querySelector("#costPreview").textContent = formatMoney(
    Number(form.elements.quantity.value || 0) * Number(form.elements.unitCost.value || 0),
    market
  );
}
document.querySelector("#rewardForm").addEventListener("input", updateCostPreview);
document.querySelector("#rewardType").addEventListener("change", event => {
  document.querySelector("#rewardForm [name=description]").value = event.target.value === "Credit" ? "Bonus credits" : "Festive gift";
});
document.querySelector("#rewardForm").addEventListener("submit", event => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.currentTarget));
  state.rewards.push({ ...values, id: `reward-${Date.now()}`, quantity: Number(values.quantity), unitCost: Number(values.unitCost) });
  saveState();
  event.currentTarget.reset();
  document.querySelector("#rewardDialog").close();
  render();
  showToast("Reward issued and recorded as paid out");
});

document.querySelector("#exportButton").addEventListener("click", () => {
  const headers = ["Record Type", "Market", "Currency", "Player ID", "Event", "Type", "Description", "Quantity", "Amount", "Date", "Status"];
  const rewardRows = state.rewards.map(reward => {
    const campaign = eventById(reward.eventId);
    const market = eventMarket(campaign);
    return [
      "Reward / Paid out", market, marketCurrency(market), reward.playerId, campaign?.name || "", reward.type, reward.description,
      reward.quantity, rewardCost(reward), reward.date, reward.status
    ];
  });
  const csv = [headers, ...rewardRows].map(row => row.map(value => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  link.download = `retention-campaign-data-${today()}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast("CSV export downloaded");
});

render();
initializeSharedStorage();
