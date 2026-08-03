#!/usr/bin/env node
// scripts/test-form-simas.js — Tes otomatis alur simpan Aset Masuk/Keluar &
// validasi periode filter laporan (dari logika ASLI demo SIASIK-Demo.html).
// Menjalankan logika demo di Node dengan DOM mock sehingga alur form & filter
// bisa diuji tanpa browser (menutup celah uji form).
// Cara pakai:  node scripts/test-form-simas.js
//
// KETERBATASAN (disengaja): harness menguji logika DEMO (mirror), bukan
// Code.gs/script.html asli. Demo mengembalikan {sukses:false} sedangkan
// fungsi server Code.gs melempar Error — jika app dan demo melenceng,
// tes ini tidak akan menangkapnya. Uji server asli membutuhkan mock Apps Script.
//
// Catatan teknis: blok <script> demo adalah kode top-level (tanpa IIFE), jadi
// semua fungsi & variabel (MASTER/MASUK/KELUAR) tersedia di konteks vm.
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const demoPath = path.join(__dirname, '..', 'SIASIK-Demo.html');
const html = fs.readFileSync(demoPath, 'utf8');

// --- Ekstrak blok <script> inline TERAKHIR (logika aplikasi) ---
const blok = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
if (!blok.length) { console.error('Tidak ada blok script inline di demo.'); process.exit(1); }
const src = blok[blok.length - 1];

// --- DOM mock ---
// Catatan: getElementById sengaja auto-membuat elemen untuk id yang belum
// dikenal (toleransi agar render/init dengan mock tetap berjalan).
function buatEl(id) {
  return {
    id: id, value: '', textContent: '', innerHTML: '', className: '', disabled: false,
    checked: false, hidden: false, required: false,
    dataset: {}, style: {}, _children: [],
    options: [], selectedIndex: -1, // untuk elemen <select>
    _listeners: {},
    addEventListener(t, fn) { (this._listeners[t] = this._listeners[t] || []).push(fn); },
    removeEventListener() {}, dispatchEvent() {},
    reset() { this.value = ''; this.innerHTML = ''; this.textContent = ''; },
    setAttribute() {}, getAttribute() { return null; }, removeAttribute() {},
    appendChild(c) { this._children.push(c); return c; },
    remove() { this._children.length = 0; },
    removeChild(c) { const i = this._children.indexOf(c); if (i >= 0) this._children.splice(i, 1); },
    cloneNode() { return buatEl(id); },
    getContext() { return { canvas: this }; },
    focus() {}, blur() {}, click() {}, setSelectionRange() {}, closest() { return null; }
  };
}
const registry = new Map();
function getEl(id) {
  if (!registry.has(id)) registry.set(id, buatEl(id));
  return registry.get(id);
}
const document = {
  getElementById: getEl,
  addEventListener() {}, // DOMContentLoaded tidak dijalankan — init dikontrol manual
  createElement(tag) { return buatEl('gen-' + tag); },
  body: buatEl('body'),
  documentElement: buatEl('html'),
  title: ''
};

// --- localStorage mock ---
const store = new Map();
const localStorage = {
  getItem(k) { return store.has(k) ? store.get(k) : null; },
  setItem(k, v) { store.set(k, String(v)); },
  removeItem(k) { store.delete(k); },
  clear() { store.clear(); }
};

// --- Stub Chart (CDN tidak tersedia di Node) ---
function ChartStub() { return { destroy() {} }; }

const sandbox = {
  document, localStorage, console,
  setTimeout, clearTimeout, Date, JSON, Math, String, Number, Object, Array,
  Boolean, RegExp, parseInt, parseFloat, isNaN, encodeURIComponent, decodeURIComponent,
  Chart: ChartStub
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;

let gagal = 0;
function cek(nama, ok, detail) {
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + nama + (detail !== undefined ? ' — ' + detail : ''));
  if (!ok) gagal++;
}
// Isolasi crash: error dari mock DOM yang kurang dilaporkan bersih (bukan stack mentah)
function seksi(nama, fn) {
  try { fn(); } catch (e) {
    cek(nama, false, 'ERROR (mock DOM kurang memadai?): ' + e.message);
  }
}

// --- Jalankan logika demo ---
vm.createContext(sandbox);
try {
  vm.runInContext(src, sandbox, { filename: 'SIASIK-Demo.html' });
} catch (e) {
  console.error('❌ Gagal mengeksekusi logika demo: ' + e.message);
  process.exit(1);
}

