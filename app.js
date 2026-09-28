const STORAGE_KEY = "retainly-dashboard-v1";

const seedData = {
  events: [
    { id: "evt-cny", name: "CNY Lucky Rewards", festival: "CNY", festivalDate: "2026-02-17", budget: 18000, status: "Completed" },
    { id: "evt-raya", name: "Hari Raya Appreciation", festival: "Hari Raya", festivalDate: "2026-03-20", budget: 12500, status: "Completed" },
    { id: "evt-diwali", name: "Diwali Festival of Wins", festival: "Diwali", festivalDate: "2026-11-08", budget: 15000, status: "Planned" },
    { id: "evt-xmas", name: "Christmas Countdown", festival: "Christmas", festivalDate: "2026-12-25", budget: 22000, status: "Planned" },
    { id: "evt-moon", name: "Mid-Autumn VIP Night", festival: "Mid-Autumn", festivalDate: "2026-09-25", budget: 9000, status: "Planned" }
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

let state = loadState();
let editingEventId = null;
let selectedEventYear = null;
let bulkImportRows = [];
let bulkImportFileName = "";

const money = new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", currencyDisplay: "narrowSymbol", maximumFractionDigits: 0 });
const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });

function normalizeEvent(event) {
  const { startDate, endDate, ...rest } = event;
  const status = event.status === "Active"
    ? "Planned"
    : ["Unplan", "Planned", "Completed"].includes(event.status)
      ? event.status
      : "Unplan";

  return {
    ...rest,
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

function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
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
  const years = availableEventYears();
  if (!years.length) { selectedEventYear = "all"; return; }
  if (selectedEventYear === "all" || years.includes(String(selectedEventYear))) return;
  const currentYear = String(new Date().getFullYear());
  selectedEventYear = years.includes(currentYear) ? currentYear : years[0];
}

function render() {
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
  const paid = state.events.reduce((sum, campaign) => sum + eventPaidPayout(campaign.id), 0);
  const recipients = new Set(state.rewards.map(reward => reward.playerId)).size;
  const planned = state.events.filter(event => event.status === "Planned").length;
  const metrics = [
    ["Actual payout", money.format(paid), `${state.rewards.length} paid reward records`, "RM", "#28755a"],
    ["Unique recipients", recipients.toLocaleString(), "Across all festival events", "◎", "#3d6781"],
    ["Events tracked", state.events.length, `${planned} planned`, "◇", "#a56c19"]
  ];
  document.querySelector("#metricGrid").innerHTML = metrics.map(([label, value, detail, symbol, tone]) => `
    <article class="metric-card" style="--tone:${tone}"><div class="metric-label"><span>${label}</span><span class="metric-symbol">${symbol}</span></div><div class="metric-value">${value}</div><div class="metric-detail">${detail}</div></article>`).join("");
}

function renderCostChart() {
  const values = state.events.map(event => ({ event, cost: eventPaidPayout(event.id) }));
  const max = Math.max(...values.map(item => item.cost), 1);
  const average = values.reduce((sum, item) => sum + item.cost, 0) / Math.max(values.length, 1);
  document.querySelector("#averageCost").textContent = `Average ${money.format(average)}`;
  document.querySelector("#costChart").innerHTML = values.map(({ event, cost }) => `
    <div class="bar-column" title="${escapeHtml(event.name)}: ${money.format(cost)}"><span class="bar-value">${money.format(cost)}</span><div class="bar" style="height:${Math.max((cost / max) * 150, 4)}px"></div><span class="bar-label">${escapeHtml(event.festival)}</span></div>`).join("");
}

function renderRewardMix() {
  const total = state.rewards.reduce((sum, reward) => sum + rewardCost(reward), 0);
  const credit = state.rewards.filter(reward => reward.type === "Credit").reduce((sum, reward) => sum + rewardCost(reward), 0);
  const physical = total - credit;
  const creditPct = total ? Math.round(credit / total * 100) : 0;
  document.querySelector("#rewardMix").innerHTML = `
    <div class="mix-total"><strong>${money.format(total)}</strong><span>Total paid out</span></div>
    <div class="mix-row"><div class="mix-line"><span>Free credits</span><span>${creditPct}% · ${money.format(credit)}</span></div><div class="mix-track"><div class="mix-fill" style="width:${creditPct}%"></div></div></div>
    <div class="mix-row"><div class="mix-line"><span>Physical gifts</span><span>${100 - creditPct}% · ${money.format(physical)}</span></div><div class="mix-track"><div class="mix-fill physical" style="width:${100 - creditPct}%"></div></div></div>`;
}

function eventRow(event) {
  return `<tr><td><strong>${escapeHtml(event.name)}</strong><small>${escapeHtml(event.festival)}</small></td><td>${formatDate(event.festivalDate)}</td><td>${eventRecipients(event.id)}</td><td>${money.format(event.budget)}</td><td><strong>${money.format(eventPaidPayout(event.id))}</strong></td><td><span class="badge ${event.status.toLowerCase()}">${event.status}</span></td></tr>`;
}

function renderOverviewEvents() {
  document.querySelector("#overviewEvents").innerHTML = state.events.slice(0, 5).map(eventRow).join("") || `<tr><td colspan="6" class="empty-state">No events yet.</td></tr>`;
}

function renderEventGrid() {
  ensureSelectedEventYear();

  const years = availableEventYears();
  const yearTabs = document.querySelector("#eventYearTabs");
  yearTabs.innerHTML = [
    ...years.map(year => `<button type="button" class="year-tab ${String(selectedEventYear) === year ? "active" : ""}" data-event-year="${year}">${year}</button>`),
    `<button type="button" class="year-tab ${selectedEventYear === "all" ? "active" : ""}" data-event-year="all">All Years</button>`
  ].join("");

  const festival = document.querySelector("#eventFestivalFilter").value;
  const status = document.querySelector("#eventStatusFilter").value;

  const filteredEvents = state.events
    .filter(event => selectedEventYear === "all" || eventYear(event) === String(selectedEventYear))
    .filter(event => festival === "all" || event.festival === festival)
    .filter(event => status === "all" || event.status === status)
    .sort((a, b) => String(a.festivalDate || "").localeCompare(String(b.festivalDate || "")));

  document.querySelector("#eventFilterCount").textContent = `Showing ${filteredEvents.length} of ${state.events.length} events`;

  document.querySelector("#eventGrid").innerHTML = filteredEvents.map(event => {
    const paid = eventPaidPayout(event.id);
    const remaining = Number(event.budget) - paid;
    const used = event.budget ? Math.round(paid / Number(event.budget) * 100) : 0;
    return `<article class="event-card">
      <div class="event-card-top">
        <div class="festival-mark">${escapeHtml(event.festival.slice(0, 3).toUpperCase())}</div>
        <div class="event-card-actions">
          <span class="badge ${event.status.toLowerCase()}">${event.status}</span>
          <button class="event-edit-button" type="button" data-edit-event="${escapeHtml(event.id)}">Edit</button>
        </div>
      </div>
      <h3>${escapeHtml(event.name)}</h3>
      <p>Festival date · ${formatDate(event.festivalDate)}</p>
      <div class="event-stats event-stats-three">
        <div class="event-stat"><span>Recipients</span><strong>${eventRecipients(event.id)}</strong></div>
        <div class="event-stat"><span>Budget</span><strong>${money.format(Number(event.budget) || 0)}</strong></div>
        <div class="event-stat"><span>Paid out</span><strong>${money.format(paid)}</strong></div>
      </div>
      <div class="budget-track"><div class="budget-fill ${used > 100 ? "over" : ""}" style="width:${Math.min(Math.max(used, 0), 100)}%"></div></div>
      <div class="budget-text"><span>${used}% paid</span><span>${money.format(remaining)} remaining</span></div>
    </article>`;
  }).join("") || `<div class="event-empty-state"><strong>No events found</strong><span>Try another year, festival, or status filter.</span></div>`;
}

function renderSelects() {
  const options = state.events.map(event => `<option value="${event.id}">${escapeHtml(event.name)}</option>`).join("");

  const eventFilter = document.querySelector("#eventFilter");
  const currentRewardFilter = eventFilter.value;
  eventFilter.innerHTML = `<option value="all">All events</option>${options}`;
  if (["all", ...state.events.map(event => event.id)].includes(currentRewardFilter)) eventFilter.value = currentRewardFilter;

  const payoutEventFilter = document.querySelector("#payoutEventFilter");
  const currentPayoutFilter = payoutEventFilter.value;
  payoutEventFilter.innerHTML = `<option value="all">All campaigns</option>${options}`;
  if (["all", ...state.events.map(event => event.id)].includes(currentPayoutFilter)) payoutEventFilter.value = currentPayoutFilter;

  document.querySelector("#rewardEventSelect").innerHTML = options;
  document.querySelector("#bulkRewardEventSelect").innerHTML = options;
}

function getFilteredRewards() {
  const search = document.querySelector("#searchInput").value.toLowerCase();
  const eventId = document.querySelector("#eventFilter").value;
  const type = document.querySelector("#typeFilter").value;

  return state.rewards.filter(reward => {
    const playerMatch = String(reward.playerId || "").toLowerCase().includes(search);
    return playerMatch && (eventId === "all" || reward.eventId === eventId) && (type === "all" || reward.type === type);
  }).sort((a, b) => b.date.localeCompare(a.date));
}

function renderRewards() {
  const filtered = getFilteredRewards();

  document.querySelector("#rewardTable").innerHTML = filtered.map(reward => {
    const event = eventById(reward.eventId);
    return `<tr>
      <td><div class="player-cell"><span class="avatar">ID</span><div><strong>${escapeHtml(reward.playerId)}</strong></div></div></td>
      <td>${event ? escapeHtml(event.name) : "Unknown"}</td>
      <td><strong>${escapeHtml(reward.description)}</strong><small>${reward.type === "Credit" ? "Free credit" : "Physical gift"} · Qty ${reward.quantity}</small></td>
      <td><strong>${money.format(rewardCost(reward))}</strong><small>${money.format(reward.unitCost)} each</small></td>
      <td>${formatDate(reward.date)}</td>
      <td><span class="badge ${reward.status.toLowerCase()}">${reward.status}</span></td>
      <td><button class="delete-button" data-delete-reward="${reward.id}" aria-label="Delete reward" title="Delete reward">×</button></td>
    </tr>`;
  }).join("") || `<tr><td colspan="7" class="empty-state">No reward records match these filters.</td></tr>`;

  document.querySelector("#recordCount").textContent = `Showing ${filtered.length} of ${state.rewards.length} reward records`;
}

function updateClearRecordsDialog() {
  const filtered = getFilteredRewards();
  const filteredValue = filtered.reduce((sum, reward) => sum + rewardCost(reward), 0);
  const totalValue = state.rewards.reduce((sum, reward) => sum + rewardCost(reward), 0);

  document.querySelector("#clearFilteredCount").textContent = filtered.length.toLocaleString();
  document.querySelector("#clearFilteredValue").textContent = money.format(filteredValue);
  document.querySelector("#clearAllCount").textContent = state.rewards.length.toLocaleString();
  document.querySelector("#clearAllValue").textContent = money.format(totalValue);

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

  const value = filtered.reduce((sum, reward) => sum + rewardCost(reward), 0);
  const eventId = document.querySelector("#eventFilter").value;
  const eventName = eventId === "all" ? "the current filtered view" : (eventById(eventId)?.name || "the selected campaign");
  const message = `Delete ${filtered.length} reward record${filtered.length === 1 ? "" : "s"} from ${eventName}? This will also remove ${money.format(value)} from Paid Out. This cannot be undone.`;

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
  const value = state.rewards.reduce((sum, reward) => sum + rewardCost(reward), 0);
  const message = `Delete all ${count} reward records? This will also remove ${money.format(value)} from Paid Out across all campaigns. This cannot be undone.`;

  if (!confirm(message)) return;

  state.rewards = [];
  saveState();
  document.querySelector("#clearRecordsDialog").close();
  render();
  showToast("All reward records deleted");
}

function renderPayouts() {
  const search = document.querySelector("#payoutSearchInput").value.toLowerCase();
  const eventId = document.querySelector("#payoutEventFilter").value;
  const payoutRecords = allPayoutRecords();

  const paidTotal = payoutRecords.reduce((sum, payout) => sum + payoutAmount(payout), 0);
  const campaignCount = new Set(payoutRecords.map(payout => payout.eventId)).size;

  document.querySelector("#payoutSummary").innerHTML = [
    ["Actual payout", money.format(paidTotal), "All issued rewards"],
    ["Paid records", payoutRecords.length.toLocaleString(), "Automatically created from rewards"],
    ["Campaigns", campaignCount.toLocaleString(), "With paid reward records"]
  ].map(([label, value, detail]) => `<article class="payout-summary-card"><span>${label}</span><strong>${value}</strong><small>${detail}</small></article>`).join("");

  const filtered = payoutRecords.filter(payout => {
    const haystack = `${payout.playerBatch || ""} ${payout.reference || ""} ${payout.type || ""}`.toLowerCase();
    return haystack.includes(search) && (eventId === "all" || payout.eventId === eventId);
  }).sort((a, b) => b.date.localeCompare(a.date));

  document.querySelector("#payoutTable").innerHTML = filtered.map(payout => {
    const campaign = eventById(payout.eventId);
    return `<tr>
      <td>${formatDate(payout.date)}</td>
      <td><strong>${campaign ? escapeHtml(campaign.name) : "Unknown"}</strong></td>
      <td><strong>${escapeHtml(payout.playerBatch || "—")}</strong><small>${escapeHtml(payout.type)}</small></td>
      <td><strong>${money.format(payoutAmount(payout))}</strong><small>Qty ${Number(payout.quantity) || 1}</small></td>
      <td>${escapeHtml(payout.reference || "—")}</td>
      <td><span class="badge paid">Paid</span></td>
      <td>Auto from Issue Reward</td>
      <td><button class="delete-button" data-delete-reward="${payout.sourceRewardId}" aria-label="Delete issued reward" title="Delete issued reward">×</button></td>
    </tr>`;
  }).join("") || `<tr><td colspan="8" class="empty-state">No payout records match these filters.</td></tr>`;

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

  table.innerHTML = bulkImportRows.slice(0, 100).map(row => `
    <tr class="${row.errors.length ? "bulk-row-error" : ""}">
      <td>${row.rowNumber}</td>
      <td><strong>${escapeHtml(row.playerId || "—")}</strong></td>
      <td>${escapeHtml(row.type || "—")}</td>
      <td>${escapeHtml(row.description || "—")}</td>
      <td>${Number.isFinite(row.quantity) ? row.quantity : "—"}</td>
      <td>${Number.isFinite(row.unitCost) ? money.format(row.unitCost) : "—"}</td>
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
    ["Player ID", "Reward Type", "Reward Description", "Quantity", "Unit Cost (RM)", "Date Issued", "Status"],
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

function setEventDialogMode(mode) {
  const isEditing = mode === "edit";
  document.querySelector("#eventDialogEyebrow").textContent = isEditing ? "EDIT CAMPAIGN" : "NEW CAMPAIGN";
  document.querySelector("#eventDialogTitle").textContent = isEditing ? "Edit festival event" : "Create festival event";
  document.querySelector("#eventSubmitButton").textContent = isEditing ? "Save changes" : "Create event";
  document.querySelector("#deleteEventButton").classList.toggle("hidden", !isEditing);
}

function openCreateEventDialog() {
  editingEventId = null;
  document.querySelector("#eventForm").reset();
  setEventDialogMode("create");
  openDialog(document.querySelector("#eventDialog"));
}

function openEditEventDialog(id) {
  const campaign = eventById(id);
  if (!campaign) { showToast("Campaign could not be found"); return; }
  editingEventId = id;
  const form = document.querySelector("#eventForm");
  form.elements.name.value = campaign.name;
  form.elements.festival.value = campaign.festival;
  form.elements.status.value = campaign.status;
  form.elements.festivalDate.value = campaign.festivalDate || "";
  form.elements.budget.value = campaign.budget;
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

  const yearButton = event.target.closest("[data-event-year]");
  if (yearButton) {
    selectedEventYear = yearButton.dataset.eventYear;
    renderEventGrid();
  }

  if (event.target.closest("#openBulkRewardButton, .open-bulk-reward")) openBulkRewardDialog();
  if (event.target.closest("#downloadBulkTemplateButton")) downloadBulkRewardTemplate();
  if (event.target.closest("#openClearRecordsButton")) openClearRecordsDialog();

  if (event.target.closest("#openRewardButton, .open-reward")) {
    document.querySelector("#rewardForm [name=date]").value = today();
    updateCostPreview();
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
["searchInput", "eventFilter", "typeFilter"].forEach(id => document.querySelector(`#${id}`).addEventListener(id === "searchInput" ? "input" : "change", renderRewards));
["eventFestivalFilter", "eventStatusFilter"].forEach(id => document.querySelector(`#${id}`).addEventListener("change", renderEventGrid));
["payoutSearchInput", "payoutEventFilter"].forEach(id => document.querySelector(`#${id}`).addEventListener(id === "payoutSearchInput" ? "input" : "change", renderPayouts));

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
    state.events[index] = { ...state.events[index], ...values, budget: Number(values.budget) };
    selectedEventYear = eventYear(state.events[index]) || selectedEventYear;
    saveState();
    document.querySelector("#eventDialog").close();
    render();
    showToast("Campaign updated");
    return;
  }

  const newEvent = { ...values, id: `evt-${Date.now()}`, budget: Number(values.budget) };
  state.events.unshift(newEvent);
  selectedEventYear = eventYear(newEvent) || selectedEventYear;
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
  document.querySelector("#costPreview").textContent = money.format(Number(form.elements.quantity.value || 0) * Number(form.elements.unitCost.value || 0));
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
  const headers = ["Record Type", "Player ID / Batch", "Event", "Type", "Description / Reference", "Quantity", "Amount (RM)", "Date", "Status", "Recorded By"];
  const rewardRows = state.rewards.map(reward => [
    "Reward / Paid out", reward.playerId, eventById(reward.eventId)?.name || "", reward.type, reward.description,
    reward.quantity, rewardCost(reward), reward.date, reward.status, ""
  ]);
  const csv = [headers, ...rewardRows].map(row => row.map(value => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  link.download = `retention-campaign-data-${today()}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast("CSV export downloaded");
});

render();
