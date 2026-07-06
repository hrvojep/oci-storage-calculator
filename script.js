const GB_PER_TB = 1024;
const USD_TO_AUD = 1.4417;
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
const money = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", currencyDisplay: "code", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatAud = valueUsd => money.format(valueUsd * USD_TO_AUD);

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
  const storage = Number(els.storage.value);
  document.getElementById("storageOut").textContent = storage >= 1000 ? "1 PB" : `${storage.toLocaleString()} TB`;
  els.storage.style.setProperty("--progress", `${storage / 10}%`);

  const results = Object.fromEntries(Object.keys(rates).map(key => [key, calculate(key)]));
  const winnerKey = Object.keys(results).sort((a,b) => results[a].total - results[b].total)[0];
  const winner = results[winnerKey];
  document.getElementById("winnerName").textContent = rates[winnerKey].name;
  document.getElementById("winnerCost").textContent = formatAud(winner.total);
  document.getElementById("winnerBreakdown").innerHTML = breakdownRows(winner);
  document.getElementById("winnerReason").textContent = winnerReason(winnerKey, results);

  const max = Math.max(...Object.values(results).map(result => result.total), 1);
  document.getElementById("tierCards").innerHTML = Object.entries(rates).map(([key, rate]) => {
    const result = results[key];
    return `<article class="tier-card ${key === winnerKey ? "best" : ""}">
      <div class="tier-top"><h3>${rate.name}</h3>${key === winnerKey ? '<span class="badge">Lowest cost</span>' : ''}</div>
      <div class="tier-cost">${formatAud(result.total)}</div><div class="tier-rate">per month · ${formatAud(rate.storage)}/GB stored</div>
      <div class="bar-track"><div class="bar" style="width:${Math.max(1, result.total / max * 100)}%"></div></div>
      <ul class="tier-facts"><li><span>Access</span><strong>${rate.note}</strong></li><li><span>Minimum retention</span><strong>${rate.minimum ? rate.minimum + ' days' : 'None'}</strong></li><li><span>Retrieval / restore</span><strong>${key === 'infrequent' ? `${formatAud(0.01)}/GB` : key === 'archive' ? `${els.restoreDays.value} day copy` : 'No fee'}</strong></li></ul>
    </article>`;
  }).join("");

  const rows = [
    ["Storage", "storage"], ["Requests", "requests"], ["Retrieval", "retrieval"],
    ["Archive restored copy", "restore"], ["Early-deletion adjustment", "earlyDelete"], ["Outbound transfer", "egress"], ["Total", "total"]
  ];
  document.getElementById("costTable").innerHTML = rows.map(([label, field]) => `<tr><td>${label}</td>${Object.keys(rates).map(key => `<td>${formatAud(results[key][field])}</td>`).join("")}</tr>`).join("");
}

function breakdownRows(result) {
  const rows = [["Storage",result.storage],["Requests",result.requests],["Retrieval / restore",result.retrieval+result.restore],["Retention adjustment",result.earlyDelete],["Outbound transfer",result.egress]];
  return rows.map(([label,value]) => `<div class="cost-row"><span>${label}</span><strong>${formatAud(value)}</strong></div>`).join("");
}

function winnerReason(key, results) {
  const second = Object.entries(results).sort((a,b) => a[1].total - b[1].total)[1];
  const saving = Math.max(0, second[1].total - results[key].total);
  if (key === "archive") return `Your low read volume makes cold storage economical, saving about ${formatAud(saving)} versus ${rates[second[0]].name}. Allow up to an hour to restore objects.`;
  if (key === "infrequent") return `Lower storage pricing outweighs retrieval charges for this access pattern, saving about ${formatAud(saving)} versus ${rates[second[0]].name}.`;
  return `Frequent reads and short object lifetimes make the no-retrieval, no-minimum Standard tier the safer value, saving about ${formatAud(saving)}.`;
}

ids.forEach(id => els[id].addEventListener("input", () => { markCustom(); render(); }));
document.getElementById("presets").addEventListener("click", event => {
  const button = event.target.closest("button"); if (!button) return;
  document.querySelectorAll("[data-preset]").forEach(item => item.classList.toggle("active", item === button));
  const preset = presets[button.dataset.preset];
  if (preset) { Object.entries(preset).forEach(([id,value]) => els[id].value = value); render(); }
});
function markCustom() { document.querySelectorAll("[data-preset]").forEach(item => item.classList.toggle("active", item.dataset.preset === "custom")); }
render();