const simpanMasuk = sandbox.simpanAsetMasuk_;
const simpanKeluar = sandbox.simpanAsetKeluar_;
if (typeof simpanMasuk !== 'function' || typeof simpanKeluar !== 'function') {
  console.error('Fungsi simpan tidak ditemukan di demo.');
  process.exit(1);
}

// --- Seed data demo (seperti muatPenyimpanan_ saat halaman dibuka) ---
sandbox.muatPenyimpanan_();
cek('Seed data demo dimuat (MASTER > 0)', Array.isArray(sandbox.MASTER) && sandbox.MASTER.length > 0,
  sandbox.MASTER.length + ' aset, ' + sandbox.MASUK.length + ' masuk, ' + sandbox.KELUAR.length + ' keluar');
const masterAwal = JSON.parse(JSON.stringify(sandbox.MASTER));
const masukAwal = JSON.parse(JSON.stringify(sandbox.MASUK));

/* --- Tes 1: simpan aset BARU --- */
seksi('T1 aset baru', function () {
  const jmlSebelum = sandbox.MASTER.length;
  const r1 = simpanMasuk({
    namaAset: 'Printer Uji Otomatis', jumlah: 2, satuan: 'unit', kategori: 'Elektronik',
    spesifikasi: 'Laser', lokasi: 'Gudang ATK', kondisi: 'Baik', asal: 'Uji', tanggal: '2026-08-03'
  });
  cek('T1 aset baru: sukses', r1 && r1.sukses === true, r1 && r1.pesan);
  cek('T1 aset baru: baris MASTER bertambah 1', sandbox.MASTER.length === jmlSebelum + 1,
    jmlSebelum + ' -> ' + sandbox.MASTER.length);
  const baru = sandbox.MASTER.find((a) => a['Nama Aset'] === 'Printer Uji Otomatis');
  cek('T1 aset baru: Jumlah Total = 2', !!baru && Number(baru['Jumlah Total']) === 2);
  cek('T1 aset baru: kode terbentuk (AST-)', !!baru && /^AST-\d+$/.test(baru['Kode Aset']), baru && baru['Kode Aset']);
  cek('T1 aset baru: transaksi MASUK tercatat', sandbox.MASUK.length === masukAwal.length + 1 &&
    sandbox.MASUK[0]['Nama Aset'] === 'Printer Uji Otomatis');
  cek('T1 aset baru: tersimpan ke localStorage',
    JSON.parse(localStorage.getItem('siasik_demo_master') || '[]').some((a) => a['Nama Aset'] === 'Printer Uji Otomatis'));
});

/* --- Tes 2: aset SUDAH ADA -> stok bertambah (tanpa baris baru) --- */
seksi('T2 aset lama', function () {
  const namaLama = masterAwal[0]['Nama Aset'];
  const stokLama = Number(masterAwal[0]['Jumlah Total']) || 0;
  const jmlSebelum = sandbox.MASTER.length;
  const r2 = simpanMasuk({ namaAset: namaLama, jumlah: 3, satuan: 'unit', tanggal: '2026-08-02' });
  const aset2 = sandbox.MASTER.find((a) => a['Nama Aset'] === namaLama);
  cek('T2 aset lama: sukses & stok bertambah 3',
    !!aset2 && r2.sukses === true && Number(aset2['Jumlah Total']) === stokLama + 3,
    stokLama + ' -> ' + (aset2 && aset2['Jumlah Total']));
  cek('T2 aset lama: tanpa baris MASTER baru', sandbox.MASTER.length === jmlSebelum);
});

/* --- Tes 3: validasi nama kosong --- */
seksi('T3 nama kosong', function () {
  const lenT3 = sandbox.MASTER.length;
  const r3 = simpanMasuk({ namaAset: '   ', jumlah: 1 });
  cek('T3 nama kosong: ditolak', r3.sukses === false && /nama aset wajib/i.test(r3.pesan), r3.pesan);
  cek('T3 nama kosong: data tidak berubah', sandbox.MASTER.length === lenT3);
});

/* --- Tes 4: validasi jumlah <= 0 --- */
seksi('T4 jumlah <= 0', function () {
  const r4a = simpanMasuk({ namaAset: 'Tes', jumlah: 0 });
  cek('T4 jumlah 0: ditolak', r4a.sukses === false && /lebih dari 0/i.test(r4a.pesan), r4a.pesan);
  const r4b = simpanMasuk({ namaAset: 'Tes', jumlah: -2 });
  cek('T4 jumlah negatif: ditolak', r4b.sukses === false);
});

