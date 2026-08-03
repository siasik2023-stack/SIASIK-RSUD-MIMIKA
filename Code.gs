/**
 * ============================================================
 *  SIASIK — Sistem Informasi Aset dan Logistik
 *  RSUD Mimika
 *  Dibangun dengan Google Apps Script (Runtime V8)
 * ============================================================
 *  Fitur:
 *   - Dashboard monitoring real-time (statistik & grafik)
 *   - Form input Aset Masuk & Aset Keluar
 *   - Logika stok otomatis pada Master Inventory
 *   - Monitoring distribusi per ruangan/departemen
 *   - Autentikasi: whitelist email + pencatatan pengguna input
 * ============================================================
 */

// ---------- Konfigurasi ----------
var NAMA_SHEET_MASTER = 'Master Inventory';
var NAMA_SHEET_MASUK  = 'Asset Masuk';
var NAMA_SHEET_KELUAR = 'Asset Keluar';

// Kunci Script Properties
var KUNCI_SPREADSHEET    = 'SIASIK_SPREADSHEET_ID';
var KUNCI_ALLOWED_EMAILS = 'SIASIK_ALLOWED_EMAILS'; // dipisahkan koma; kosong = semua akun Google boleh
var KUNCI_TEMA_GLOBAL    = 'SIASIK_TEMA'; // default tema global: '' (tak diatur) | 'auto' | 'terang' | 'gelap'

var STOK_MINIMUM = 5; // ambang batas status "Menipis"

// Daftar ruangan saran (akan muncul di dropdown & autocomplete)
var SARAN_RUANGAN = ['IGD', 'Rawat Inap', 'Rawat Jalan', 'Kamar Operasi', 'ICU', 'Radiologi', 'Laboratorium', 'Farmasi', 'Gudang Alkes', 'Gizi'];

var HEADER_MASTER = ['Kode Aset', 'Nama Aset', 'Kategori', 'Spesifikasi', 'Lokasi Penyimpanan', 'Jumlah Total', 'Satuan', 'Kondisi', 'Tanggal Masuk', 'Status', 'PIC'];
var HEADER_MASUK  = ['No. Transaksi', 'Tanggal Masuk', 'Kode Aset', 'Nama Aset', 'Kategori', 'Jumlah', 'Satuan', 'Kondisi', 'Asal Aset', 'Keterangan', 'Dicatat Oleh', 'Waktu Dicatat'];
var HEADER_KELUAR = ['No. Transaksi', 'Tanggal Keluar', 'Kode Aset', 'Nama Aset', 'Kategori', 'Jumlah', 'Satuan', 'Tujuan Ruangan', 'Departemen / Penerima', 'Keterangan', 'Dicatat Oleh', 'Waktu Dicatat'];

var WARNA_HEADER = '#0f766e';

