/**
 * LANG-CARE (async) — Google Sheets receiver
 *
 * One row per CONDITION (2 rows per child). Mirrors RELKIND's setup.
 *
 * Setup:
 *   1. Make a new Google Sheet (this is your data file).
 *   2. Extensions → Apps Script → paste this whole file → Save.
 *   3. Deploy → New deployment:
 *        Type:           Web app
 *        Description:    LANG-CARE data receiver
 *        Execute as:     Me (your account)
 *        Who has access: Anyone
 *   4. Copy the Web app URL (…/exec) and paste it into experiment.js as
 *        CONFIG.SHEETS_WEBHOOK.
 *   5. Visit that URL in a browser — you should see "LANG-CARE receiver is live."
 *
 * The front end posts { headers: [...], row: {...} } as text/plain. The sheet's
 * header row is written once from `headers`, and each POST appends one data row
 * in the sheet's column order (so it's robust if you reorder columns later).
 */

const SHEET_NAME = 'Data';   // tab to write into; created if missing

function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) sheet = ss.insertSheet(SHEET_NAME);

    const data = JSON.parse(e.postData.contents);
    const incomingHeaders = data.headers || Object.keys(data.row || {});
    const row = data.row || {};

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(incomingHeaders);
      sheet.setFrozenRows(1);
    }

    const sheetHeaders = sheet
      .getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1))
      .getValues()[0];

    const rowValues = sheetHeaders.map(function (h) {
      const v = row[h];
      return v === undefined || v === null ? '' : v;
    });
    sheet.appendRow(rowValues);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  return ContentService
    .createTextOutput('LANG-CARE receiver is live.')
    .setMimeType(ContentService.MimeType.TEXT);
}
