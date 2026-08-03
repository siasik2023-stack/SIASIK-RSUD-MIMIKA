#!/usr/bin/env node
// scripts/test-form-simas.js — Tes otomatis alur simpan Aset Masuk (& Keluar)
// Menjalankan LOGIKA ASLI demo (SIASIK-Demo.html) di Node dengan DOM mock,
// sehingga alur simpan bisa diuji tanpa browser (menutup celah uji form).
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
  const r2 = simpanMasuk({ namaAset: namaLama, jumlah: 3, satuan: 'unit' });
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

console.log('\n' + (gagal === 0 ? '✅ SEMUA TES FORM LULUS' : '❌ ' + gagal + ' tes gagal'));
process.exit(gagal === 0 ? 0 : 1);