/* --- Tes 5: alur LENGKAP lewat handler form simpanMasuk(e) --- */
seksi('T5 handler form', function () {
  getEl('inTanggal').value = '2026-08-03';
  getEl('inNamaAset').value = 'Monitor Uji';
  getEl('inKategori').value = 'Elektronik';
  getEl('inSpesifikasi').value = '22 inch';
  getEl('inLokasi').value = 'Gudang ATK';
  getEl('inJumlah').value = '1';
  getEl('inSatuan').value = 'unit';
  getEl('inKondisi').value = 'Baik';
  getEl('inAsal').value = 'Uji';
  getEl('inKetMasuk').value = '';
  let toastPesan = null, toastTipe = null;
  const toastAsli = sandbox.toast_;
  sandbox.toast_ = function (p, t) { toastPesan = p; toastTipe = t; };
  const jmlT5 = sandbox.MASTER.length;
  const r5 = sandbox.simpanMasuk({ preventDefault() {} });
  cek('T5 handler form: berjalan & toast sukses', r5 === false && toastTipe === 'sukses', toastPesan);
  cek('T5 handler form: aset tercatat + stok bertambah',
    sandbox.MASTER.length === jmlT5 + 1 && sandbox.MASTER.some((a) => a['Nama Aset'] === 'Monitor Uji'));
  sandbox.toast_ = toastAsli;
});

/* --- Tes 6 (bonus): Aset KELUAR — stok berkurang & stok kurang ditolak --- */
seksi('T6 aset keluar', function () {
  const mk = sandbox.MASTER.find((a) => a['Nama Aset'] === masterAwal[0]['Nama Aset']);
  if (!mk) { cek('T6 keluar: aset ditemukan', false, 'aset seed tidak ada'); return; }
  const stokKeluar = Number(mk['Jumlah Total']) || 0;
  const r6 = simpanKeluar({ kodeAset: mk['Kode Aset'], jumlah: 1, ruangan: 'IGD', penerima: 'dr. Uji', tanggal: '2026-08-03' });
  const stokSetelah = Number(sandbox.MASTER.find((a) => a['Kode Aset'] === mk['Kode Aset'])['Jumlah Total']) || 0;
  cek('T6 keluar: sukses & stok berkurang 1', r6.sukses === true && stokKeluar - stokSetelah === 1,
    stokKeluar + ' -> ' + stokSetelah);
  const r6b = simpanKeluar({ kodeAset: mk['Kode Aset'], jumlah: 99999, ruangan: 'IGD' });
  cek('T6 keluar: stok tak cukup ditolak', r6b.sukses === false && /tidak mencukupi/i.test(r6b.pesan), r6b.pesan);
});

/* --- Tes 7: Aset KELUAR — detail transaksi (ruangan, penerima, OUT-) --- */
seksi('T7 keluar ke ruangan', function () {
  const mk7 = sandbox.MASTER.find((a) => Number(a['Jumlah Total']) > 5);
  if (!mk7) { cek('T7 keluar: aset stok>5 ditemukan', false, 'semua stok habis'); return; }
  const jmlK7 = sandbox.KELUAR.length;
  const stok7 = Number(mk7['Jumlah Total']) || 0;
  const r7 = simpanKeluar({ kodeAset: mk7['Kode Aset'], jumlah: 1, ruangan: 'ICU', penerima: 'dr. Anestesi', tanggal: '2026-08-03', keterangan: 'Distribusi ICU' });
  const t7 = sandbox.KELUAR[0];
  const stok7b = Number(sandbox.MASTER.find((a) => a['Kode Aset'] === mk7['Kode Aset'])['Jumlah Total']) || 0;
  cek('T7 keluar: sukses', r7.sukses === true, r7.pesan);
  cek('T7 keluar: Tujuan Ruangan tersimpan', !!t7 && t7['Tujuan Ruangan'] === 'ICU', t7 && t7['Tujuan Ruangan']);
  cek('T7 keluar: Penerima tersimpan', !!t7 && t7['Departemen / Penerima'] === 'dr. Anestesi');
  cek('T7 keluar: No. Transaksi OUT-', !!t7 && /^OUT-\d+$/.test(t7['No. Transaksi']), t7 && t7['No. Transaksi']);
  cek('T7 keluar: stok berkurang 1', stok7 - stok7b === 1, stok7 + ' -> ' + stok7b);
  cek('T7 keluar: baris KELUAR bertambah', sandbox.KELUAR.length === jmlK7 + 1);
  cek('T7 keluar: tersimpan ke localStorage',
    JSON.parse(localStorage.getItem('siasik_demo_keluar') || '[]').some((k) => k['No. Transaksi'] === t7['No. Transaksi']));
});