// ---------- Web App: entry point ----------
function doGet() {
  var email = Session.getActiveUser().getEmail();
  if (!email || !dapatMengakses_(email)) {
    return HtmlService.createHtmlOutputFromFile('AksesDitolak')
      .setTitle('SIASIK — Akses Ditolak');
  }
  ensureSheets_();
  var html = HtmlService.createTemplateFromFile('Index');
  html.userEmail = email;
  return html.evaluate()
    .setTitle('SIASIK — Sistem Informasi Aset & Logistik RSUD Mimika')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(nama) {
  return HtmlService.createHtmlOutputFromFile(nama).getContent();
}

// ---------- Menu spreadsheet (jika script terikat ke spreadsheet) ----------
function onOpen() {
  try {
    var ui = SpreadsheetApp.getUi();
    // Tampilkan nilai default global saat ini di label submenu (jika PropertiesService tersedia)
    var temaSekarang = '';
    try { temaSekarang = getTemaGlobal(); } catch (e) { /* abaikan */ }
    var labelSubmenu = temaSekarang === 'gelap' ? 'Tema Global: 🌙 Gelap'
      : temaSekarang === 'terang' ? 'Tema Global: ☀️ Terang'
      : temaSekarang === 'auto' ? 'Tema Global: 🌗 Auto'
      : 'Tema Global';
    ui.createMenu('SIASIK')
      .addItem('Siapkan Database', 'siapkanDatabase')
      .addSeparator()
      .addSubMenu(ui.createMenu(labelSubmenu)
        .addItem('🌗 Auto (ikuti sistem)', 'setTemaGlobalAuto')
        .addItem('☀️ Terang', 'setTemaGlobalTerang')
        .addItem('🌙 Gelap', 'setTemaGlobalGelap')
        .addItem('Hapus default (ikuti sistem)', 'hapusTemaGlobal'))
      .addToUi();
  } catch (e) { /* script tidak terikat ke spreadsheet */ }
}

// Handler item menu spreadsheet — atur default tema global tanpa membuka aplikasi
function setTemaGlobalAuto()   { aturTemaGlobalDariMenu_('auto'); }
function setTemaGlobalTerang() { aturTemaGlobalDariMenu_('terang'); }
function setTemaGlobalGelap()  { aturTemaGlobalDariMenu_('gelap'); }
function hapusTemaGlobal()     { aturTemaGlobalDariMenu_(''); }

function aturTemaGlobalDariMenu_(tema) {
  var ui = null;
  try { ui = SpreadsheetApp.getUi(); } catch (e) { /* bukan konteks spreadsheet */ }
  try {
    setTemaGlobal(tema);
    var label = tema === 'gelap' ? '🌙 Gelap'
      : tema === 'terang' ? '☀️ Terang'
      : tema === 'auto' ? '🌗 Auto (ikuti sistem)'
      : 'Ikuti sistem (default dihapus)';
    if (ui) ui.alert('Tema Global', 'Default tema global disimpan: ' + label + '.\nPreferensi lokal pengguna di perangkatnya tetap menang.', ui.ButtonSet.OK);
  } catch (e) {
    if (ui) ui.alert('Gagal Mengatur Tema Global', String((e && e.message) || e), ui.ButtonSet.OK);
    else throw e;
  }
}

function siapkanDatabase() {
  ensureSheets_();
  var ss = getSpreadsheet_();
  try {
    SpreadsheetApp.getUi().alert('Database SIASIK siap digunakan!\nSpreadsheet: ' + ss.getName());
  } catch (e) {
    // Script standalone (tidak terikat ke spreadsheet) — tidak bisa menampilkan dialog
    Logger.log('Database SIASIK siap: ' + ss.getName());
  }
}

// ---------- Autentikasi / akses ----------
function dapatMengakses_(email) {
  var daftar = PropertiesService.getScriptProperties().getProperty(KUNCI_ALLOWED_EMAILS) || '';
  if (String(daftar).trim() === '') return true; // semua akun Google boleh
  var kunci = String(daftar).split(',').map(function (s) { return s.trim().toLowerCase(); });
  return kunci.indexOf(String(email).toLowerCase()) >= 0;
}

function getCurrentUser() {
  return Session.getActiveUser().getEmail() || '';
}

// ---------- Preferensi tema global (Script Properties) ----------
// Default tema untuk semua pengguna; user tetap bisa override di perangkatnya (localStorage).
function getTemaGlobal() {
  return PropertiesService.getScriptProperties().getProperty(KUNCI_TEMA_GLOBAL) || '';
}

function setTemaGlobal(tema) {
  // Hanya admin (pemilik skrip) yang dapat mengatur default global; tolak juga pemanggil anonim
  var admin = Session.getEffectiveUser().getEmail();
  var user = Session.getActiveUser().getEmail();
  if (!admin || String(user).toLowerCase() !== String(admin).toLowerCase()) {
    throw new Error('Hanya admin (pemilik skrip) yang dapat mengatur tema global.');
  }
  tema = String(tema || '').trim();
  if (tema && ['auto', 'terang', 'gelap'].indexOf(tema) < 0) {
    throw new Error('Nilai tema tidak valid: ' + tema);
  }
  var props = PropertiesService.getScriptProperties();
  if (tema) props.setProperty(KUNCI_TEMA_GLOBAL, tema);
  else props.deleteProperty(KUNCI_TEMA_GLOBAL);
  return { sukses: true, tema: tema };
}

// ---------- Spreadsheet / sheet ----------
function getSpreadsheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) return ss;
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(KUNCI_SPREADSHEET);
  if (id) return SpreadsheetApp.openById(id);
  // Buat spreadsheet baru sebagai database
  ss = SpreadsheetApp.create('Database SIASIK - RSUD Mimika');
  props.setProperty(KUNCI_SPREADSHEET, ss.getId());
  return ss;
}

