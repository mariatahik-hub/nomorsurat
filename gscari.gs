// GANTI INI dengan ID spreadsheet "Nomor Surat"
const NOMOR_SURAT_SPREADSHEET_ID = '1bFys7G26VH-_7u0ITfzMJ0DWz4kBXAwwt8Zn8owhvzY';

/**
 * Helper: buka spreadsheet "Nomor Surat" secara eksplisit.
 */
function getNomorSuratSpreadsheet_() {
  return SpreadsheetApp.openById(NOMOR_SURAT_SPREADSHEET_ID);
}

/**
 * Mencari kode klasifikasi surat di sheet "Database_Kode"
 * berdasarkan kata kunci (kode/uraian/kata kunci tambahan).
 */
function searchKodeKlasifikasi(keyword) {
  keyword = (keyword || '').toString().trim();
  var keywordLower = keyword.toLowerCase();

  var ss = getNomorSuratSpreadsheet_();
  var dbSheet = ss.getSheetByName('Database_Kode');
  if (!dbSheet) {
    throw new Error('Sheet "Database_Kode" tidak ditemukan di spreadsheet Nomor Surat.');
  }

  var values = dbSheet.getDataRange().getValues();
  if (!values || values.length < 2) {
    return [];
  }

  var headers = values[0];

  var idxKode          = headers.indexOf('Kode');
  var idxUraian        = headers.indexOf('Uraian');
  var idxKelompokUtama = headers.indexOf('KelompokUtama');
  var idxKelompokSub   = headers.indexOf('KelompokSub');
  var idxParent        = headers.indexOf('ParentKode');
  var idxKataKunci     = headers.indexOf('KataKunciTambahan');
  var idxAktif         = headers.indexOf('Aktif');

  if (idxKode === -1 || idxUraian === -1) {
    throw new Error('Kolom "Kode" atau "Uraian" tidak ditemukan di header Database_Kode.');
  }

  var results = [];

  for (var i = 1; i < values.length; i++) {
    var row = values[i];

    // Cek apakah baris benar-benar kosong
    var allEmpty = true;
    for (var c = 0; c < row.length; c++) {
      if (row[c] !== '' && row[c] !== null) {
        allEmpty = false;
        break;
      }
    }
    if (allEmpty) continue;

    // Filter hanya yang aktif (jika kolom Aktif ada)
    if (idxAktif !== -1) {
      var aktif = row[idxAktif];
      if (aktif === false || aktif === 'FALSE' || aktif === 'false' || aktif === 0) {
        continue;
      }
    }

    var kode   = (row[idxKode]   || '').toString();
    var uraian = (row[idxUraian] || '').toString();

    // ⬇️ BAGIAN PENTING: buat teks gabungan dari SEMUA kolom di baris ini
    var combined = row
      .map(function(cell) {
        return (cell || '').toString().toLowerCase();
      })
      .join(' '); // semua kolom digabung jadi satu string besar

    // cek apakah keyword muncul di salah satu kolom
    if (combined.indexOf(keywordLower) !== -1) {
      results.push({
        kode: kode,
        uraian: uraian,
        kelompokUtama: idxKelompokUtama !== -1 ? (row[idxKelompokUtama] || '') : '',
        kelompokSub:   idxKelompokSub   !== -1 ? (row[idxKelompokSub]   || '') : '',
        parentKode:    idxParent        !== -1 ? (row[idxParent]        || '') : ''
      });
    }
  }

  // Catat history pencarian
  logSearchHistory_(ss, keyword, results.length);

  return results;
}

/**
 * Menyimpan history pencarian di sheet "History_Pencarian".
 * Kolom: Timestamp | UserEmail | Keyword | ResultCount
 */
function logSearchHistory_(ss, keyword, resultCount) {
  var sheetName = 'History_Pencarian';
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, 4).setValues([['Timestamp', 'UserEmail', 'Keyword', 'ResultCount']]);
  }

  var userEmail = '';
  try {
    userEmail = Session.getActiveUser().getEmail() || '';
  } catch (e) {
    userEmail = '';
  }

  var row = [
    new Date(),
    userEmail,
    keyword,
    resultCount
  ];

  sheet.appendRow(row);
}
