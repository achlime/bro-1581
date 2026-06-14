/**
 * [BRO] Brotherhood — Speedup Census backend
 * Receives submissions from speedups.html, logs them to this spreadsheet,
 * and saves screenshots to a Drive folder.
 *
 * ── ONE-TIME SETUP (~10 minutes) ────────────────────────────────────────────
 * 1. Go to sheets.google.com → create a new spreadsheet, name it "BRO Speedups".
 * 2. In that sheet: Extensions → Apps Script. Delete the sample code and paste
 *    this entire file. Save (Ctrl+S).
 * 3. Click "Deploy" → "New deployment" → gear icon → "Web app".
 *      - Description: BRO Speedups
 *      - Execute as: Me
 *      - Who has access: Anyone        ← required so members can submit
 *    Click Deploy. Authorize when prompted (it only touches this sheet + a
 *    Drive folder it creates).
 * 4. Copy the Web app URL (ends in /exec).
 * 5. In speedups.html, paste that URL into:  const SCRIPT_URL = "...";
 *    Commit + push. Done — submissions appear as rows here, screenshots in
 *    a Drive folder called "BRO Speedup Screenshots".
 *
 * To update the script later: edit, then Deploy → Manage deployments → edit
 * (pencil) → Version: New version → Deploy. The URL stays the same.
 * ───────────────────────────────────────────────────────────────────────────
 */

const FOLDER_NAME = "BRO Speedup Screenshots";
const ALLIANCES = ["[BRO] Brotherhood", "[bra] BroAcademy", "[bro] BROacademy"];
const HEADERS = [
  "Timestamp", "Governor", "Alliance",
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

    // alliance must be one of the known options (defends the public endpoint)
    let alliance = String(data.alliance || "").trim();
    if (ALLIANCES.indexOf(alliance) === -1) alliance = "";
    if (!alliance) return reply({ ok: false, error: "Missing or invalid alliance" });

    const en = data.entries || {};
    const mins = t => Math.max(0, parseInt(en[t] && en[t].minutes, 10) || 0);
    const disp = t => String((en[t] && en[t].display) || "0").slice(0, 40);
    const c = mins("construction"), r = mins("research"), tr = mins("training"), g = mins("general");

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
      new Date(), gov, alliance,
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
