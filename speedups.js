/* =====================================================================
   CONFIG — Google Apps Script Web App URL (see apps-script/Code.gs).
===================================================================== */
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxQBY5vDDCGUFo3H8CzjJWwcDScda3IqlIdGeGGwr2j8KFbm6ioS9SNgWIWRHN8FTnE/exec";

/* ---------------- the four speedup types (game order) ---------------- */
const TYPES = [
  { id: "general",      key: "rowGeneral",      icon: "fa-forward-fast" },
  { id: "training",     key: "rowTraining",     icon: "fa-person-military-rifle" },
  { id: "construction", key: "rowConstruction", icon: "fa-hammer" },
  { id: "research",     key: "rowResearch",     icon: "fa-flask" }
];
let unit = "days";

/* ---------------- translations (dictionary lives in i18n.js) ---------------- */
function t(key) {
  const lang = pageLang();
  const d = I18N[lang] || {};
  if (d[key] != null) return d[key];
  return I18N.en[key] != null ? I18N.en[key] : null;
}
function fmt(key, vars) {
  let s = t(key) || "";
  Object.keys(vars || {}).forEach(k => { s = s.split("{" + k + "}").join(vars[k]); });
  return s;
}
function rowName(id) { return t("row" + id.charAt(0).toUpperCase() + id.slice(1)) || id; }

/* ---------------- speedup rows ---------------- */
function buildRows() {
  const wrap = document.getElementById("suRows");
  wrap.innerHTML = TYPES.map(tp => `
    <div class="su-row" data-type="${tp.id}">
      <div class="su-label"><i class="fa-solid ${tp.icon}"></i> ${rowName(tp.id)}</div>
      <div class="su-inputs">
        <span class="su-cell su-days"><input type="number" min="0" inputmode="numeric" placeholder="0" id="${tp.id}_d" aria-label="${rowName(tp.id)} ${t("cellDay")}"><label>${t("cellDay")}</label></span>
        <span class="su-cell su-hrs"><input type="number" min="0" inputmode="numeric" placeholder="0" id="${tp.id}_h" aria-label="${rowName(tp.id)} ${t("cellHr")}"><label>${t("cellHr")}</label></span>
        <span class="su-cell su-min"><input type="number" min="0" inputmode="numeric" placeholder="0" id="${tp.id}_m" aria-label="${rowName(tp.id)} ${t("cellMin")}"><label>${t("cellMin")}</label></span>
      </div>
      <div class="su-total" id="${tp.id}_total"></div>
    </div>`).join("");
  wrap.addEventListener("input", updateTotals);
}

function applyUnit(u) {
  const totals = {};
  TYPES.forEach(t => { totals[t.id] = rowMinutes(t.id); });
  unit = u;
  document.querySelectorAll("[data-unit]").forEach(b => {
    const on = b.dataset.unit === u;
    b.classList.toggle("active", on); b.setAttribute("aria-pressed", on ? "true" : "false");
  });
  document.querySelectorAll(".su-row").forEach(r => {
    r.querySelector(".su-days").style.display = (u === "days") ? "" : "none";
    r.querySelector(".su-hrs").style.display  = (u === "min") ? "none" : "";
    r.querySelector(".su-min").style.display  = "";
  });
  TYPES.forEach(t => { if (totals[t.id] > 0) setRow(t.id, totals[t.id]); });
  updateTotals();
}

const val = id => {
  const el = document.getElementById(id);
  return Math.max(0, parseInt(((el && el.value) || "0").replace(/[^\d]/g, ""), 10) || 0);
};
function rowMinutes(t) {
  const d = unit === "days" ? val(t + "_d") : 0;
  const h = unit === "min" ? 0 : val(t + "_h");
  const m = val(t + "_m");
  return d * 1440 + h * 60 + m;
}
const pretty = mins => {
  if (!mins) return "";
  const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
  return [d ? d + "d" : "", h ? h + "h" : "", m ? m + "m" : ""].filter(Boolean).join(" ");
};
function updateTotals() {
  TYPES.forEach(t => {
    const mins = rowMinutes(t.id);
    document.getElementById(t.id + "_total").textContent = mins ? "= " + pretty(mins) : "";
  });
  revalidate("speedups");
}
function setRow(t, mins) {
  const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
  if (unit === "days") {
    document.getElementById(t + "_d").value = d || "";
    document.getElementById(t + "_h").value = h || "";
    document.getElementById(t + "_m").value = m || "";
  } else if (unit === "hrs") {
    document.getElementById(t + "_h").value = (d * 24 + h) || "";
    document.getElementById(t + "_m").value = m || "";
  } else {
    document.getElementById(t + "_m").value = mins || "";
  }
}

/* ---------------- screenshot: preview + compress + OCR ---------------- */
let shotData = null;
function ocrStatus(msg, spin) {
  const el = document.getElementById("ocrStatus");
  el.style.display = "flex";
  el.innerHTML = (spin ? '<i class="fa-solid fa-spinner fa-spin"></i> ' : "") + msg;
}
function loadImage(file) {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i); i.onerror = rej;
    i.src = URL.createObjectURL(file);
  });
}
async function compressImage(file) {
  const img = await loadImage(file);
  const scale = Math.min(1, 1600 / img.width);
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85);
}
/* OCR-only version of the image: upscale small screenshots, grayscale, and
   stretch contrast so the game's brown-on-parchment digits read cleanly.
   (The uploaded/attached copy stays the normal JPEG above.) */