function ensureSheets_() {
  var ss = getSpreadsheet_();
  var definisi = [
    { nama: NAMA_SHEET_MASTER, header: HEADER_MASTER },
    { nama: NAMA_SHEET_MASUK,  header: HEADER_MASUK },
    { nama: NAMA_SHEET_KELUAR, header: HEADER_KELUAR }
  ];
  definisi.forEach(function (d) {
    var sheet = ss.getSheetByName(d.nama);
    if (!sheet) {
      sheet = ss.insertSheet(d.nama);
      sheet.appendRow(d.header);
      sheet.getRange(1, 1, 1, d.header.length)
        .setBackground(WARNA_HEADER)
        .setFontColor('#ffffff')
        .setFontWeight('bold');
      sheet.setFrozenRows(1);
      try { sheet.autoResizeColumns(1, d.header.length); } catch (e) { /* abaikan */ }
    }
  });
  // Hapus sheet default yang kosong (hanya bila benar-benar kosong)
  var def = ss.getSheetByName('Sheet1');
  if (def && def.getLastRow() === 0) ss.deleteSheet(def);
}

// ---------- Kunci eksekusi (cegah race condition saat tulis) ----------
function denganKunci_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

// ---------- Pembaca data ----------
function ambilData_(namaSheet, headers) {
  ensureSheets_();
  var sheet = getSpreadsheet_().getSheetByName(namaSheet);
  var data = sheet.getDataRange().getValues();
  var hasil = [];
  for (var i = 1; i < data.length; i++) {
    var baris = data[i];
    if (String(baris.join('')).trim() === '') continue;
    var obj = {};
    for (var j = 0; j < headers.length; j++) obj[headers[j]] = baris[j];
    hasil.push(obj);
  }
  return hasil;
}

function getMasterAset() {
  return ambilData_(NAMA_SHEET_MASTER, HEADER_MASTER);
}

function getDaftarAset() {
  return getMasterAset().map(function (a) {
    return {
      kode: a['Kode Aset'],
      nama: a['Nama Aset'],
      stok: Number(a['Jumlah Total']) || 0,
      satuan: a['Satuan'],
      kategori: a['Kategori'],
      lokasi: a['Lokasi Penyimpanan'],
      kondisi: a['Kondisi']
    };
  });
}

function getRiwayatMasuk(limit) {
  var d = ambilData_(NAMA_SHEET_MASUK, HEADER_MASUK);
  d.sort(function (a, b) { return String(b['Waktu Dicatat']).localeCompare(String(a['Waktu Dicatat'])); });
  return d.slice(0, limit || 100);
}

function getRiwayatKeluar(limit) {
  var d = ambilData_(NAMA_SHEET_KELUAR, HEADER_KELUAR);
  d.sort(function (a, b) { return String(b['Waktu Dicatat']).localeCompare(String(a['Waktu Dicatat'])); });
  return d.slice(0, limit || 100);
}

