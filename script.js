const DATA_URL = "data/data.csv";

let allRows = [];   // objects
let leagues = [];
let journees = [];

document.getElementById("btnLoad").addEventListener("click", loadFromGitHub);
document.getElementById("leagueSelect").addEventListener("change", refreshJournees);
document.getElementById("journeeSelect").addEventListener("change", renderTable);

async function loadFromGitHub(){
  try{
    setSummary("Chargement data...");

    const res = await fetch(DATA_URL, { cache: "no-store" });
    if(!res.ok) throw new Error("Fetch fail: " + res.status);

    const csv = await res.text();
    allRows = parseCSV(csv);

    if(allRows.length === 0) throw new Error("CSV vide / format tsy mety.");

    leagues = uniq(allRows.map(r => r.league)).sort();
    fillSelect("leagueSelect", leagues);

    refreshJournees();
    setSummary(`✅ Data chargé: ${allRows.length} lignes`);
  }catch(err){
    setSummary("❌ Erreur: " + err.message);
    document.getElementById("tableWrap").innerHTML = "";
  }
}

function refreshJournees(){
  const league = getVal("leagueSelect");
  const rowsL = allRows.filter(r => r.league === league);

  journees = uniq(rowsL.map(r => r.journee)).sort((a,b)=>Number(a)-Number(b));
  fillSelect("journeeSelect", journees);

  renderTable();
}

function renderTable(){
  const league = getVal("leagueSelect");
  const journee = getVal("journeeSelect");

  const rows = allRows.filter(r => r.league === league && String(r.journee) === String(journee));
  if(rows.length === 0){
    document.getElementById("tableWrap").innerHTML = "<p>Aucun match.</p>";
    return;
  }

  // model simple: implied probs from odds (normalized) -> pick max
  const enriched = rows.map(r => {
    const p = impliedProbs(r.odd_1, r.odd_x, r.odd_2);
    const pick = argmax({ "1": p.p1, "X": p.px, "2": p.p2 });
    const conf = Math.max(p.p1, p.px, p.p2);
    const badge = conf >= 0.46 ? "ok" : (conf >= 0.40 ? "warn" : "no"); // adjustable
    return { ...r, pick, conf, badge };
  });

  const hitRate = computeHitRate(enriched);

  const html = `
    <h3>${league} — Journée ${journee}</h3>
    <p>Règle: Probabilité = 1/odd (normalisée). Pick = max prob. <span class="badge ${hitRate.badge}">Accuracy historique: ${hitRate.acc}%</span></p>
    <table>
      <thead>
        <tr>
          <th>Match</th>
          <th>1</th><th>X</th><th>2</th>
          <th>Pick</th>
          <th>Confiance</th>
          <th>Résultat</th>
        </tr>
      </thead>
      <tbody>
        ${enriched.map(r => `
          <tr>
            <td>${escapeHtml(r.home)} vs ${escapeHtml(r.away)}</td>
            <td>${fmt(r.odd_1)}</td>
            <td>${fmt(r.odd_x)}</td>
            <td>${fmt(r.odd_2)}</td>
            <td><span class="badge ${r.badge}">${r.pick}</span></td>
            <td>${(r.conf*100).toFixed(1)}%</td>
            <td>${r.result || ""}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  document.getElementById("tableWrap").innerHTML = html;
}

// ---------- helpers ----------
function parseCSV(csv){
  const lines = csv.trim().split(/\r?\n/);
  if(lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim());

  const out = [];
  for(let i=1;i<lines.length;i++){
    const line = lines[i].trim();
    if(!line) continue;
    const cols = line.split(",");
    const obj = {};
    headers.forEach((h,idx)=> obj[h] = (cols[idx] ?? "").trim());

    // numeric conversions
    obj.journee = obj.journee;
    obj.odd_1 = toNum(obj.odd_1);
    obj.odd_x = toNum(obj.odd_x);
    obj.odd_2 = toNum(obj.odd_2);
    obj.odd_g = toNum(obj.odd_g);
    obj.odd_ng = toNum(obj.odd_ng);

    // minimal validation (skip if odds missing)
    if(!obj.league || !obj.home || !obj.away) continue;
    if(!isFinite(obj.odd_1) || !isFinite(obj.odd_x) || !isFinite(obj.odd_2)) continue;

    out.push(obj);
  }
  return out;
}

function impliedProbs(o1, ox, o2){
  const p1 = 1/o1, px = 1/ox, p2 = 1/o2;
  const s = p1+px+p2;
  return { p1: p1/s, px: px/s, p2: p2/s };
}

function argmax(map){
  let bestK = null, bestV = -Infinity;
  for(const k in map){
    if(map[k] > bestV){ bestV = map[k]; bestK = k; }
  }
  return bestK;
}

function computeHitRate(rows){
  const labeled = rows.filter(r => r.result === "1" || r.result === "X" || r.result === "2");
  if(labeled.length < 10) return { acc: "n/a", badge:"no" };

  const hits = labeled.filter(r => r.pick === r.result).length;
  const acc = (hits / labeled.length * 100).toFixed(1);
  const badge = acc >= 45 ? "ok" : (acc >= 38 ? "warn" : "no");
  return { acc, badge };
}

function uniq(arr){ return [...new Set(arr.filter(Boolean))]; }

function fillSelect(id, arr){
  const sel = document.getElementById(id);
  sel.innerHTML = arr.map(v => `<option value="${escapeHtml(String(v))}">${escapeHtml(String(v))}</option>`).join("");
}

function getVal(id){ return document.getElementById(id).value; }

function setSummary(msg){
  document.getElementById("summary").innerHTML = `<p>${escapeHtml(msg)}</p>`;
}

function toNum(s){
  if(s === null || s === undefined) return NaN;
  const v = String(s).replace(",", ".").trim();
  const n = Number(v);
  return n;
}

function fmt(n){
  if(!isFinite(n)) return "";
  return Number(n).toFixed(2);
}

function escapeHtml(str){
  return str.replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"
  }[m]));
}
