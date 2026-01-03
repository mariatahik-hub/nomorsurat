/**
 * Ambil daftar subbagian aktif untuk dropdown (client).
 * Sheet: Ref_Subbagian
 */
function getSubbagianList() {
  var ss = getNomorSuratSpreadsheet_();
  var sh = ss.getSheetByName('Ref_Subbagian');
  if (!sh) throw new Error('Sheet "Ref_Subbagian" belum ada. Buat dulu di Spreadsheet.');

  var values = sh.getDataRange().getValues();
  if (!values || values.length < 2) return [];

  var headers = values[0];
  var idxKode = headers.indexOf('KodeSubbagian');
  var idxNama = headers.indexOf('NamaSubbagian');
  var idxAktif = headers.indexOf('Aktif');

  if (idxKode === -1 || idxNama === -1) {
    throw new Error('Header Ref_Subbagian wajib memuat: KodeSubbagian, NamaSubbagian, Aktif');
  }

  var out = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var kode = (row[idxKode] || '').toString().trim();
    var nama = (row[idxNama] || '').toString().trim();
    if (!kode) continue;

    if (idxAktif !== -1) {
      var aktif = row[idxAktif];
      if (aktif === false || aktif === 'FALSE' || aktif === 'false' || aktif === 0) continue;
    }
    out.push({ kode: kode, nama: nama });
  }
  return out;
}

/**
 * Generate nomor surat dan simpan ke register (AMAN dari double nomor)
 * payload:
 * {
 *   kodeKlasifikasi: "000.1.2",
 *   kodeSubbagian: "SEKRET",
 *   perihal: "Permohonan ...",
 *   namaPemohon: "Nama user",
 *   series: "SURAT",         // optional
 *   tanggalSurat: "YYYY-MM-DD" // optional (untuk tentukan tahun)
 * }
 */
function generateNomorSurat(payload) {
  payload = payload || {};
  var kodeKlas = String(payload.kodeKlasifikasi || '').trim();
  var kodeSub  = String(payload.kodeSubbagian || '').trim();
  var perihal  = String(payload.perihal || '').trim();
  var namaPemohon = String(payload.namaPemohon || '').trim();

  // Jenis surat: UMUM / PERJANJIAN
  var jenisSurat = String(payload.jenisSurat || 'UMUM').trim().toUpperCase();

  if (!kodeKlas) throw new Error('Kode klasifikasi wajib diisi.');
  if (!kodeSub)  throw new Error('Kode subbagian wajib dipilih.');

  var tanggalStr = String(payload.tanggalSurat || '').trim();
  var tanggal = tanggalStr ? new Date(tanggalStr + 'T00:00:00') : new Date();
  var tahun = tanggal.getFullYear();

  // Counter key: kalau kamu mau nomor urut "berlanjut" untuk semua surat umum,
  // pakai seriesGroup = 'UMUM'. Kalau mau dipisah, bisa pakai jenisSurat.
  var seriesGroup = (jenisSurat === 'PERJANJIAN') ? 'PERJANJIAN' : 'UMUM';

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    var ss = getNomorSuratSpreadsheet_();

    var counterSheet  = ensureSheet_(ss, 'Counter_NomorSurat',
      ['Tahun','Series','LastNumber','UpdatedAt']);

    var registerSheet = ensureSheet_(ss, 'Register_NomorSurat',
      ['Timestamp','UserEmail','NamaPemohon','Tahun','Series','NomorUrut','KodeKlasifikasi','KodeSubbagian','Perihal','NomorSurat']);

    var nextNumber = nextCounter_(counterSheet, tahun, seriesGroup);

    // FORMAT:
    // UMUM      : kode/urut/subbag
    // PERJANJIAN: kode/urut/subbag/tahun
    var nomorSurat = kodeKlas + '/' + nextNumber + '/' + kodeSub;
    if (jenisSurat === 'PERJANJIAN') {
      nomorSurat += '/' + tahun;
    }

    var userEmail = '';
    try { userEmail = Session.getActiveUser().getEmail() || ''; } catch (e) {}

    registerSheet.appendRow([
      new Date(),
      userEmail,
      namaPemohon,
      tahun,
      seriesGroup,
      nextNumber,
      kodeKlas,
      kodeSub,
      perihal,
      nomorSurat
    ]);

    return {
      nomorSurat: nomorSurat,
      nomorUrut: nextNumber,
      tahun: tahun,
      series: seriesGroup,
      jenisSurat: jenisSurat
    };
  } finally {
    lock.releaseLock();
  }
}

/** Helpers */
function ensureSheet_(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);

  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    // pastikan header ada (kalau sheet sudah dibuat manual tapi kosong)
    var firstRow = sh.getRange(1,1,1,headers.length).getValues()[0];
    var isEmpty = firstRow.every(function(x){ return !x; });
    if (isEmpty) sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sh;
}

function nextCounter_(counterSheet, tahun, series) {
  var values = counterSheet.getDataRange().getValues();
  var headers = values[0];

  var idxTahun = headers.indexOf('Tahun');
  var idxSeries = headers.indexOf('Series');
  var idxLast = headers.indexOf('LastNumber');
  var idxUpd  = headers.indexOf('UpdatedAt');

  // cari baris counter
  var rowIndex = -1;
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][idxTahun]) == String(tahun) && String(values[i][idxSeries]) == String(series)) {
      rowIndex = i + 1; // 1-based
      break;
    }
  }

  var lastNumber = 0;

  if (rowIndex === -1) {
    // belum ada counter untuk tahun+series ini
    counterSheet.appendRow([tahun, series, 0, new Date()]);
    rowIndex = counterSheet.getLastRow();
  } else {
    lastNumber = parseInt(values[rowIndex - 1][idxLast], 10);
    if (isNaN(lastNumber)) lastNumber = 0;
  }

  var nextNumber = lastNumber + 1;

  // update LastNumber
  counterSheet.getRange(rowIndex, idxLast + 1).setValue(nextNumber);
  counterSheet.getRange(rowIndex, idxUpd  + 1).setValue(new Date());

  return nextNumber;
}

/**
 * OPSI kalau suatu hari nomor urut mau DIPISAH per subbagian:
 * ubah nextCounter_() supaya kuncinya: tahun+series+kodeSubbagian
 * dan tambahkan kolom KodeSubbagian di Counter_NomorSurat.
 */
