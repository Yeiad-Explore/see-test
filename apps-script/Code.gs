// Standalone Apps Script (script.google.com > New project). Paste this, set SECRET, then Deploy > Web app (Execute as: Me, Access: Anyone).
// It writes into whichever sheet the server sends (SHEET_LINK), so one deployment serves any sheet you can edit.
const SECRET = 'change-me'; // must equal SCRIPT_SECRET on the server
const TAB = 'SeeTest results';
const KEY_TAB = 'Correct answers';

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const b = JSON.parse(e.postData.contents);
    if (b.secret !== SECRET) return out({ ok: false, error: 'wrong secret' });
    lock.waitLock(30000);
    const ss = SpreadsheetApp.openByUrl(b.sheet);
    const tab = ss.getSheetByName(TAB) || ss.insertSheet(TAB);
    if (tab.getLastRow() === 0) { tab.appendRow(b.header); tab.setFrozenRows(1); tab.getRange(1, 1, 1, b.header.length).setFontWeight('bold'); }
    const last = tab.getLastRow(), cols = b.header.length;
    // Ref is the last column: skip rows already written, so a retry never duplicates one.
    const have = new Set(last > 1 ? tab.getRange(2, cols, last - 1, 1).getValues().map((r) => String(r[0])) : []);
    const rows = b.rows.filter((r) => !have.has(String(r[r.length - 1])));
    if (rows.length) {
      tab.getRange(last + 1, 1, rows.length, 1).setNumberFormat('@'); // keep student IDs as text, e.g. leading zeros
      tab.getRange(last + 1, 1, rows.length, cols).setValues(rows);
    }
    const key = ss.getSheetByName(KEY_TAB) || ss.insertSheet(KEY_TAB);
    key.clear();
    key.getRange(1, 1, b.answers.length, b.answers[0].length).setValues(b.answers);
    key.getRange(1, 1, 1, b.answers[0].length).setFontWeight('bold');
    key.setFrozenRows(1);
    return out({ ok: true, added: rows.length });
  } catch (err) {
    return out({ ok: false, error: String(err) }); // e.g. no edit access to the sheet; the server logs it and retries
  } finally {
    lock.releaseLock();
  }
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