// ---------- Dashboard ----------
function getDashboardData() {
  var master = getMasterAset();
  var masuk = ambilData_(NAMA_SHEET_MASUK, HEADER_MASUK);
  var keluar = ambilData_(NAMA_SHEET_KELUAR, HEADER_KELUAR);

  var now = new Date();
  var bulanIni = now.getFullYear() + '-' + ('0' + (now.getMonth() + 1)).slice(-2);

  var totalAset = master.length;
  var totalStok = master.reduce(function (s, r) { return s + (Number(r['Jumlah Total']) || 0); }, 0);
  var masukBulanIni = jumlahPadaBulan_(masuk, 'Tanggal Masuk', bulanIni);
  var keluarBulanIni = jumlahPadaBulan_(keluar, 'Tanggal Keluar', bulanIni);

  return {
    totalAset: totalAset,
    totalStok: totalStok,
    masukBulanIni: masukBulanIni,
    keluarBulanIni: keluarBulanIni,
    kategori: getKategoriRingkasan_(),
    ringkasanDistribusi: getRingkasanDistribusi_(),
    riwayat: getRiwayatTransaksi_(8)
  };
}

function jumlahPadaBulan_(rows, kolomTanggal, bulan) {
  return rows
    .filter(function (r) { return String(r[kolomTanggal] || '').substring(0, 7) === bulan; })
    .reduce(function (s, r) { return s + (Number(r['Jumlah']) || 0); }, 0);
}

function getKategoriRingkasan_() {
  var master = getMasterAset();
  var agg = {};
  master.forEach(function (r) {
    var k = String(r['Kategori'] || '').trim() || '(Tanpa Kategori)';
    agg[k] = agg[k] || { kategori: k, jumlah: 0 };
    agg[k].jumlah += Number(r['Jumlah Total']) || 0;
  });
  var arr = Object.keys(agg).map(function (k) { return agg[k]; });
  arr.sort(function (a, b) { return b.jumlah - a.jumlah; });
  return arr;
}

function getRingkasanDistribusi_() {
  var keluar = ambilData_(NAMA_SHEET_KELUAR, HEADER_KELUAR);
  var agg = {};
  keluar.forEach(function (r) {
    var k = String(r['Tujuan Ruangan'] || '').trim() || '(Tanpa Ruangan)';
    agg[k] = agg[k] || { ruangan: k, totalKeluar: 0, jumlahTransaksi: 0 };
    agg[k].totalKeluar += Number(r['Jumlah']) || 0;
    agg[k].jumlahTransaksi += 1;
  });
  var arr = Object.keys(agg).map(function (k) { return agg[k]; });
  arr.sort(function (a, b) { return b.totalKeluar - a.totalKeluar; });
  return arr;
}

function getRingkasanDistribusi() {
  return getRingkasanDistribusi_();
}

function getTrenBulanan(periode, dari, sampai) {
  return getTrenBulanan_(periode || 6, dari || '', sampai || '');
}