async function preprocessForOcr(file) {
  const img = await loadImage(file);
  const targetW = Math.min(2000, Math.max(1200, img.width));
  const scale = targetW / img.width;
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
  g.drawImage(img, 0, 0, c.width, c.height);
  const d = g.getImageData(0, 0, c.width, c.height), p = d.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < p.length; i += 4) {
    const y = (p[i] * 299 + p[i + 1] * 587 + p[i + 2] * 114) / 1000 | 0;
    p[i] = p[i + 1] = p[i + 2] = y; hist[y]++;
  }
  // stretch between the 2nd and 98th percentile so faint text goes full-range
  const total = c.width * c.height;
  let lo = 0, hi = 255, acc = 0;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= total * 0.02) { lo = v; break; } }
  acc = 0;
  for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc >= total * 0.02) { hi = v; break; } }
  const range = Math.max(1, hi - lo);
  for (let i = 0; i < p.length; i += 4) {
    const y = Math.max(0, Math.min(255, (p[i] - lo) * 255 / range | 0));
    p[i] = p[i + 1] = p[i + 2] = y;
  }
  g.putImageData(d, 0, 0);
  return c.toDataURL("image/png"); // lossless for OCR — JPEG artifacts blur glyph edges
}
/* parse OCR text → minutes per type (handles two-line + garbled labels). */
function parseOcr(text) {
  const t = (text || "").toLowerCase()
    // common OCR digit confusions, only when glued to a digit: 5o1→501, 5o →50, 2l→21
    .replace(/(\d)[oó](?![a-z])/g, "$10")
    .replace(/(\d)[li!|](?![a-z])/g, "$11")
    .replace(/(\d)s(?=\d)/g, "$15");
  const num = s => parseInt(s.replace(/[^\d]/g, ""), 10) || 0;
  const ORDER = ["general", "training", "construction", "research"];
  // Row labels across the game's languages (matched against lowercased OCR text)
  const RES = {
    general:      /enera|umum|allgemein|généra|genera|geral|ogóln|genel|일반|一般|通用|ทั่วไป|عام/,
    training:     /(soldier|troop)[\s\S]{0,16}?train|train[\s\S]{0,14}?speed|soldier(?![\s\S]{0,16}heal)|prajurit|pelatihan|ausbildung|entraîn|addestr|entren|treinamento|szkolen|eğit|훈련|訓練|训练|병사|士兵|兵士|ฝึก|تدريب/,
    construction: /constru|konstru|bau|costruz|budow|inşaat|건설|建設|建设|建造|ก่อสร้าง|بناء/,
    research:     /research|riset|penelitian|recherche|ricerca|forschung|pesquisa|investigac|badani|badań|araştır|연구|研究|วิจัย|بحث|أبحاث/
  };
  const marks = {};
  ORDER.forEach(id => { const m = t.match(RES[id]); if (m) marks[id] = m.index; });
  const stops = [];
  const stopRe = /learning|healing|overview|resources|pembelajaran|penyembuh|kesimpulan|sumber|apprentissage|soin|guérison|heilung|lernen|übersicht|aprendiz|curación|cura de|leczenie|nauka|öğren|iyileş|치유|학습|治疗|治療|学习|學習|รักษา|เรียนรู้|شفاء|تعلم/g;
  let sm; while ((sm = stopRe.exec(t))) stops.push(sm.index);
  const endAt = from => {
    let end = t.length;
    ORDER.forEach(id => { if (marks[id] != null && marks[id] > from && marks[id] < end) end = marks[id]; });
    stops.forEach(s => { if (s > from + 5 && s < end) end = s; });
    return end;
  };
  // Duration units across the game's languages (day / hour / minute).
  // Digits are universal; only the unit word changes. Ambiguous single-letter
  // abbreviations (fr "j" = day vs id "j" = hour) are added per page language.
  // NB: the game concatenates values ("5 hari14 j7 mnt"), so a digit can
  // directly follow a unit word — \b would fail there; use (?![a-z]) instead.
  let DAY = "days?|da?y|tage?|jours?|giorn\\w*|dni(?![a-z])|dzie\\w*|hari|d[ií]as?(?![a-z])|日|天|일|วัน";
  let HR  = "hours?|hrs?|stunden?|std\\.?|heures?|ore(?![a-z])|ora(?![a-z])|godz\\w*|jam|小时|小時|時間|時|时|시간|ชม";
  let MIN = "minutes?|mins?|minut\\w*|menit|mnt(?![a-z])|分钟|分鐘|分|분|นาที";
  const lang = pageLang();
  if (lang === "id") { HR += "|j(?![a-z])"; }
  else if (lang === "fr") { DAY += "|j(?![a-z])"; HR += "|h(?![a-z])"; }
  else if (lang === "es" || lang === "pt" || lang === "it" || lang === "de") { HR += "|h(?![a-z])"; }
  else if (lang === "tr") { DAY += "|g[uü]n\\w*"; HR += "|saat\\w*|sa(?![a-z])"; MIN += "|dk(?![a-z])"; }
  const TOK = new RegExp("([\\d.,]+)\\s*(?:(" + DAY + ")|(" + HR + ")|(" + MIN + "))", "gi");
  const mult = m => (m[2] ? 1440 : m[3] ? 60 : 1);
  const grab = seg => {
    TOK.lastIndex = 0; let total = 0, any = false, mm;
    while ((mm = TOK.exec(seg))) { any = true; total += num(mm[1]) * mult(mm); }
    return any ? total : null;
  };
  const found = {};
  ORDER.forEach(id => {
    if (marks[id] == null) return;
    const v = grab(t.slice(marks[id], Math.min(endAt(marks[id]), marks[id] + 200)));
    if (v != null) found[id] = v;
  });
  const clusters = seg => {
    TOK.lastIndex = 0; const out = []; let last = -1; let m;
    while ((m = TOK.exec(seg))) {
      const r = m[2] ? 0 : m[3] ? 1 : 2;
      if (r <= last || !out.length) out.push(0);
      out[out.length - 1] += num(m[1]) * mult(m);
      last = r;
    }
    return out;
  };
  ORDER.forEach((id, i) => {
    if (found[id] != null) return;
    let pi = i - 1; while (pi >= 0 && marks[ORDER[pi]] == null) pi--;
    let ni = i + 1; while (ni < ORDER.length && marks[ORDER[ni]] == null) ni++;
    if (pi >= 0) {
      const from = marks[ORDER[pi]];
      const to = ni < ORDER.length ? marks[ORDER[ni]] : endAt(from);
      const cs = clusters(t.slice(from, to));
      const want = i - pi;
      if (cs.length > want && cs[want] > 0) found[id] = cs[want];
    } else if (ni < ORDER.length && marks[ORDER[ni]] != null) {
      const cs = clusters(t.slice(0, marks[ORDER[ni]]));
      const idx = cs.length - (ni - i);
      if (idx >= 0 && cs[idx] > 0) found[id] = cs[idx];
    }
  });
  // Language-independent fallback: if the English row labels anchored nothing
  // (e.g. a Korean / Arabic game UI), the four rows are still in their fixed
  // order, so map the duration clusters top-to-bottom onto the four types.
  if (!Object.keys(found).length) {
    const cs = clusters(t);
    ORDER.forEach((id, i) => { if (cs[i] > 0) found[id] = cs[i]; });
  }
  return found;
}
/* Pick Tesseract models from the page language so non-Latin game UIs (Korean,
   Chinese, Arabic, Hindi) are actually legible. English is always included for
   the universal digits. Falls back to English-only if detection is unclear. */