/* --- Tes 8: handler form simpanKeluar(e) — validasi & alur lengkap --- */
seksi('T8 handler form keluar', function () {
  const mk8 = sandbox.MASTER.find((a) => Number(a['Jumlah Total']) > 2);
  if (!mk8) { cek('T8: aset stok>2 ditemukan', false); return; }
  const toast8 = [], toast8T = [];
  const toastAsli8 = sandbox.toast_;
  sandbox.toast_ = function (p, t) { toast8.push(p); toast8T.push(t); };
  // tanggal kosong
  getEl('outTanggal').value = '';
  getEl('outKode').value = mk8['Kode Aset'];
  getEl('outJumlah').value = '1';
  getEl('outRuangan').value = 'IGD';
  const r8a = sandbox.simpanKeluar({ preventDefault() {} });
  cek('T8 tanggal kosong: toast error', toast8T[0] === 'error' && /tanggal keluar wajib/i.test(toast8[0]), toast8[0]);
  // ruangan kosong
  getEl('outTanggal').value = '2026-08-03';
  getEl('outRuangan').value = '';
  const jmlK8 = sandbox.KELUAR.length;
  sandbox.simpanKeluar({ preventDefault() {} });
  cek('T8 ruangan kosong: toast error', toast8T[1] === 'error' && /tujuan ruangan wajib/i.test(toast8[1]), toast8[1]);
  cek('T8 ruangan kosong: tidak ada transaksi', sandbox.KELUAR.length === jmlK8);
  // alur lengkap
  getEl('outRuangan').value = 'IGD';
  getEl('outPenerima').value = 'Kepala IGD';
  getEl('outKetKeluar').value = '';
  const jmlK8c = sandbox.KELUAR.length;
  const stok8c = Number(sandbox.MASTER.find((a) => a['Kode Aset'] === mk8['Kode Aset'])['Jumlah Total']) || 0;
  const r8c = sandbox.simpanKeluar({ preventDefault() {} });
  const stok8d = Number(sandbox.MASTER.find((a) => a['Kode Aset'] === mk8['Kode Aset'])['Jumlah Total']) || 0;
  cek('T8 alur lengkap: toast sukses', toast8T[2] === 'sukses', toast8[2]);
  cek('T8 alur lengkap: KELUAR bertambah', sandbox.KELUAR.length === jmlK8c + 1);
  cek('T8 alur lengkap: stok berkurang 1', stok8c - stok8d === 1, stok8c + ' -> ' + stok8d);
  sandbox.toast_ = toastAsli8;
});

