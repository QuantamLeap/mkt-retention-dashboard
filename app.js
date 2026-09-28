const STORAGE_KEY = "retainly-dashboard-v1";

const seedData = {
  events: [
    { id: "evt-cny", name: "CNY Lucky Rewards", festival: "CNY", startDate: "2026-02-05", endDate: "2026-02-20", budget: 18000, status: "Completed" },
    { id: "evt-raya", name: "Hari Raya Appreciation", festival: "Hari Raya", startDate: "2026-03-12", endDate: "2026-03-28", budget: 12500, status: "Completed" },
    { id: "evt-diwali", name: "Diwali Festival of Wins", festival: "Diwali", startDate: "2026-10-20", endDate: "2026-11-04", budget: 15000, status: "Planned" },
    { id: "evt-xmas", name: "Christmas Countdown", festival: "Christmas", startDate: "2026-12-10", endDate: "2026-12-26", budget: 22000, status: "Planned" },
    { id: "evt-moon", name: "Mid-Autumn VIP Night", festival: "Mid-Autumn", startDate: "2026-09-18", endDate: "2026-10-02", budget: 9000, status: "Active" }
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

const money = new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", currencyDisplay: "narrowSymbol", maximumFractionDigits: 0 });
const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });

function loadState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!stored) return structuredClone(seedData);
    return {
      events: Array.isArray(stored.events) ? stored.events : [],
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
function eventAdditionalPaidPayout(id) { return state.payouts.filter(payout => payout.eventId === id && payout.status === "Paid").reduce((sum, payout) => sum + payoutAmount(payout), 0); }
function eventPaidPayout(id) { return eventRewardValue(id) + eventAdditionalPaidPayout(id); }
function eventPendingPayout(id) { return state.payouts.filter(payout => payout.eventId === id && payout.status === "Pending").reduce((sum, payout) => sum + payoutAmount(payout), 0); }
function rewardPayoutRecord(reward) {
  return {
    id: `reward-payout-${reward.id}`,
    eventId: reward.eventId,
    date: reward.date,
    type: reward.type === "Credit" ? "Free Credit" : "Physical Gift",
    amount: rewardCost(reward),
    quantity: Number(reward.quantity) || 1,
    playerBatch: reward.playerId,
    reference: reward.description || "Issued reward",
    status: "Paid",
    recordedBy: "Issue Reward",
    notes: "Automatically recorded as paid out when the reward was issued.",
    sourceRewardId: reward.id,
    isRewardPayout: true
  };
}
function allPayoutRecords() {
  return [...state.rewards.map(rewardPayoutRecord), ...state.payouts];
}
function eventRecipients(id) { return new Set(state.rewards.filter(reward => reward.eventId === id).map(reward => reward.playerId)).size; }
function formatDate(value) { return value ? dateFormat.format(new Date(`${value}T00:00:00`)) : "—"; }
function initials(name) { return String(name || "?").split(" ").map(part => part[0]).slice(0, 2).join("").toUpperCase(); }
function escapeHtml(value) { const element = document.createElement("div"); element.textContent = String(value ?? ""); return element.innerHTML; }
function today() { return new Date().toISOString().slice(0, 10); }

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
  const rewardValue = state.rewards.reduce((sum, reward) => sum + rewardCost(reward), 0);
  const paid = state.events.reduce((sum, campaign) => sum + eventPaidPayout(campaign.id), 0);
  const recipients = new Set(state.rewards.map(reward => reward.playerId)).size;
  const active = state.events.filter(event => event.status === "Active").length;
  const metrics = [
    ["Rewards issued", money.format(rewardValue), `${state.rewards.length} reward records`, "+", "#d54d3f"],
    ["Actual payout", money.format(paid), `${state.rewards.length + state.payouts.filter(p => p.status === "Paid").length} paid records`, "RM", "#28755a"],
    ["Unique recipients", recipients.toLocaleString(), "Across all festival events", "◎", "#3d6781"],
    ["Events tracked", state.events.length, `${active} currently active`, "◇", "#a56c19"]
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
    <div class="mix-total"><strong>${money.format(total)}</strong><span>Total reward value</span></div>
    <div class="mix-row"><div class="mix-line"><span>Free credits</span><span>${creditPct}% · ${money.format(credit)}</span></div><div class="mix-track"><div class="mix-fill" style="width:${creditPct}%"></div></div></div>
    <div class="mix-row"><div class="mix-line"><span>Physical gifts</span><span>${100 - creditPct}% · ${money.format(physical)}</span></div><div class="mix-track"><div class="mix-fill physical" style="width:${100 - creditPct}%"></div></div></div>`;
}

function eventRow(event) {
  return `<tr><td><strong>${escapeHtml(event.name)}</strong><small>${escapeHtml(event.festival)}</small></td><td>${formatDate(event.startDate)}<br><small>to ${formatDate(event.endDate)}</small></td><td>${eventRecipients(event.id)}</td><td>${money.format(event.budget)}</td><td><strong>${money.format(eventRewardValue(event.id))}</strong></td><td><strong>${money.format(eventPaidPayout(event.id))}</strong></td><td><span class="badge ${event.status.toLowerCase()}">${event.status}</span></td></tr>`;
}

function renderOverviewEvents() {
  document.querySelector("#overviewEvents").innerHTML = state.events.slice(0, 5).map(eventRow).join("") || `<tr><td colspan="7" class="empty-state">No events yet.</td></tr>`;
}

function renderEventGrid() {
  document.querySelector("#eventGrid").innerHTML = state.events.map(event => {
    const rewards = eventRewardValue(event.id);
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
      <p>${formatDate(event.startDate)} – ${formatDate(event.endDate)}</p>
      <div class="event-stats event-stats-three">
        <div class="event-stat"><span>Recipients</span><strong>${eventRecipients(event.id)}</strong></div>
        <div class="event-stat"><span>Rewards</span><strong>${money.format(rewards)}</strong></div>
        <div class="event-stat"><span>Paid out</span><strong>${money.format(paid)}</strong></div>
      </div>
      <div class="budget-track"><div class="budget-fill ${used > 100 ? "over" : ""}" style="width:${Math.min(Math.max(used, 0), 100)}%"></div></div>
      <div class="budget-text"><span>${used}% paid</span><span>${money.format(remaining)} remaining</span></div>
      <button class="button secondary event-payout-button" type="button" data-record-payout="${escapeHtml(event.id)}">＋ Additional payout</button>
    </article>`;
  }).join("") || `<p class="empty-state">Create your first event to get started.</p>`;
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
  document.querySelector("#payoutEventSelect").innerHTML = options;
}

