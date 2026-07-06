const GB_PER_TB = 1024;
const currencies = {
  AUD: { rate: 1.44279325, locale: "en-AU" },
  USD: { rate: 1, locale: "en-US" },
  EUR: { rate: 0.87534266, locale: "en-IE" },
  GBP: { rate: 0.74981965, locale: "en-GB" },
  NZD: { rate: 1.75934209, locale: "en-NZ" },
  SGD: { rate: 1.29317559, locale: "en-SG" },
  CAD: { rate: 1.42115135, locale: "en-CA" },
  JPY: { rate: 162.08339345, locale: "ja-JP" }
};
const rates = {
  standard: { name: "Standard", storage: 0.0255, retrieval: 0, minimum: 0, note: "Immediate, frequent access" },
  infrequent: { name: "Infrequent Access", storage: 0.01, retrieval: 0.01, minimum: 31, note: "Immediate, occasional access" },
  archive: { name: "Archive", storage: 0.0026, retrieval: 0, minimum: 90, note: "Offline, rarely accessed" }
};
const presets = {
  active: { storage: 10, read: 2, egress: 2, requests: 2000000, deleted: 0, age: 90, restoreDays: 1 },
  backup: { storage: 50, read: 0.5, egress: 0.2, requests: 250000, deleted: 5, age: 45, restoreDays: 2 },
  logs: { storage: 100, read: 0.1, egress: 0, requests: 1000000, deleted: 8, age: 365, restoreDays: 3 }
};
const ids = ["storage", "read", "egress", "requests", "deleted", "age", "restoreDays"];
const els = Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));
const currencySelect = document.getElementById("currency");
let selectedCurrency = localStorage.getItem("oci-cost-currency") || "AUD";
if (!currencies[selectedCurrency]) selectedCurrency = "AUD";
currencySelect.value = selectedCurrency;

function formatMoney(valueUsd, unitRate = false) {
  const currency = currencies[selectedCurrency];
  return new Intl.NumberFormat(currency.locale, {
    style: "currency",
    currency: selectedCurrency,
    currencyDisplay: "code",
    minimumFractionDigits: unitRate ? 4 : 2,
    maximumFractionDigits: unitRate ? 5 : 2
  }).format(valueUsd * currency.rate);
}

function calculate(key) {
  const rate = rates[key];
  const storageGb = Number(els.storage.value) * GB_PER_TB;
  const readGb = Number(els.read.value) * GB_PER_TB;
  const egressGb = Number(els.egress.value) * GB_PER_TB;
  const deletedGb = Number(els.deleted.value) * GB_PER_TB;
  const age = Number(els.age.value);
  const storage = Math.max(0, storageGb - 10) * rate.storage;
  const requests = Math.max(0, Number(els.requests.value) - 50000) / 10000 * 0.0034;
  const egress = Math.max(0, egressGb - 10 * GB_PER_TB) * 0.0085;
  const retrieval = key === "infrequent" ? Math.max(0, readGb - 10) * rate.retrieval : 0;
  const restore = key === "archive" ? readGb * rates.standard.storage * (Number(els.restoreDays.value) / 30.4) : 0;
  const remainingDays = Math.max(0, rate.minimum - age);
  const earlyDelete = deletedGb * rate.storage * (remainingDays / 30.4);
  const total = storage + requests + egress + retrieval + restore + earlyDelete;
  return { storage, requests, egress, retrieval, restore, earlyDelete, total };
}