const TESS = {
  de: "deu", ko: "kor", zh: "chi_sim", "zh-tw": "chi_tra", id: "ind", pl: "pol",
  ar: "ara", it: "ita", fr: "fra", ja: "jpn", pt: "por", es: "spa", th: "tha",
  tr: "tur", en: "eng"
};
function ocrLangs() {
  const extra = TESS[pageLang()];
  return (extra && extra !== "eng") ? ("eng+" + extra) : "eng";
}
const OCR_WARN = '<i class="fa-solid fa-circle-exclamation" style="color:var(--orange)"></i> ';
async function runOcr(dataUrl) {
  ocrStatus(t("ocrReading"), true);
  try {
    if (!window.Tesseract) {
      await new Promise((res, rej) => {
        const s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
    }
    const { data } = await Tesseract.recognize(dataUrl, ocrLangs(), {
      logger: m => {
        if (m.status === "recognizing text" && m.progress > 0) {
          ocrStatus(t("ocrReading") + " " + Math.round(m.progress * 100) + "%", true);
        }
      }
    });
    console.log("[speedups] OCR text:\n" + (data.text || "(empty)"));
    const found = parseOcr(data.text || "");
    const got = TYPES.filter(tp => tp.id in found).map(tp => rowName(tp.id));
    const missing = TYPES.filter(tp => !(tp.id in found)).map(tp => rowName(tp.id));
    if (got.length) {
      Object.entries(found).forEach(([id, mins]) => setRow(id, mins));
      updateTotals();
      ocrStatus(missing.length
        ? OCR_WARN + fmt("ocrPartial", { got: got.join(", "), missing: "<strong>" + missing.join(", ") + "</strong>" })
        : '<i class="fa-solid fa-circle-check" style="color:var(--green)"></i> ' + t("ocrAll"));
    } else {
      ocrStatus(OCR_WARN + t("ocrNone"));
    }
  } catch (e) {
    ocrStatus(OCR_WARN + t("ocrNone"));
  }
}
document.getElementById("shot").addEventListener("change", async e => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const prev = document.getElementById("shotPreview");
  try {
    const dataUrl = await compressImage(file);
    shotData = { name: file.name, type: "image/jpeg", b64: dataUrl.split(",")[1] };
    prev.src = dataUrl; prev.style.display = "block";
    let ocrUrl = dataUrl;
    try { ocrUrl = await preprocessForOcr(file); } catch (e) { /* fall back to the plain JPEG */ }
    runOcr(ocrUrl);
  } catch (ex) {
    prev.style.display = "none";
    try {
      if (file.size > 6 * 1024 * 1024) throw new Error("too big");
      const b64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result).split(",")[1]);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      shotData = { name: file.name, type: file.type || "application/octet-stream", b64 };
      ocrStatus(OCR_WARN + t("ocrAttached"));
    } catch (ex2) {
      shotData = null;
      ocrStatus(OCR_WARN + t("ocrFail"));
    }
  }
});