/* --- Tes 9: validasi periode filter laporan --- */
seksi('T9 periode filter', function () {
  // isi DATA_LAPORAN lewat fungsi render asli (seperti setelah muatSemua_)
  sandbox.muatRiwayatMasuk();
  sandbox.muatRiwayatKeluar();
  const semuaMasuk = sandbox.MASUK.length;
  const semuaKeluar = sandbox.KELUAR.length;
  const tglMasuk = sandbox.MASUK.map((r) => r['Tanggal Masuk']).sort();
  const tglKeluar = sandbox.KELUAR.map((r) => r['Tanggal Keluar']).sort();
  const tglMinM = tglMasuk[0], tglMaxM = tglMasuk[tglMasuk.length - 1];
  const tglMinK = tglKeluar[0], tglMaxK = tglKeluar[tglKeluar.length - 1];
  // rentang penuh -> semua baris
  sandbox.FILTER.masukDari = tglMinM; sandbox.FILTER.masukSampai = tglMaxM;
  cek('T9 filter masuk: rentang penuh = semua', sandbox.rowsMasukTerfilter_().length === semuaMasuk,
    sandbox.rowsMasukTerfilter_().length + '/' + semuaMasuk);
  // satu hari (tanggal maks) -> hanya baris tanggal itu
  sandbox.FILTER.masukDari = tglMaxM; sandbox.FILTER.masukSampai = tglMaxM;
  const jmlHariMax = sandbox.MASUK.filter((r) => r['Tanggal Masuk'] === tglMaxM).length;
  cek('T9 filter masuk: satu hari difilter', sandbox.rowsMasukTerfilter_().length === jmlHariMax,
    sandbox.rowsMasukTerfilter_().length + '/' + jmlHariMax);
  // periode masa depan -> 0 baris
  sandbox.FILTER.masukDari = '2099-01-01'; sandbox.FILTER.masukSampai = '2099-12-31';
  cek('T9 filter masuk: periode masa depan = 0', sandbox.rowsMasukTerfilter_().length === 0);
  // keluar: rentang penuh & satu hari
  sandbox.FILTER.keluarDari = tglMinK; sandbox.FILTER.keluarSampai = tglMaxK;
  cek('T9 filter keluar: rentang penuh = semua', sandbox.rowsKeluarTerfilter_().length === semuaKeluar,
    sandbox.rowsKeluarTerfilter_().length + '/' + semuaKeluar);
  sandbox.FILTER.keluarDari = tglMaxK; sandbox.FILTER.keluarSampai = tglMaxK;
  const jmlHariK = sandbox.KELUAR.filter((r) => r['Tanggal Keluar'] === tglMaxK).length;
  cek('T9 filter keluar: satu hari difilter', sandbox.rowsKeluarTerfilter_().length === jmlHariK,
    sandbox.rowsKeluarTerfilter_().length + '/' + jmlHariK);
  // terapkanPeriode_: dari > sampai -> ditolak
  const toast9 = [], toast9T = [];
  const toastAsli9 = sandbox.toast_;
  sandbox.toast_ = function (p, t) { toast9.push(p); toast9T.push(t); };
  let render9 = 0;
  // nilai lama yang disengaja (sentinel) agar pengujian tidak bergantung pada urutan tes
  sandbox.FILTER.masukDari = '2026-07-01';
  sandbox.FILTER.masukSampai = '2026-07-31';
  getEl('fMasukDari').value = '2026-09-01'; // dari > sampai -> harus ditolak
  getEl('fMasukSampai').value = '2026-08-01';
  const sebelumD = '2026-07-01', sebelumS = '2026-07-31';
  sandbox.terapkanPeriode_('fMasukDari', 'fMasukSampai', 'masukDari', 'masukSampai', function () { render9++; });
  cek('T9 periode invalid: toast error', toast9T[0] === 'error' && /tidak valid/i.test(toast9[0]), toast9[0]);
  cek('T9 periode invalid: FILTER tidak berubah',
    sandbox.FILTER.masukDari === sebelumD && sandbox.FILTER.masukSampai === sebelumS);
  cek('T9 periode invalid: input dikembalikan ke nilai lama',
    getEl('fMasukDari').value === sebelumD && getEl('fMasukSampai').value === sebelumS);
  cek('T9 periode invalid: render TIDAK dipanggil', render9 === 0);
  // terapkanPeriode_: valid -> FILTER terisi + render dipanggil
  getEl('fMasukDari').value = tglMinM;
  getEl('fMasukSampai').value = tglMaxM;
  sandbox.terapkanPeriode_('fMasukDari', 'fMasukSampai', 'masukDari', 'masukSampai', function () { render9++; });
  cek('T9 periode valid: FILTER terisi',
    sandbox.FILTER.masukDari === tglMinM && sandbox.FILTER.masukSampai === tglMaxM);
  cek('T9 periode valid: render dipanggil', render9 === 1);
  // dalamPeriode_: baris tanpa tanggal selalu tampil (perilaku disengaja)
  cek('T9 dalamPeriode_: tanpa tanggal = true (selalu tampil)',
    sandbox.dalamPeriode_('', '2099-01-01', '2099-12-31') === true);
  sandbox.toast_ = toastAsli9;
  // reset FILTER agar tes berikutnya tidak mewarisi state periode ini
  sandbox.FILTER.masukDari = ''; sandbox.FILTER.masukSampai = '';
  sandbox.FILTER.keluarDari = ''; sandbox.FILTER.keluarSampai = '';
});

console.log('\n' + (gagal === 0 ? '✅ SEMUA TES FORM LULUS' : '❌ ' + gagal + ' tes gagal'));
process.exit(gagal === 0 ? 0 : 1);