function render() {
  renderCurrencyMeta();
  const storage = Number(els.storage.value);
  document.getElementById("storageOut").textContent = storage >= 1000 ? "1 PB" : `${storage.toLocaleString()} TB`;
  els.storage.style.setProperty("--progress", `${storage / 10}%`);

  const results = Object.fromEntries(Object.keys(rates).map(key => [key, calculate(key)]));
  const winnerKey = Object.keys(results).sort((a,b) => results[a].total - results[b].total)[0];
  const winner = results[winnerKey];
  document.getElementById("winnerName").textContent = rates[winnerKey].name;
  document.getElementById("winnerCost").textContent = formatMoney(winner.total);
  document.getElementById("winnerBreakdown").innerHTML = breakdownRows(winner);
  document.getElementById("winnerReason").textContent = winnerReason(winnerKey, results);

  const max = Math.max(...Object.values(results).map(result => result.total), 1);
  document.getElementById("tierCards").innerHTML = Object.entries(rates).map(([key, rate]) => {
    const result = results[key];
    return `<article class="tier-card ${key === winnerKey ? "best" : ""}">
      <div class="tier-top"><h3>${rate.name}</h3>${key === winnerKey ? '<span class="badge">Lowest cost</span>' : ''}</div>
      <div class="tier-cost">${formatMoney(result.total)}</div><div class="tier-rate">per month · ${formatMoney(rate.storage, true)}/GB stored</div>
      <div class="bar-track"><div class="bar" style="width:${Math.max(1, result.total / max * 100)}%"></div></div>
      <ul class="tier-facts"><li><span>Access</span><strong>${rate.note}</strong></li><li><span>Minimum retention</span><strong>${rate.minimum ? rate.minimum + ' days' : 'None'}</strong></li><li><span>Retrieval / restore</span><strong>${key === 'infrequent' ? `${formatMoney(0.01, true)}/GB` : key === 'archive' ? `${els.restoreDays.value} day copy` : 'No fee'}</strong></li></ul>
    </article>`;
  }).join("");

  const rows = [
    ["Storage", "storage"], ["Requests", "requests"], ["Retrieval", "retrieval"],
    ["Archive restored copy", "restore"], ["Early-deletion adjustment", "earlyDelete"], ["Outbound transfer", "egress"], ["Total", "total"]
  ];
  document.getElementById("costTable").innerHTML = rows.map(([label, field]) => `<tr><td>${label}</td>${Object.keys(rates).map(key => `<td>${formatMoney(results[key][field])}</td>`).join("")}</tr>`).join("");
}

function renderCurrencyMeta() {
  const rate = currencies[selectedCurrency].rate;
  document.getElementById("exchangeRate").textContent = `1 USD = ${rate.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} ${selectedCurrency}`;
  document.getElementById("summaryCurrency").textContent = selectedCurrency;
  document.getElementById("standardRate").textContent = formatMoney(rates.standard.storage, true);
  document.getElementById("infrequentRate").textContent = formatMoney(rates.infrequent.storage, true);
  document.getElementById("retrievalRate").textContent = formatMoney(rates.infrequent.retrieval, true);
  document.getElementById("archiveRate").textContent = formatMoney(rates.archive.storage, true);
  document.getElementById("requestRate").textContent = formatMoney(0.0034, true);
  document.getElementById("egressRate").textContent = formatMoney(0.0085, true);
  document.getElementById("disclaimerRate").textContent = `a reference rate of 1 USD = ${rate.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} ${selectedCurrency}`;
}

function breakdownRows(result) {
  const rows = [["Storage",result.storage],["Requests",result.requests],["Retrieval / restore",result.retrieval+result.restore],["Retention adjustment",result.earlyDelete],["Outbound transfer",result.egress]];
  return rows.map(([label,value]) => `<div class="cost-row"><span>${label}</span><strong>${formatMoney(value)}</strong></div>`).join("");
}

function winnerReason(key, results) {
  const second = Object.entries(results).sort((a,b) => a[1].total - b[1].total)[1];
  const saving = Math.max(0, second[1].total - results[key].total);
  if (key === "archive") return `Your low read volume makes cold storage economical, saving about ${formatMoney(saving)} versus ${rates[second[0]].name}. Allow up to an hour to restore objects.`;
  if (key === "infrequent") return `Lower storage pricing outweighs retrieval charges for this access pattern, saving about ${formatMoney(saving)} versus ${rates[second[0]].name}.`;
  return `Frequent reads and short object lifetimes make the no-retrieval, no-minimum Standard tier the safer value, saving about ${formatMoney(saving)}.`;
}

ids.forEach(id => els[id].addEventListener("input", () => { markCustom(); render(); }));
document.getElementById("presets").addEventListener("click", event => {
  const button = event.target.closest("button"); if (!button) return;
  document.querySelectorAll("[data-preset]").forEach(item => item.classList.toggle("active", item === button));
  const preset = presets[button.dataset.preset];
  if (preset) { Object.entries(preset).forEach(([id,value]) => els[id].value = value); render(); }
});
function markCustom() { document.querySelectorAll("[data-preset]").forEach(item => item.classList.toggle("active", item.dataset.preset === "custom")); }
currencySelect.addEventListener("change", () => {
  selectedCurrency = currencySelect.value;
  localStorage.setItem("oci-cost-currency", selectedCurrency);
  render();
});
render();