/* ---------------- alliance "Other" ---------------- */
function refreshAllianceOther() {
  const sel = document.getElementById("alliance");
  const other = document.getElementById("allianceOther");
  const isOther = sel.value === "Other";
  other.style.display = isOther ? "block" : "none";
  if (!isOther) other.value = "";
}
function resolveAlliance() {
  const sel = document.getElementById("alliance");
  if (sel.value === "Other") return document.getElementById("allianceOther").value.trim();
  return sel.value;
}

/* ---------------- titles (picked manually — no auto-selection) ---------------- */
function titleInput(value) { return [...document.querySelectorAll('input[name="title"]')].find(i => i.value === value); }
function selectedTitles() { return [...document.querySelectorAll('input[name="title"]:checked')].map(i => i.value); }
function selectedCmDays() { return [...document.querySelectorAll('input[name="cmDay"]:checked')].map(i => i.value); }
function refreshDayChips() {
  document.querySelectorAll(".day-chip").forEach(c => c.classList.toggle("on", c.querySelector("input").checked));
}
function refreshTitleCards() {
  document.querySelectorAll(".title-card").forEach(c => c.classList.toggle("selected", c.querySelector("input").checked));
  document.getElementById("cmDaysWrap").style.display = titleInput("Chief Minister").checked ? "" : "none";
}

/* ---------------- availability (windows, timezone, flexible) ---------------- */
/* Major cities by IANA zone. Offsets are computed live, so DST is handled. */
const TZ_CITIES = [
  ["Pacific/Midway","Midway"],["Pacific/Honolulu","Honolulu"],["America/Anchorage","Anchorage"],
  ["America/Los_Angeles","Los Angeles"],["America/Denver","Denver"],["America/Phoenix","Phoenix"],
  ["America/Chicago","Chicago"],["America/Mexico_City","Mexico City"],["America/New_York","New York"],
  ["America/Toronto","Toronto"],["America/Bogota","Bogota"],["America/Lima","Lima"],
  ["America/Halifax","Halifax"],["America/Caracas","Caracas"],["America/Santiago","Santiago"],
  ["America/St_Johns","St. John's"],["America/Sao_Paulo","Sao Paulo"],["America/Argentina/Buenos_Aires","Buenos Aires"],
  ["Atlantic/Azores","Azores"],["Atlantic/Cape_Verde","Cape Verde"],["Europe/London","London"],
  ["Europe/Lisbon","Lisbon"],["Africa/Lagos","Lagos"],["Europe/Paris","Paris"],["Europe/Berlin","Berlin"],
  ["Europe/Madrid","Madrid"],["Europe/Rome","Rome"],["Europe/Amsterdam","Amsterdam"],["Europe/Warsaw","Warsaw"],
  ["Africa/Cairo","Cairo"],["Europe/Athens","Athens"],["Africa/Johannesburg","Johannesburg"],
  ["Europe/Istanbul","Istanbul"],["Europe/Moscow","Moscow"],["Africa/Nairobi","Nairobi"],
  ["Asia/Riyadh","Riyadh"],["Asia/Tehran","Tehran"],["Asia/Dubai","Dubai"],["Asia/Baku","Baku"],
  ["Asia/Kabul","Kabul"],["Asia/Karachi","Karachi"],["Asia/Tashkent","Tashkent"],
  ["Asia/Kolkata","Mumbai / New Delhi"],["Asia/Kathmandu","Kathmandu"],["Asia/Dhaka","Dhaka"],
  ["Asia/Almaty","Almaty"],["Asia/Yangon","Yangon"],["Asia/Bangkok","Bangkok"],["Asia/Jakarta","Jakarta"],
  ["Asia/Ho_Chi_Minh","Ho Chi Minh City"],["Asia/Shanghai","Beijing / Shanghai"],["Asia/Singapore","Singapore"],
  ["Asia/Manila","Manila"],["Asia/Hong_Kong","Hong Kong"],["Asia/Taipei","Taipei"],["Australia/Perth","Perth"],
  ["Asia/Tokyo","Tokyo"],["Asia/Seoul","Seoul"],["Australia/Darwin","Darwin"],["Australia/Adelaide","Adelaide"],
  ["Australia/Brisbane","Brisbane"],["Australia/Sydney","Sydney"],["Pacific/Guam","Guam"],
  ["Pacific/Noumea","Noumea"],["Pacific/Auckland","Auckland"],["Pacific/Fiji","Fiji"]
];
function fmtOffset(min) {
  const a = Math.abs(min);
  return "UTC" + (min < 0 ? "-" : "+") + Math.floor(a / 60) + ":" + String(a % 60).padStart(2, "0");
}
/* current UTC offset (minutes east) of an IANA zone, DST included */
function zoneOffset(zone, date) {
  date = date || new Date();
  try {
    const dtf = new Intl.DateTimeFormat("en-US", { timeZone: zone, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const p = {};
    dtf.formatToParts(date).forEach(x => { if (x.type !== "literal") p[x.type] = x.value; });
    const hh = p.hour === "24" ? 0 : +p.hour;
    const asUTC = Date.UTC(+p.year, p.month - 1, +p.day, hh, +p.minute, +p.second);
    return Math.round((asUTC - date.getTime()) / 60000);
  } catch (e) { return -new Date().getTimezoneOffset(); }
}
function cityFromZone(z) { return ((z || "").split("/").pop() || z).replace(/_/g, " "); }
const DETECTED_ZONE = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) { return ""; } })();
let timeMode = "local", tzOffset = 0, tzLabel = "", defaultOffset = 0;
/* One entry per UTC offset, with example cities. Cities are bucketed by their
   CURRENT offset, so the examples stay accurate through DST. */