function renderRewards() {
  const search = document.querySelector("#searchInput").value.toLowerCase();
  const eventId = document.querySelector("#eventFilter").value;
  const type = document.querySelector("#typeFilter").value;
  const filtered = state.rewards.filter(reward => {
    const playerMatch = String(reward.playerId || "").toLowerCase().includes(search);
    return playerMatch && (eventId === "all" || reward.eventId === eventId) && (type === "all" || reward.type === type);
  }).sort((a, b) => b.date.localeCompare(a.date));

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

function renderPayouts() {
  const search = document.querySelector("#payoutSearchInput").value.toLowerCase();
  const eventId = document.querySelector("#payoutEventFilter").value;
  const status = document.querySelector("#payoutStatusFilter").value;
  const payoutRecords = allPayoutRecords();

  const paidTotal = payoutRecords.filter(p => p.status === "Paid").reduce((sum, p) => sum + payoutAmount(p), 0);
  const pendingTotal = payoutRecords.filter(p => p.status === "Pending").reduce((sum, p) => sum + payoutAmount(p), 0);
  const cancelledTotal = payoutRecords.filter(p => p.status === "Cancelled").reduce((sum, p) => sum + payoutAmount(p), 0);

  document.querySelector("#payoutSummary").innerHTML = [
    ["Actual payout", money.format(paidTotal), "Issued rewards + additional paid payouts"],
    ["Pending payout", money.format(pendingTotal), "Additional payouts awaiting completion"],
    ["Cancelled", money.format(cancelledTotal), "Cancelled additional payouts"]
  ].map(([label, value, detail]) => `<article class="payout-summary-card"><span>${label}</span><strong>${value}</strong><small>${detail}</small></article>`).join("");

  const filtered = payoutRecords.filter(payout => {
    const haystack = `${payout.playerBatch || ""} ${payout.reference || ""} ${payout.type || ""} ${payout.recordedBy || ""}`.toLowerCase();
    return haystack.includes(search) && (eventId === "all" || payout.eventId === eventId) && (status === "all" || payout.status === status);
  }).sort((a, b) => b.date.localeCompare(a.date));

  document.querySelector("#payoutTable").innerHTML = filtered.map(payout => {
    const campaign = eventById(payout.eventId);
    const action = payout.isRewardPayout
      ? `<button class="delete-button" data-delete-reward="${payout.sourceRewardId}" aria-label="Delete issued reward" title="Delete issued reward">×</button>`
      : `<button class="delete-button" data-delete-payout="${payout.id}" aria-label="Delete payout" title="Delete payout">×</button>`;
    const sourceLabel = payout.isRewardPayout ? "Auto from Issue Reward" : (payout.recordedBy || "Manual payout");
    return `<tr>
      <td>${formatDate(payout.date)}</td>
      <td><strong>${campaign ? escapeHtml(campaign.name) : "Unknown"}</strong></td>
      <td><strong>${escapeHtml(payout.playerBatch || "—")}</strong><small>${escapeHtml(payout.type)}</small></td>
      <td><strong>${money.format(payoutAmount(payout))}</strong><small>Qty ${Number(payout.quantity) || 1}</small></td>
      <td>${escapeHtml(payout.reference || "—")}</td>
      <td><span class="badge ${payout.status.toLowerCase()}">${payout.status}</span></td>
      <td>${escapeHtml(sourceLabel)}</td>
      <td>${action}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="8" class="empty-state">No payout records match these filters.</td></tr>`;

  document.querySelector("#payoutRecordCount").textContent = `Showing ${filtered.length} of ${payoutRecords.length} payout records`;
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
  form.elements.startDate.value = campaign.startDate;
  form.elements.endDate.value = campaign.endDate;
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

function openPayoutDialog(eventId = "") {
  const form = document.querySelector("#payoutForm");
  form.reset();
  form.elements.date.value = today();
  form.elements.quantity.value = 1;
  form.elements.status.value = "Paid";
  renderSelects();
  if (eventId && eventById(eventId)) form.elements.eventId.value = eventId;
  openDialog(document.querySelector("#payoutDialog"));
}

document.addEventListener("click", event => {
  const nav = event.target.closest("[data-view]");
  if (nav) setView(nav.dataset.view);

  const go = event.target.closest("[data-go-view]");
  if (go) setView(go.dataset.goView);

  if (event.target.closest("#openEventButton, .open-event")) openCreateEventDialog();

  const editEventButton = event.target.closest("[data-edit-event]");
  if (editEventButton) openEditEventDialog(editEventButton.dataset.editEvent);

  const payoutButton = event.target.closest("[data-record-payout]");
  if (payoutButton) openPayoutDialog(payoutButton.dataset.recordPayout);

  if (event.target.closest("#openPayoutButton, .open-payout")) openPayoutDialog();

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

  const deletePayoutButton = event.target.closest("[data-delete-payout]");
  if (deletePayoutButton && confirm("Delete this payout record? This cannot be undone.")) {
    state.payouts = state.payouts.filter(payout => payout.id !== deletePayoutButton.dataset.deletePayout);
    saveState();
    render();
    showToast("Payout record deleted");
  }
});

document.querySelector("#menuButton").addEventListener("click", () => document.querySelector("#sidebar").classList.toggle("open"));
["searchInput", "eventFilter", "typeFilter"].forEach(id => document.querySelector(`#${id}`).addEventListener(id === "searchInput" ? "input" : "change", renderRewards));
["payoutSearchInput", "payoutEventFilter", "payoutStatusFilter"].forEach(id => document.querySelector(`#${id}`).addEventListener(id === "payoutSearchInput" ? "input" : "change", renderPayouts));

document.querySelector("#eventForm").addEventListener("submit", event => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.currentTarget));
  if (values.endDate < values.startDate) { showToast("End date must be after start date"); return; }

  if (editingEventId) {
    const index = state.events.findIndex(campaign => campaign.id === editingEventId);
    if (index === -1) { showToast("Campaign could not be found"); return; }
    state.events[index] = { ...state.events[index], ...values, budget: Number(values.budget) };
    saveState();
    document.querySelector("#eventDialog").close();
    render();
    showToast("Campaign updated");
    return;
  }

  state.events.unshift({ ...values, id: `evt-${Date.now()}`, budget: Number(values.budget) });
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

document.querySelector("#payoutForm").addEventListener("submit", event => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.currentTarget));
  state.payouts.push({
    ...values,
    id: `payout-${Date.now()}`,
    amount: Number(values.amount),
    quantity: Number(values.quantity || 1)
  });
  saveState();
  event.currentTarget.reset();
  document.querySelector("#payoutDialog").close();
  render();
  showToast("Payout record saved");
});

document.querySelector("#exportButton").addEventListener("click", () => {
  const headers = ["Record Type", "Player ID / Batch", "Event", "Type", "Description / Reference", "Quantity", "Amount (RM)", "Date", "Status", "Recorded By"];
  const rewardRows = state.rewards.map(reward => [
    "Reward / Paid out", reward.playerId, eventById(reward.eventId)?.name || "", reward.type, reward.description,
    reward.quantity, rewardCost(reward), reward.date, reward.status, ""
  ]);
  const payoutRows = state.payouts.map(payout => [
    "Payout", payout.playerBatch || "", eventById(payout.eventId)?.name || "", payout.type, payout.reference || "",
    payout.quantity || 1, payout.amount, payout.date, payout.status, payout.recordedBy || ""
  ]);
  const csv = [headers, ...rewardRows, ...payoutRows].map(row => row.map(value => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  link.download = `retention-campaign-data-${today()}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast("CSV export downloaded");
});

render();
