/**
 * [BRO] Brotherhood — KvK Title Application backend
 * Receives submissions from speedups.html, logs them to this spreadsheet,
 * and saves screenshots to a Drive folder.
 *
 * ── ONE-TIME SETUP (~5 minutes) ─────────────────────────────────────────────
 * 1. Go to sheets.google.com → create a new spreadsheet, name it "BRO KvK Titles".
 * 2. In that sheet: Extensions → Apps Script. Delete the sample code and paste
 *    this entire file. Save (Ctrl+S).
 * 3. Click "Deploy" → "New deployment" → gear icon → "Web app".
 *      - Description: BRO KvK Titles
 *      - Execute as: Me
 *      - Who has access: Anyone        ← required so members can submit
 *    Click Deploy. Authorize when prompted (it only touches this sheet + a
 *    Drive folder it creates).
 * 4. Copy the Web app URL (ends in /exec).
 * 5. In speedups.html, paste that URL into:  const SCRIPT_URL = "...";
 *    The header row + columns are created automatically on the first submission;
 *    screenshots go to a Drive folder called "BRO Speedup Screenshots".
 *
 * To update the script later: edit, then Deploy → Manage deployments → edit
 * (pencil) → Version: New version → Deploy. The URL stays the same.
 * ───────────────────────────────────────────────────────────────────────────
 */

const FOLDER_NAME = "BRO Speedup Screenshots";
// Known alliances. "Other" submissions send free text instead — accepted but sanitized.
const ALLIANCES = [
  "[APX] Predator", "[BRO] Brotherhood", "[Jaz] JustaZoo", "[AMF] AhjinSeoul",
  "[THC] TheHighCouncil", "[bro] BROacademy", "[fam] KingsQueens", "[jaz] JustaZoo2",
  "[2UP] Teamwork777", "[bra] BroAcademy", "[TVB] TheVikings2b", "[apx] farmacademy"
];
const TITLES = ["Chief Minister", "Noble Advisor"];
const HEADERS = [
  "Timestamp", "Governor", "Game ID", "Alliance",
  "Titles", "Availability (UTC)", "Availability (entered)", "Timezone", "Notes",
  "General (min)", "Soldier Training (min)", "Construction (min)", "Research (min)",
  "Total (min)",
  "General", "Soldier Training", "Construction", "Research",
  "Screenshot"
];

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const gov = String(data.governor || "").trim().slice(0, 60);
    if (!gov) return reply({ ok: false, error: "Missing governor name" });

    const gameId = String(data.gameId || "").trim().slice(0, 30);

    // alliance: a known option, OR any non-empty free text (the "Other" path)
    let alliance = String(data.alliance || "").trim().slice(0, 60);
    if (!alliance) return reply({ ok: false, error: "Missing alliance" });

    // titles: one or more of the known governor titles
    const titles = (Array.isArray(data.titles) ? data.titles : [])
      .map(t => String(t).trim())
      .filter(t => TITLES.indexOf(t) !== -1);
    if (!titles.length) return reply({ ok: false, error: "Missing or invalid title" });
    const titlesStr = titles.join("; ");

    // availability: { flexible, summaryUtc, summaryEntered }
    const av = data.availability || {};
    const availUtc = String(av.summaryUtc || "").trim().slice(0, 200);
    const availEntered = String(av.summaryEntered || "").trim().slice(0, 200);
    if (!av.flexible && !availUtc) return reply({ ok: false, error: "Missing availability" });

    // timezone / location ("UTC+10:00 · Brisbane, Sydney" or "UTC")
    const tz = data.timezone || av.timezone || {};
    const timezone = String(tz.label || tz.offset || "").slice(0, 80);

    const notes = String(data.notes || "").trim().slice(0, 200);

    const en = data.entries || {};
    const mins = t => Math.max(0, parseInt(en[t] && en[t].minutes, 10) || 0);
    const disp = t => String((en[t] && en[t].display) || "0").slice(0, 40);
    const c = mins("construction"), r = mins("research"), tr = mins("training"), g = mins("general");
    if (g + tr + c + r <= 0) return reply({ ok: false, error: "No speedups entered" });

    // save screenshot to Drive (if provided)
    let shotUrl = "";
    if (data.screenshot && data.screenshot.b64) {
      const folder = getFolder_();
      const stamp = Utilities.formatDate(new Date(), "UTC", "yyyy-MM-dd_HHmm");
      const blob = Utilities.newBlob(
        Utilities.base64Decode(data.screenshot.b64),
        data.screenshot.type || "image/jpeg",
        stamp + "_" + gov.replace(/[^\w\- ]/g, "") + ".jpg"
      );
      const file = folder.createFile(blob);
      shotUrl = file.getUrl();
    }

    // append the row
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
      sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
      sheet.setFrozenRows(1);
    }
    sheet.appendRow([
      new Date(), gov, gameId, alliance,
      titlesStr, availUtc, availEntered, timezone, notes,
      g, tr, c, r,
      g + tr + c + r,
      disp("general"), disp("training"), disp("construction"), disp("research"),
      shotUrl
    ]);

    return reply({ ok: true });
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  }
}

/** quick health check: open the /exec URL in a browser, should say OK */
function doGet() {
  return ContentService.createTextOutput("BRO Speedups endpoint OK");
}

function getFolder_() {
  const it = DriveApp.getFoldersByName(FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER_NAME);
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