function getTrenBulanan_(periode, dari, sampai) {
  var hasil = [];
  var now = new Date();
  var awal, akhir;
  if (dari && sampai) {
    awal = new Date(Number(dari.substring(0, 4)), Number(dari.substring(5, 7)) - 1, 1);
    akhir = new Date(Number(sampai.substring(0, 4)), Number(sampai.substring(5, 7)) - 1, 1);
    if (awal > akhir) { var tukar = awal; awal = akhir; akhir = tukar; }
  } else {
    awal = new Date(now.getFullYear(), now.getMonth() - (periode - 1), 1);
    akhir = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  var t = new Date(awal.getFullYear(), awal.getMonth(), 1);
  var maksBulan = 24; // batas jumlah bulan yang digambar agar grafik tetap terbaca
  while (t <= akhir && hasil.length < maksBulan) {
    var key = t.getFullYear() + '-' + ('0' + (t.getMonth() + 1)).slice(-2);
    hasil.push({ bulan: key, masuk: 0, keluar: 0 });
    t = new Date(t.getFullYear(), t.getMonth() + 1, 1);
  }
  var masuk = ambilData_(NAMA_SHEET_MASUK, HEADER_MASUK);
  var keluar = ambilData_(NAMA_SHEET_KELUAR, HEADER_KELUAR);
  masuk.forEach(function (r) {
    var tgl = String(r['Tanggal Masuk'] || '');
    if ((dari && tgl < dari) || (sampai && tgl > sampai)) return;
    var k = tgl.substring(0, 7);
    for (var j = 0; j < hasil.length; j++) if (hasil[j].bulan === k) { hasil[j].masuk += Number(r['Jumlah']) || 0; break; }
  });
  keluar.forEach(function (r) {
    var tgl = String(r['Tanggal Keluar'] || '');
    if ((dari && tgl < dari) || (sampai && tgl > sampai)) return;
    var k = tgl.substring(0, 7);
    for (var j = 0; j < hasil.length; j++) if (hasil[j].bulan === k) { hasil[j].keluar += Number(r['Jumlah']) || 0; break; }
  });
  return hasil;
}

function getRiwayatTransaksi(limit) {
  return getRiwayatTransaksi_(limit || 100);
}

// ---------- Laporan terpusat (halaman 'Laporan') ----------
function dalamPeriodeServer_(tgl, dari, sampai) {
  tgl = String(tgl || '');
  if (!tgl) return false;
  if (dari && tgl < dari) return false;
  if (sampai && tgl > sampai) return false;
  return true;
}

function rekapServer_(rows, kolomUtama, kolomNilai, labelKosong) {
  var agg = {};
  rows.forEach(function (r) {
    var k = String(r[kolomUtama] || '').trim() || labelKosong || '(Tanpa)';
    agg[k] = agg[k] || { nama: k, jumlah: 0, transaksi: 0 };
    agg[k].jumlah += Number(r[kolomNilai]) || 0;
    agg[k].transaksi += 1;
  });
  var arr = Object.keys(agg).map(function (k) { return agg[k]; });
  arr.sort(function (a, b) { return b.jumlah - a.jumlah; });
  return arr;
}

function trenRekapServer_(masuk, keluar) {
  // Bucket bulan dibangun hanya dari bulan yang memiliki transaksi dalam periode
  var bulanSet = {};
  masuk.forEach(function (r) {
    var k = String(r['Tanggal Masuk'] || '').substring(0, 7);
    if (k) bulanSet[k] = true;
  });
  keluar.forEach(function (r) {
    var k = String(r['Tanggal Keluar'] || '').substring(0, 7);
    if (k) bulanSet[k] = true;
  });
  var hasil = Object.keys(bulanSet).sort().map(function (b) { return { bulan: b, masuk: 0, keluar: 0 }; });
  masuk.forEach(function (r) {
    var k = String(r['Tanggal Masuk'] || '').substring(0, 7);
    if (!k) return;
    for (var i = 0; i < hasil.length; i++) if (hasil[i].bulan === k) { hasil[i].masuk += Number(r['Jumlah']) || 0; break; }
  });
  keluar.forEach(function (r) {
    var k = String(r['Tanggal Keluar'] || '').substring(0, 7);
    if (!k) return;
    for (var i = 0; i < hasil.length; i++) if (hasil[i].bulan === k) { hasil[i].keluar += Number(r['Jumlah']) || 0; break; }
  });
  return hasil;
}

function getDataLaporan(dari, sampai) {
  dari = dari || '';
  sampai = sampai || '';
  var master = getMasterAset();
  var masuk = ambilData_(NAMA_SHEET_MASUK, HEADER_MASUK);
  var keluar = ambilData_(NAMA_SHEET_KELUAR, HEADER_KELUAR);
  var masukFilter = masuk.filter(function (r) { return dalamPeriodeServer_(r['Tanggal Masuk'], dari, sampai); });
  var keluarFilter = keluar.filter(function (r) { return dalamPeriodeServer_(r['Tanggal Keluar'], dari, sampai); });
  function jumlah(rows, kolom) {
    return rows.reduce(function (s, r) { return s + (Number(r[kolom]) || 0); }, 0);
  }
  return {
    statistik: {
      totalAset: master.length,
      totalStok: jumlah(master, 'Jumlah Total'),
      masukPeriode: jumlah(masukFilter, 'Jumlah'),
      keluarPeriode: jumlah(keluarFilter, 'Jumlah'),
      transaksiMasuk: masukFilter.length,
      transaksiKeluar: keluarFilter.length
    },
    stokKategori: rekapServer_(master, 'Kategori', 'Jumlah Total', '(Tanpa Kategori)'),
    masukKategori: rekapServer_(masukFilter, 'Kategori', 'Jumlah', '(Tanpa Kategori)'),
    keluarRuangan: rekapServer_(keluarFilter, 'Tujuan Ruangan', 'Jumlah', '(Tanpa Ruangan)'),
    tren: trenRekapServer_(masukFilter, keluarFilter)
  };
}

function getRiwayatTransaksi_(limit) {
  var masuk = ambilData_(NAMA_SHEET_MASUK, HEADER_MASUK);
  var keluar = ambilData_(NAMA_SHEET_KELUAR, HEADER_KELUAR);
  var semua = [];
  masuk.forEach(function (r) {
    semua.push({
      jenis: 'Masuk',
      tanggal: r['Tanggal Masuk'],
      kode: r['Kode Aset'],
      nama: r['Nama Aset'],
      jumlah: r['Jumlah'],
      satuan: r['Satuan'],
      ruangan: '',
      asal: r['Asal Aset'],
      keterangan: r['Keterangan'],
      waktu: r['Waktu Dicatat']
    });
  });
  keluar.forEach(function (r) {
    semua.push({
      jenis: 'Keluar',
      tanggal: r['Tanggal Keluar'],
      kode: r['Kode Aset'],
      nama: r['Nama Aset'],
      jumlah: r['Jumlah'],
      satuan: r['Satuan'],
      ruangan: r['Tujuan Ruangan'],
      asal: '',
      keterangan: r['Keterangan'],
      waktu: r['Waktu Dicatat']
    });
  });
  semua.sort(function (a, b) { return String(b.waktu).localeCompare(String(a.waktu)); });
  return semua.slice(0, limit || 10);
}

// ---------- Monitoring distribusi ----------
function getDistribusiByRuangan(ruangan) {
  var keluar = ambilData_(NAMA_SHEET_KELUAR, HEADER_KELUAR);
  var hasil = keluar;
  if (ruangan && ruangan !== 'SEMUA') {
    var cari = String(ruangan).trim().toLowerCase();
    hasil = keluar.filter(function (r) {
      return String(r['Tujuan Ruangan'] || '').trim().toLowerCase() === cari;
    });
  }
  hasil.sort(function (a, b) {
    return String(b['Tanggal Keluar'] + ' ' + b['Waktu Dicatat'])
      .localeCompare(String(a['Tanggal Keluar'] + ' ' + a['Waktu Dicatat']));
  });
  return hasil;
}

function getRuanganList() {
  var set = {};
  SARAN_RUANGAN.forEach(function (r) { set[r] = true; });
  ambilData_(NAMA_SHEET_KELUAR, HEADER_KELUAR).forEach(function (r) {
    var v = String(r['Tujuan Ruangan'] || '').trim();
    if (v) set[v] = true;
  });
  ambilData_(NAMA_SHEET_MASTER, HEADER_MASTER).forEach(function (r) {
    var v = String(r['Lokasi Penyimpanan'] || '').trim();
    if (v) set[v] = true;
  });
  return Object.keys(set).sort();
}

// ---------- Simpan Aset Masuk ----------
function simpanAsetMasuk(data) {
  return denganKunci_(function () { return simpanAsetMasukInternal_(data); });
}

function simpanAsetMasukInternal_(data) {
  var email = Session.getActiveUser().getEmail() || 'Anonim';
  var ss = getSpreadsheet_();
  var sheetMasuk = ss.getSheetByName(NAMA_SHEET_MASUK);
  var sheetMaster = ss.getSheetByName(NAMA_SHEET_MASTER);

  var namaAset = String(data.namaAset || '').trim();
  var jumlah = Number(data.jumlah) || 0;
  if (!namaAset) throw new Error('Nama aset wajib diisi.');
  if (jumlah <= 0) throw new Error('Jumlah harus lebih dari 0.');

  var masterData = sheetMaster.getDataRange().getValues();
  var idxBaris = cariBarisMaster_(masterData, '', namaAset);
  var kode = idxBaris >= 0 ? String(masterData[idxBaris][0]) : buatKodeAset_(sheetMaster);
  var kolomJumlah = HEADER_MASTER.indexOf('Jumlah Total') + 1;

  sheetMasuk.appendRow([
    buatNoTransaksi_('IN', sheetMasuk),
    String(data.tanggal || '').trim(),
    kode,
    namaAset,
    String(data.kategori || '').trim(),
    jumlah,
    String(data.satuan || '').trim() || 'unit',
    String(data.kondisi || '').trim() || 'Baru',
    String(data.asal || '').trim(),
    String(data.keterangan || '').trim(),
    email,
    formatWaktu_(new Date())
  ]);

  if (idxBaris >= 0) {
    // Aset sudah ada → tambah jumlah total + perbarui data yang diisi ulang
    var jumlahLama = Number(masterData[idxBaris][kolomJumlah - 1]) || 0;
    sheetMaster.getRange(idxBaris + 1, kolomJumlah).setValue(jumlahLama + jumlah);
    setStatus_(sheetMaster, idxBaris + 1);
    var isi = [data.kategori, data.spesifikasi, data.lokasi];
    var kolom = ['Kategori', 'Spesifikasi', 'Lokasi Penyimpanan'];
    for (var k = 0; k < kolom.length; k++) {
      if (String(isi[k] || '').trim()) {
        sheetMaster.getRange(idxBaris + 1, HEADER_MASTER.indexOf(kolom[k]) + 1).setValue(String(isi[k]).trim());
      }
    }
    if (!masterData[idxBaris][HEADER_MASTER.indexOf('PIC')]) {
      sheetMaster.getRange(idxBaris + 1, HEADER_MASTER.indexOf('PIC') + 1).setValue(email);
    }
  } else {
    // Aset baru → tambah baris baru di Master Inventory
    sheetMaster.appendRow([
      kode,
      namaAset,
      String(data.kategori || '').trim(),
      String(data.spesifikasi || '').trim(),
      String(data.lokasi || '').trim(),
      jumlah,
      String(data.satuan || '').trim() || 'unit',
      String(data.kondisi || '').trim() || 'Baru',
      String(data.tanggal || '').trim(),
      'Tersedia',
      email
    ]);
    setStatus_(sheetMaster, sheetMaster.getLastRow());
  }

  return { sukses: true, pesan: 'Aset masuk "' + namaAset + '" (' + jumlah + ' ' + (String(data.satuan || '').trim() || 'unit') + ') berhasil disimpan.', kode: kode };
}

// ---------- Simpan Aset Keluar ----------
function simpanAsetKeluar(data) {
  return denganKunci_(function () { return simpanAsetKeluarInternal_(data); });
}

function simpanAsetKeluarInternal_(data) {
  var email = Session.getActiveUser().getEmail() || 'Anonim';
  var ss = getSpreadsheet_();
  var sheetKeluar = ss.getSheetByName(NAMA_SHEET_KELUAR);
  var sheetMaster = ss.getSheetByName(NAMA_SHEET_MASTER);

  var kode = String(data.kodeAset || '').trim();
  var jumlah = Number(data.jumlah) || 0;
  if (!kode) throw new Error('Pilih aset terlebih dahulu.');
  if (jumlah <= 0) throw new Error('Jumlah harus lebih dari 0.');

  var masterData = sheetMaster.getDataRange().getValues();
  var idxBaris = cariBarisMaster_(masterData, kode, '');
  if (idxBaris < 0) throw new Error('Aset tidak ditemukan di Master Inventory.');

  var kolomJumlah = HEADER_MASTER.indexOf('Jumlah Total') + 1;
  var jumlahTersedia = Number(masterData[idxBaris][kolomJumlah - 1]) || 0;
  if (jumlah > jumlahTersedia) {
    throw new Error('Stok tidak mencukupi! Tersedia: ' + jumlahTersedia + ' ' + (String(data.satuan || '').trim() || 'unit') + '.');
  }

  sheetKeluar.appendRow([
    buatNoTransaksi_('OUT', sheetKeluar),
    String(data.tanggal || '').trim(),
    kode,
    String(masterData[idxBaris][1]),
    String(masterData[idxBaris][2]),
    jumlah,
    String(data.satuan || '').trim() || 'unit',
    String(data.ruangan || '').trim(),
    String(data.penerima || '').trim(),
    String(data.keterangan || '').trim(),
    email,
    formatWaktu_(new Date())
  ]);

  // Kurangi stok Master Inventory
  sheetMaster.getRange(idxBaris + 1, kolomJumlah).setValue(jumlahTersedia - jumlah);
  setStatus_(sheetMaster, idxBaris + 1);

  return { sukses: true, pesan: 'Aset keluar ke "' + data.ruangan + '" (' + jumlah + ' ' + (String(data.satuan || '').trim() || 'unit') + ') berhasil disimpan.', kode: kode };
}

// ---------- Hapus aset ----------
function hapusAset(kode) {
  return denganKunci_(function () { return hapusAsetInternal_(kode); });
}

function hapusAsetInternal_(kode) {
  var sheet = getSpreadsheet_().getSheetByName(NAMA_SHEET_MASTER);
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(kode)) {
      sheet.deleteRow(i + 1);
      return { sukses: true, pesan: 'Aset ' + kode + ' berhasil dihapus dari Master Inventory.' };
    }
  }
  throw new Error('Aset tidak ditemukan.');
}