function buildTzSelect() {
  const sel = document.getElementById("tz");
  if (!sel) return;
  const buckets = {};
  TZ_CITIES.forEach(([zone, label]) => {
    const off = zoneOffset(zone);
    (buckets[off] = buckets[off] || []).push(label);
  });
  const detectedOff = DETECTED_ZONE ? zoneOffset(DETECTED_ZONE) : -new Date().getTimezoneOffset();
  if (!buckets[detectedOff]) buckets[detectedOff] = [];
  const detCity = DETECTED_ZONE ? cityFromZone(DETECTED_ZONE) : "";
  if (detCity && !buckets[detectedOff].some(c => c.indexOf(detCity) !== -1)) buckets[detectedOff].unshift(detCity);
  defaultOffset = detectedOff;
  tzOffset = detectedOff;
  const offs = Object.keys(buckets).map(Number).sort((a, b) => a - b);
  sel.innerHTML = offs.map(off => {
    const cities = buckets[off].slice(0, 4).join(", ");
    return '<option value="' + off + '"' + (off === detectedOff ? " selected" : "") + ">" +
      fmtOffset(off) + (cities ? " (" + cities + ")" : "") + (off === detectedOff ? " - detected" : "") + "</option>";
  }).join("");
  tzLabel = labelFor(sel);
  sel.addEventListener("change", () => { tzOffset = parseInt(sel.value, 10) || 0; tzLabel = labelFor(sel); tickTz(); updateWindowsPreview(); });
}
function labelFor(sel) {
  const o = sel.options[sel.selectedIndex];
  return o ? o.textContent.replace(/ - detected$/, "") : "";
}
function effOffset() { return timeMode === "local" ? tzOffset : 0; }
function localToUtc(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || "");
  if (!m) return "";
  const localMin = (+m[1]) * 60 + (+m[2]);
  const utcMin = (((localMin - effOffset()) % 1440) + 1440) % 1440;
  return String(Math.floor(utcMin / 60)).padStart(2, "0") + ":" + String(utcMin % 60).padStart(2, "0");
}
/* 30-minute options: 00:00, 00:30, … 23:30 */
function timeOptions(selected) {
  let html = '<option value="" disabled' + (selected ? "" : " selected") + '>--:--</option>';
  for (let h = 0; h < 24; h++) {
    for (const mm of ["00", "30"]) {
      const v = String(h).padStart(2, "0") + ":" + mm;
      html += '<option value="' + v + '"' + (v === selected ? " selected" : "") + '>' + v + '</option>';
    }
  }
  return html;
}
function addWindow(from, to) {
  const wrap = document.getElementById("windows");
  const div = document.createElement("div");
  div.className = "win-row";
  div.innerHTML =
    '<select class="win-from" aria-label="Window start">' + timeOptions(from) + '</select>' +
    '<span class="win-sep">' + t("to") + '</span>' +
    '<select class="win-to" aria-label="Window end">' + timeOptions(to) + '</select>' +
    '<button type="button" class="win-del" aria-label="Remove this window">&times;</button>';
  wrap.appendChild(div);
  div.querySelector(".win-del").addEventListener("click", () => { div.remove(); refreshWinDels(); updateWindowsPreview(); });
  div.addEventListener("change", updateWindowsPreview);
  refreshWinDels();
  updateWindowsPreview();
}
function refreshWinDels() {
  const rows = [...document.querySelectorAll(".win-row")];
  rows.forEach(r => { r.querySelector(".win-del").style.display = rows.length > 1 ? "" : "none"; });
}
function tickTz() {
  const line = document.getElementById("tzNowLine");
  if (!line) return;
  const now = new Date();
  const utcMin = now.getUTCHours() * 60 + now.getUTCMinutes();
  const localMin = (((utcMin + tzOffset) % 1440) + 1440) % 1440;
  const hhmm = String(Math.floor(localMin / 60)).padStart(2, "0") + ":" + String(localMin % 60).padStart(2, "0");
  line.innerHTML = fmt("tzNow", { time: "<strong>" + hhmm + "</strong>" });
}
function applyFlexible() {
  const flex = document.getElementById("flexible").checked;
  document.getElementById("windows").style.display = flex ? "none" : "";
  document.getElementById("addWindow").style.display = flex ? "none" : "";
  updateWindowsPreview();
}
function applyTimeMode(m) {
  timeMode = m;
  document.querySelectorAll("[data-tz]").forEach(b => {
    const on = b.dataset.tz === m;
    b.classList.toggle("active", on); b.setAttribute("aria-pressed", on ? "true" : "false");
  });
  document.getElementById("tzWrap").style.display = (m === "local") ? "" : "none";
  tickTz(); updateWindowsPreview();
}
function tzInfo() {
  if (timeMode === "local") return { mode: "local", offset: fmtOffset(tzOffset), label: tzLabel };
  return { mode: "utc", offset: "UTC+0:00", label: "UTC / Server time" };
}
function collectAvailability() {
  if (document.getElementById("flexible").checked) {
    return { flexible: true, timezone: tzInfo(), windows: [], summaryUtc: "Flexible (any time)", summaryEntered: "Flexible (any time)", valid: true };
  }
  const windows = [], utcParts = [], localParts = [];
  document.querySelectorAll(".win-row").forEach(r => {
    const f = r.querySelector(".win-from").value, t = r.querySelector(".win-to").value;
    if (!f || !t) return;
    const fu = localToUtc(f), tu = localToUtc(t);
    windows.push({ fromUtc: fu, toUtc: tu, fromLocal: f, toLocal: t });
    utcParts.push(fu + "-" + tu); localParts.push(f + "-" + t);
  });
  const summaryUtc = utcParts.join("; ");
  const summaryEntered = timeMode === "local"
    ? localParts.join("; ") + " (" + fmtOffset(tzOffset) + ")"
    : utcParts.join("; ") + " UTC";
  return { flexible: false, timezone: tzInfo(), windows, summaryUtc, summaryEntered, valid: windows.length > 0 };
}
/* ---------------- inline validation ---------------- */
let attempted = false;
const VKEYS = ["govName", "alliance", "speedups", "titles", "availability"];
function fieldMsg(key) {
  if (key === "govName") return document.getElementById("govName").value.trim() ? "" : t("errGov");
  if (key === "alliance") {
    const sel = document.getElementById("alliance").value;
    if (!sel) return t("errAlliance");
    if (sel === "Other" && !document.getElementById("allianceOther").value.trim()) return t("errAllianceOther");
    return "";
  }
  if (key === "speedups") {
    let any = false; TYPES.forEach(tp => { if (rowMinutes(tp.id) > 0) any = true; });
    return any ? "" : t("errSpeedups");
  }
  if (key === "titles") return selectedTitles().length ? "" : t("errTitles");
  if (key === "availability") return collectAvailability().valid ? "" : t("errAvail");
  return "";
}
const ERR_CTRLS = { govName: ["govName"], alliance: ["alliance", "allianceOther"] };
function setFieldError(key, msg) {
  const el = document.getElementById("err_" + key);
  if (el) { el.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> ' + msg; el.style.display = "flex"; }
  const live = key === "alliance" ? [document.getElementById("alliance").value === "Other" ? "allianceOther" : "alliance"] : (ERR_CTRLS[key] || []);
  (ERR_CTRLS[key] || []).forEach(id => { const c = document.getElementById(id); if (c) c.classList.remove("is-invalid"); });
  live.forEach(id => { const c = document.getElementById(id); if (c) c.classList.add("is-invalid"); });
}
function clearFieldError(key) {
  const el = document.getElementById("err_" + key);
  if (el) { el.style.display = "none"; el.textContent = ""; }
  (ERR_CTRLS[key] || []).forEach(id => { const c = document.getElementById(id); if (c) c.classList.remove("is-invalid"); });
}
function revalidate(key) { if (!attempted) return; const m = fieldMsg(key); m ? setFieldError(key, m) : clearFieldError(key); }
function validateAll() {
  attempted = true;
  let first = null;
  VKEYS.forEach(k => { const m = fieldMsg(k); if (m) { setFieldError(k, m); if (!first) first = k; } else clearFieldError(k); });
  return first;
}
function focusFor(key) {
  if (key === "govName") return document.getElementById("govName");
  if (key === "alliance") return document.getElementById(document.getElementById("alliance").value === "Other" ? "allianceOther" : "alliance");
  if (key === "speedups") return document.getElementById("general_d") || document.getElementById("shot");
  if (key === "titles") return document.querySelector('input[name="title"]');
  if (key === "availability") return document.querySelector(".win-from") || document.getElementById("flexible");
  return null;
}
function updateWindowsPreview() { revalidate("availability"); }

/* ---------------- submit ---------------- */
document.getElementById("speedupForm").addEventListener("submit", async e => {
  e.preventDefault();
  const err = document.getElementById("errBox"), ok = document.getElementById("okBox");
  const fail = (msg, focusId) => {
    document.getElementById("errText").textContent = msg;
    err.style.display = "block";
    const el = focusId && document.getElementById(focusId);
    if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); if (el.focus) el.focus(); }
  };
  err.style.display = "none"; ok.classList.remove("show");

  const firstBad = validateAll();
  if (firstBad) {
    const el = focusFor(firstBad);
    if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); try { el.focus({ preventScroll: true }); } catch (_) { if (el.focus) el.focus(); } }
    return;
  }

  const gov = document.getElementById("govName").value.trim();
  const gameId = document.getElementById("gameId").value.trim().slice(0, 30);
  const alliance = resolveAlliance();
  const entries = {};
  TYPES.forEach(t => {
    const mins = rowMinutes(t.id);
    entries[t.id] = { minutes: mins, display: pretty(mins) || "0" };
  });
  const titles = selectedTitles();
  const cmDays = titles.indexOf("Chief Minister") !== -1 ? selectedCmDays() : [];
  const av = collectAvailability();
  const notes = document.getElementById("notes").value.trim().slice(0, 200);

  if (!SCRIPT_URL) return fail("Submissions aren't connected yet — message your details to R4 Kadi in-game for now.");

  const btn = document.getElementById("submitBtn");
  btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ' + t("sending");
  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ governor: gov, gameId, alliance, titles, cmDays, availability: av, timezone: av.timezone, notes, unit, entries, screenshot: shotData })
    });
    const out = await res.json().catch(() => ({ ok: res.ok }));
    if (!out.ok) throw new Error(out.error || "Server error");
    ok.classList.add("show");
    document.getElementById("okText").textContent = fmt("okBody", { titles: titles.join(" + "), gov: gov, alliance: alliance });
    // reset
    e.target.reset(); shotData = null;
    document.getElementById("shotPreview").style.display = "none";
    document.getElementById("ocrStatus").style.display = "none";
    attempted = false; VKEYS.forEach(clearFieldError);
    refreshAllianceOther(); refreshTitleCards(); refreshDayChips();
    document.getElementById("windows").innerHTML = ""; addWindow();
    const tzSel = document.getElementById("tz");
    tzSel.value = String(defaultOffset); tzOffset = defaultOffset; tzLabel = labelFor(tzSel);
    applyTimeMode("local"); applyFlexible(); updateTotals();
    ok.scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (ex) {
    fail(t("errNet"));
  } finally {
    btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> ' + t("submit");
  }
});

