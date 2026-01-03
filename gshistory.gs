/**
 * Ambil history pencarian dari sheet "History_Pencarian"
 * dengan filter tanggal, keyword/email dan limit.
 *
 * filters = {
 *   fromDate: 'YYYY-MM-DD' | '',
 *   toDate:   'YYYY-MM-DD' | '',
 *   keywordFilter: string,
 *   limit: number
 * }
 *
 * PENTING: ke client hanya dikirim STRING & NUMBER
 */
function getSearchHistory(filters) {
  if (!filters) {
    filters = {};
  }

  var limit = parseInt(filters.limit, 10) || 50;
  var fromStr = filters.fromDate || '';
  var toStr = filters.toDate || '';
  var keywordFilter = (filters.keywordFilter || '').toString().trim().toLowerCase();

  Logger.log('DEBUG getSearchHistory filters = %s', JSON.stringify(filters));

  var ss = getNomorSuratSpreadsheet_();
  var sheet = ss.getSheetByName('History_Pencarian');
  if (!sheet) {
    Logger.log('DEBUG getSearchHistory: sheet History_Pencarian tidak ada');
    return [];
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    Logger.log('DEBUG getSearchHistory: hanya header / kosong');
    return [];
  }

  // RAW untuk Date, DISPLAY untuk string aman
  var rawRange = sheet.getRange(1, 1, lastRow, 4);
  var rawValues = rawRange.getValues();          // ts = Date
  var dispValues = rawRange.getDisplayValues();  // tsStr = string

  var tz = Session.getScriptTimeZone() || 'Asia/Jakarta';

  // Konversi filter tanggal
  var fromDate = null;
  var toDate = null;
  try {
    if (fromStr) {
      fromDate = new Date(fromStr + 'T00:00:00');
    }
    if (toStr) {
      toDate = new Date(toStr + 'T23:59:59');
    }
  } catch (e) {
    Logger.log('DEBUG getSearchHistory: error parse filter date %s', e);
  }

  var result = [];

  // Loop dari baris terakhir (paling baru)
  for (var i = lastRow - 1; i >= 1; i--) {
    var rowRaw = rawValues[i];
    var rowDisp = dispValues[i];

    var ts = rowRaw[0];              // Date atau string
    var tsStr = rowDisp[0] || '';    // string tampilan di sheet
    var userEmail = rowRaw[1] || '';
    var keyword = rowRaw[2] || '';
    var rc = rowRaw[3];

    var resultCount = parseInt(rc, 10);
    if (isNaN(resultCount)) resultCount = 0;

    // ---- Filter tanggal (pakai raw Date, tidak dikirim ke client) ----
    var tsDate = ts instanceof Date ? ts : null;

    if (fromDate && tsDate && tsDate < fromDate) {
      // lebih lama dari "dari tanggal" → skip
      continue;
    }

    if (toDate && tsDate && tsDate > toDate) {
      // lebih baru dari "sampai tanggal" → skip
      continue;
    }

    // ---- Filter keyword/email ----
    if (keywordFilter) {
      var haystack = (String(userEmail) + ' ' + String(keyword)).toLowerCase();
      if (haystack.indexOf(keywordFilter) === -1) {
        continue;
      }
    }

    // ---- Susun object aman untuk client (STRING & NUMBER saja) ----
    result.push({
      timestampFormatted: String(tsStr),
      userEmail: String(userEmail),
      keyword: String(keyword),
      resultCount: resultCount
    });

    if (result.length >= limit) {
      break;
    }
  }

  Logger.log('DEBUG getSearchHistory: return ' + result.length + ' baris');
  return result;
}