// ---------- Helper ----------
function cariBarisMaster_(data, kode, nama) {
  kode = String(kode || '').trim().toLowerCase();
  nama = String(nama || '').trim().toLowerCase();
  for (var i = 1; i < data.length; i++) {
    var rk = String(data[i][0] || '').trim().toLowerCase();
    var rn = String(data[i][1] || '').trim().toLowerCase();
    if ((kode && rk === kode) || (nama && rn === nama)) return i;
  }
  return -1;
}

function buatKodeAset_(sheet) {
  var data = sheet.getDataRange().getValues();
  var max = 0;
  for (var i = 1; i < data.length; i++) {
    var m = String(data[i][0]).match(/^AST-(\d+)$/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return 'AST-' + ('0000' + (max + 1)).slice(-4);
}

function buatNoTransaksi_(prefix, sheet) {
  var data = sheet.getDataRange().getValues();
  var max = 0;
  var re = new RegExp('^' + prefix + '-(\\d+)$');
  for (var i = 1; i < data.length; i++) {
    var m = String(data[i][0]).match(re);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return prefix + '-' + ('0000' + (max + 1)).slice(-4);
}

function setStatus_(sheet, baris) {
  var kolomJumlah = HEADER_MASTER.indexOf('Jumlah Total') + 1;
  var jumlah = Number(sheet.getRange(baris, kolomJumlah).getValue()) || 0;
  var status;
  if (jumlah <= 0) status = 'Habis';
  else if (jumlah <= STOK_MINIMUM) status = 'Menipis';
  else status = 'Tersedia';
  sheet.getRange(baris, HEADER_MASTER.indexOf('Status') + 1).setValue(status);
}

function formatWaktu_(d) {
  function p(n) { return (n < 10 ? '0' : '') + n; }
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}