/* ---------------- language menu ---------------- */
(() => {
  const wrap = document.querySelector("[data-tl-menu]");
  const btn = document.querySelector("[data-tl-btn]");
  if (!wrap || !btn) return;
  btn.addEventListener("click", e => { e.stopPropagation(); const open = wrap.classList.toggle("open"); btn.setAttribute("aria-expanded", open ? "true" : "false"); });
  document.addEventListener("click", () => { wrap.classList.remove("open"); btn.setAttribute("aria-expanded", "false"); });
})();

/* ---------------- surface unexpected errors ---------------- */
function showError(detail) {
  const err = document.getElementById("errBox"), txt = document.getElementById("errText");
  if (!err || !txt) return;
  txt.textContent = "Something went wrong — screenshot this and send it to R4 Kadi: " + detail;
  err.style.display = "block";
}
window.addEventListener("error", e => showError(e.message || "unknown error"));
window.addEventListener("unhandledrejection", e => showError((e.reason && (e.reason.message || e.reason)) || "unknown error"));

/* ---------------- in-game title names per language ----------------
   The game uses different names for these two titles in each language, and
   Google Translate mistranslates them. For a mapped language we set the exact
   in-game name and mark it translate="no" so the translator leaves it alone.
   Unmapped languages keep the English text (Google translates it as before).
   cm = top-left card (our "Chief Minister"); na = bottom-right ("Noble Advisor"). */
