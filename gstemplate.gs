/***********************
 * Web App Entry Point *
 ***********************/
function doGet(e) {
  var page = (e && e.parameter && e.parameter.page) ? e.parameter.page : 'cari';

  // Map URL page parameter ke nama file HTML konten
  var pageTemplates = {
    'dashboard' : 'cari',      // alias, kalau kamu mau punya dashboard terpisah nanti bisa diubah
    'cari'      : 'cari',
    'history'   : 'history',
    'login'     : 'login',
    'database'  : 'database',
    'ringkasan' : 'ringkasan'
  };

  var contentTemplate = pageTemplates[page] || 'cari';

  var template = HtmlService.createTemplateFromFile('template');
  template.contentTemplate = contentTemplate;
  template.currentPage     = page;
  template.isAdmin         = isAdmin_();
  template.userEmail       = Session.getActiveUser().getEmail() || '';

  var output = template
    .evaluate()
    .setTitle('Kode Klasifikasi Surat')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  return output;
}

/*********************************
 * Helper: include file HTML lain *
 *********************************/
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename)
    .getContent();
}

/*************************************
 * Helper: ambil URL web app aktif   *
 *************************************/
function getScriptUrl() {
  return ScriptApp.getService().getUrl();
}

/*****************************************
 * Helper: logika role admin vs user     *
 * UBAH LIST EMAIL ADMIN SESUAI KEBUTUHAN *
 *****************************************/
function isAdmin_() {
  // TODO: ubah list email admin sesuai kebutuhan instansi
  var adminEmails = [
    'disdikbudkepegum@gmail.com'
  ];

  var email = Session.getActiveUser().getEmail();
  if (!email) {
    // Jika web app di-set "Anyone with the link", email bisa kosong.
    // Untuk development, kamu bisa sementara return true.
    // return true; // dev only
    return false; // production default
  }

  return adminEmails.indexOf(email) !== -1;
}