const TITLES_I18N = {
  en: { cm: "Chief Minister", na: "Noble Advisor" },
  ar: { cm: "رئيس الوزراء", na: "مستشار نبيل" },
  zh: { cm: "总理大臣", na: "参谋长" },
  "zh-tw": { cm: "總理大臣", na: "參謀長" },
  fr: { cm: "Premier Ministre", na: "Noble Conseiller" },
  de: { cm: "Höchster Minister", na: "Nobler Berater" },
  id: { cm: "Perdana Menteri", na: "Penasihat Kerajaan" },
  it: { cm: "Ministro capo", na: "Consulente Nobile" },
  ja: { cm: "総理大臣", na: "参謀長" },
  ko: { cm: "총리대신", na: "참모장" },
  pl: { cm: "Premier", na: "Szlachetny Doradca" },
  pt: { cm: "Primeiro-ministro", na: "Conselheiro Nobre" },
  es: { cm: "Ministro principal", na: "Noble asesor" },
  th: { cm: "อัครเสนาบดี", na: "ขุนนางที่ปรึกษา" },
  tr: { cm: "Başbakan", na: "Asil Danışman" }
  // hi (Hindi) still needed — was not among the screenshots provided
};
/* Language switcher — one list, rendered into the nav menu. Links use ?lang=
   on this same page; translations are built in (i18n.js), no Google proxy. */
const LANGS = [
  { code: "en",    flag: "🇬🇧", label: "English" },
  { code: "ar",    flag: "🇸🇦", label: "العربية (Arabic)" },
  { code: "zh",    flag: "🇨🇳", label: "中文 (Chinese)" },
  { code: "zh-tw", flag: "🇹🇼", label: "繁體中文 (Chinese, Traditional)" },
  { code: "fr",    flag: "🇫🇷", label: "Français (French)" },
  { code: "de",    flag: "🇩🇪", label: "Deutsch (German)" },
  { code: "id",    flag: "🇮🇩", label: "Bahasa (Indonesian)" },
  { code: "it",    flag: "🇮🇹", label: "Italiano (Italian)" },
  { code: "ja",    flag: "🇯🇵", label: "日本語 (Japanese)" },
  { code: "ko",    flag: "🇰🇷", label: "한국어 (Korean)" },
  { code: "pl",    flag: "🇵🇱", label: "Polski (Polish)" },
  { code: "pt",    flag: "🇵🇹", label: "Português (Portuguese)" },
  { code: "es",    flag: "🇪🇸", label: "Español (Spanish)" },
  { code: "th",    flag: "🇹🇭", label: "ไทย (Thai)" },
  { code: "tr",    flag: "🇹🇷", label: "Türkçe (Turkish)" }
];
function renderLangMenu() {
  const menu = document.querySelector(".lang-menu");
  if (!menu) return;
  menu.innerHTML = LANGS.map(l => {
    const href = l.code === "en" ? "speedups.html" : "speedups.html?lang=" + l.code;
    return '<a href="' + href + '"><span class="flag">' + l.flag + "</span> " + l.label + "</a>";
  }).join("");
}
function pageLang() {
  let l = "";
  try {
    const q = new URLSearchParams(location.search);
    l = q.get("lang") || q.get("_x_tr_tl") || ""; // ?lang= is ours; _x_tr_tl supports old proxy links
  } catch (e) {}
  l = (l || "").toLowerCase();
  if (!l) { try { l = (navigator.language || "en").toLowerCase(); } catch (e) { l = "en"; } }
  if (l === "zh-cn" || l === "zh-sg" || l === "zh-hans") l = "zh";
  if (l === "zh-hk" || l === "zh-hant") l = "zh-tw";
  if (I18N[l]) return l;
  const s = l.split("-")[0];
  return I18N[s] ? s : "en";
}
function applyPageLang() {
  const lang = pageLang();
  document.documentElement.lang = lang;
  document.documentElement.dir = (lang === "ar") ? "rtl" : "ltr";
  if (lang !== "en") {
    document.title = (t("h1") || "KvK Title Application") + " — Kingshot #1581";
    document.querySelectorAll("[data-i18n]").forEach(el => { const v = t(el.dataset.i18n); if (v != null) el.textContent = v; });
    document.querySelectorAll("[data-i18n-html]").forEach(el => { const v = t(el.dataset.i18nHtml); if (v != null) el.innerHTML = v; });
    document.querySelectorAll("[data-i18n-ph]").forEach(el => { const v = t(el.dataset.i18nPh); if (v != null) el.placeholder = v; });
  }
  const names = TITLES_I18N[lang];
  document.querySelectorAll(".tc-title").forEach(el => {
    const key = el.dataset.key;
    if (names && names[key] && lang !== "en") { el.textContent = names[key]; el.setAttribute("translate", "no"); }
    else { el.textContent = (TITLES_I18N.en[key] || el.textContent); el.removeAttribute("translate"); }
  });
  // in-game reference screenshot for this language (shown only if the file exists)
  const help = document.getElementById("ministersHelp"), shot = document.getElementById("ministersShot");
  if (help && shot) {
    const fallback = "img/ministers/en.jpg";
    shot.onload = () => { help.style.display = ""; };
    shot.onerror = () => {
      // no screenshot for this language (e.g. Hindi) → fall back to English
      if (shot.getAttribute("src") !== fallback) shot.src = fallback;
      else help.style.display = "none";
    };
    shot.src = "img/ministers/" + lang + ".jpg";
  }
}

/* ---------------- boot ---------------- */
renderLangMenu();
applyPageLang();
buildRows();
applyUnit("days");
document.querySelectorAll("[data-unit]").forEach(b => b.addEventListener("click", () => applyUnit(b.dataset.unit)));

document.getElementById("govName").addEventListener("input", () => revalidate("govName"));
document.getElementById("alliance").addEventListener("change", () => { refreshAllianceOther(); revalidate("alliance"); });
document.getElementById("allianceOther").addEventListener("input", () => revalidate("alliance"));
refreshAllianceOther();

document.querySelectorAll('input[name="title"]').forEach(r => r.addEventListener("change", () => { refreshTitleCards(); revalidate("titles"); }));
document.querySelectorAll('input[name="cmDay"]').forEach(r => r.addEventListener("change", refreshDayChips));

buildTzSelect();
document.querySelectorAll("[data-tz]").forEach(b => b.addEventListener("click", () => applyTimeMode(b.dataset.tz)));
document.getElementById("flexible").addEventListener("change", applyFlexible);
document.getElementById("addWindow").addEventListener("click", () => addWindow());
addWindow();
applyTimeMode("local");
applyFlexible();
tickTz(); setInterval(tickTz, 30000);

if (!SCRIPT_URL) document.getElementById("setupNotice").style.display = "block";
