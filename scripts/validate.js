// scripts/validate.js — Validasi cepat proyek SIASIK (Google Apps Script)
// Cara pakai:  node scripts/validate.js
// Memeriksa: sintaks Code.gs & JS klien, konsistensi id, fungsi handler,
// ketersediaan fungsi server yang dipanggil via google.script.run,
// pola popup Cetak/CSV yang sinkron dengan tema global (temaGelapUntukPopup_),
// kesinkronan panggilan google.script.run ↔ fungsi di Code.gs,
// aksesibilitas tombol ikon (title/aria-label),
// dan struktur YAML workflow GitHub Pages (.github/workflows/static.yml)
// beserta keberadaan file yang direferensikannya.
//
// PENTING — SINKRONISASI DOKUMENTASI: jumlah cek (saat ini 50) dan daftarnya
// didokumentasikan di PETUNJUK-DEPLOY.md dan README.md (bagian "Daftar cek
// validate.js"). Saat menambah/mengubah/menghapus cek, perbarui JUGA kedua
// dokumen tersebut (jumlahnya tercantum di kalimat pembuka "50 cek").
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const baca = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const adaFile = (f) => fs.existsSync(path.join(root, f));

let gagal = 0;
const cek = (nama, ok, detail) => {
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + nama + (detail ? ' — ' + detail : ''));
  if (!ok) gagal++;
};

// --- 1. File inti ada ---
['appsscript.json', 'Code.gs', 'Index.html', 'styles.html', 'script.html', 'AksesDitolak.html']
  .forEach((f) => cek('File ada: ' + f, adaFile(f)));

// --- 2. appsscript.json valid ---
try {
  const m = JSON.parse(baca('appsscript.json'));
  cek('appsscript.json JSON valid', !!(m.webapp && m.runtimeVersion === 'V8'),
    'webapp: ' + JSON.stringify(m.webapp));
} catch (e) {
  cek('appsscript.json JSON valid', false, e.message);
}

// --- 3. Sintaks Code.gs (parse saja, tidak dieksekusi) ---
try {
  new Function(baca('Code.gs'));
  cek('Code.gs sintaks OK', true);
} catch (e) {
  cek('Code.gs sintaks OK', false, e.message);
}

// --- 4. File include bebas scriptlet ---
cek('styles.html bebas scriptlet', !baca('styles.html').includes('<?'));
cek('script.html bebas scriptlet', !baca('script.html').includes('<?'));

// --- 5. Sintaks JS klien ---
function ekstrakInlineScript(html) {
  const out = [];
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  // Buang scriptlet template (<? ... ?>) yang tidak valid sebagai JS murni
  return out.join('\n').replace(/<\?[\s\S]*?\?>/g, '');
}
try {
  new Function(ekstrakInlineScript(baca('Index.html')));
  cek('Index.html inline script sintaks OK (scriptlet dibuang)', true);
} catch (e) {
  cek('Index.html inline script sintaks OK (scriptlet dibuang)', false, e.message);
}
try {
  new Function(baca('script.html'));
  cek('script.html sintaks OK', true);
} catch (e) {
  cek('script.html sintaks OK', false, e.message);
}
try {
  // Buang baris shebang (#!/usr/bin/env node) — loader Node melepasnya saat
  // menjalankan file, tetapi new Function() tidak.
  new Function(baca('scripts/test-form-simas.js').replace(/^#![^\n]*\n/, ''));
  cek('scripts/test-form-simas.js sintaks OK', true);
} catch (e) {
  cek('scripts/test-form-simas.js sintaks OK', false, e.message);
}

// --- 6. Semua id yang dirujuk JS ada di Index.html ---
const index = baca('Index.html');
const scriptHtml = baca('script.html');
const refs = new Set([
  ...scriptHtml.matchAll(/\$\('([^']+)'\)/g),
  ...scriptHtml.matchAll(/getElementById\('([^']+)'\)/g)
].map((m) => m[1]));
const hilang = [];
for (const id of refs) {
  const re = new RegExp('id="' + id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"');
  if (!re.test(index)) hilang.push(id);
}
cek('Semua id yang dirujuk JS ada di Index.html', hilang.length === 0,
  hilang.join(', ') || (refs.size + ' id dicek'));

// --- 7. Fungsi handler inline (onclick/onsubmit) ada di script.html ---
const handlerRefs = new Set();
const reOn = /on(?:click|submit|change|input|keyup|reset)="([^"]+)"/g;
let mo;
while ((mo = reOn.exec(index))) {
  const fn = mo[1].match(/([A-Za-z_$][\w$]*)\s*\(/);
  if (fn) handlerRefs.add(fn[1]);
}
const hilangFn = [];
for (const fn of handlerRefs) {
  if (!new RegExp('function\\s+' + fn + '\\b').test(scriptHtml)) hilangFn.push(fn);
}
cek('Fungsi handler inline ada di script.html', hilangFn.length === 0,
  hilangFn.join(', ') || (handlerRefs.size + ' fungsi dicek'));

// --- 8. Tidak ada id duplikat di Index.html ---
const idSemua = [...index.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
const dupe = idSemua.filter((v, i) => idSemua.indexOf(v) !== i);
cek('Tidak ada id duplikat di Index.html', dupe.length === 0,
  dupe.join(', ') || (idSemua.length + ' id unik'));

// --- 9. Fungsi server yang dipanggil google.script.run ada di Code.gs ---
const codeGs = baca('Code.gs');
const SERVER_FUNCS = [
  'getDaftarAset', 'getRuanganList', 'getDashboardData', 'getMasterAset',
  'getRiwayatMasuk', 'getRiwayatKeluar', 'getDistribusiByRuangan',
  'getRingkasanDistribusi', 'getRiwayatTransaksi', 'getTrenBulanan', 'getDataLaporan',
  'getTemaGlobal', 'setTemaGlobal',
  'simpanAsetMasuk', 'simpanAsetKeluar', 'hapusAset'
];
for (const fn of SERVER_FUNCS) {
  cek('Server fn: ' + fn, new RegExp('function\\s+' + fn + '\\s*\\(').test(codeGs));
}

// --- 10. include() dipanggil untuk file yang ada ---
for (const f of ['styles.html', 'script.html']) {
  cek('Index.html include: ' + f, baca('Index.html').includes("include('" + f + "')"));
}

// --- 11. Semua fungsi popup Cetak/CSV memakai temaGelapUntukPopup_ (sinkron tema global) ---
// Ambil isi badan fungsi (dari '{' pembuka sampai '}' penutup, menghitung kurung kurawal)
function ambilBadanFn(teks, nama) {
  const re = new RegExp('function\\s+' + nama + '\\s*\\([^)]*\\)\\s*\\{');
  const m = re.exec(teks);
  if (!m) return null;
  let mulai = m.index + m[0].length - 1; // posisi '{'
  let dalam = 1;
  for (let i = mulai + 1; i < teks.length; i++) {
    if (teks[i] === '{') dalam++;
    else if (teks[i] === '}') {
      dalam--;
      if (dalam === 0) return teks.slice(mulai + 1, i);
    }
  }
  return null;
}
// Deteksi dinamis: semua fungsi yang membuka popup (window.open('', '_blank')).
// Catatan: hanya mendeteksi deklarasi `function nama(...)` (gaya ES5 yang dipakai
// konsisten di proyek ini) — popup yang di-refactor jadi arrow function/ekspresi
// tidak akan terdeteksi (keterbatasan yang disengaja untuk skrip validasi ringan).
function fungsiPembukaPopup(teks) {
  const semua = [...teks.matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[1]);
  return semua.filter((fn) => {
    const b = ambilBadanFn(teks, fn);
    return b && b.includes("window.open('', '_blank')");
  });
}
const cekSemuaPopup = (label, teks) => {
  const pembuka = fungsiPembukaPopup(teks);
  const tanpaSync = pembuka.filter((fn) => !ambilBadanFn(teks, fn).includes('temaGelapUntukPopup_('));
  cek('Semua fungsi popup pakai temaGelapUntukPopup_ (' + label + ')', tanpaSync.length === 0,
    (pembuka.length ? 'popup: ' + pembuka.join(', ') : 'tidak ada popup') +
    (tanpaSync.length ? ' — TANPA SYNC: ' + tanpaSync.join(', ') : ''));
};
cekSemuaPopup('app', scriptHtml);
cekSemuaPopup('demo', baca('SIASIK-Demo.html'));
// Detail struktur untuk 3 fungsi popup inti
const POPUP_FUNCS = ['bukaUnduhCsv_', 'cetakLaporan_', 'cetakLaporanGabungan_'];
for (const fn of POPUP_FUNCS) {
  const b = ambilBadanFn(scriptHtml, fn);
  cek('Popup ' + fn + ': ada & guard w.closed', !!b && b.includes('if (w.closed) return'));
  if (fn !== 'bukaUnduhCsv_') { // popup cetak pakai gayaCetak_(g)
    cek('Popup ' + fn + ': gayaCetak_(g) tanpa varian lama', !!b && b.includes('gayaCetak_(g)') && !b.includes('gayaCetak_()'));
  }
}
const bHelper = ambilBadanFn(scriptHtml, 'temaGelapUntukPopup_');
cek('temaGelapUntukPopup_ terdefinisi + timeout 1500ms', !!bHelper && bHelper.includes('setTimeout') && bHelper.includes('1500'));

// --- 12. Semua google.script.run memanggil fungsi server yang terdaftar di Code.gs ---
// Bersihkan komentar & string (hanya satu baris — agar kutip tak seimbang
// tidak menyambar lintas baris dan merusak scan rantai berikutnya).
// Keterbatasan: template literal (backtick) & regex literal tidak ditangani —
// aman karena proyek ini konsisten gaya ES5 (string dirangkai dengan +).
function bersihkanJs(teks) {
  return teks
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:\w])[\/][\/][^\n]*/g, '$1')
    .replace(/'[^'\\\n]*(?:\\.[^'\\\n]*)*'/g, "''")
    .replace(/"[^"\\\n]*(?:\\.[^"\\\n]*)*"/g, '""');
}
// Ambil nama fungsi server dari rantai google.script.run. Strategi: setelah
// 'google.script.run', pindai dengan kedalaman kurung — panggilan nyata hanya
// terjadi pada depth 0 (handler .with* membungkus body-nya sehingga depth >= 1)
// dan statement berakhir pada ';' di depth 0. Nama handler .with* diabaikan.
function fungsiServerDipanggil(teks) {
  const b = bersihkanJs(teks);
  const out = [];
  let pos = 0;
  while ((pos = b.indexOf('google.script.run', pos)) !== -1) {
    let i = pos + 'google.script.run'.length;
    let depth = 0;
    while (i < b.length) {
      const c = b[i];
      if (c === '(') { depth++; i++; continue; }
      if (c === ')') { depth--; i++; continue; }
      if (c === ';' && depth === 0) break;
      if (c === '.' && depth === 0) {
        const mc = /^\.[A-Za-z_$][\w$]*/.exec(b.slice(i));
        if (mc) {
          const n = mc[0].slice(1);
          if (!['withSuccessHandler', 'withFailureHandler', 'withUserObject', 'withLogger'].includes(n)) {
            out.push(n);
          }
          i += mc[0].length;
          continue;
        }
      }
      i++;
    }
    pos = i + 1;
  }
  return out;
}
// Fungsi terdaftar didapat dinamis dari Code.gs (bukan hardcode)
const TERDAFTAR = new Set([...codeGs.matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[1]));
// Asumsi: semua panggilan klien ada di script.html (dimuat Index.html),
// inline script Index.html (scriptlet dibuang), dan AksesDitolak.html.
const dipanggilSemua = [...new Set([
  ...fungsiServerDipanggil(scriptHtml),
  ...fungsiServerDipanggil(ekstrakInlineScript(baca('Index.html'))),
  ...fungsiServerDipanggil(baca('AksesDitolak.html'))
])];
const takTerdaftar = dipanggilSemua.filter((n) => !TERDAFTAR.has(n));
cek('Semua google.script.run memanggil fungsi terdaftar di Code.gs', takTerdaftar.length === 0,
  dipanggilSemua.length + ' fungsi dipanggil' +
  (takTerdaftar.length ? ' — TIDAK ADA DI Code.gs: ' + takTerdaftar.join(', ') : ''));
// Cek silang: fungsi server inti benar-benar dipanggil dari klien
// (mencegah panggilan terhapus diam-diam sementara fungsi server tertinggal)
const takDipanggil = SERVER_FUNCS.filter((fn) => !dipanggilSemua.includes(fn));
cek('Semua fungsi server inti benar-benar dipanggil klien', takDipanggil.length === 0,
  SERVER_FUNCS.length + ' fungsi inti' +
  (takDipanggil.length ? ' — TIDAK DIPANGGIL: ' + takDipanggil.join(', ') : ''));

// --- 13. Semua tombol ikon punya title/aria-label (aksesibilitas) ---
// Tombol dianggap "ikon murni" bila teksnya (setelah tag dibuang) tidak
// mengandung huruf/angka — mis. emoji, simbol ✕/↻/🌐, SVG, atau kosong.
// Tombol semacam itu wajib punya title atau aria-label/aria-labelledby.
function tombolIkonTanpaLabel(html) {
  const re = /<button\b[^>]*>([\s\S]*?)<\/button>/g;
  const masalah = [];
  let m;
  while ((m = re.exec(html))) {
    const teks = m[1].replace(/<[^>]+>/g, '').trim();
    if (/[A-Za-z0-9]/.test(teks)) continue; // ada teks → tak wajib label
    // case-insensitive + kutip ganda/tunggal, nilai tidak boleh kosong
    if (/\b(?:title|aria-label|aria-labelledby)\s*=\s*(?:"[^"]+"|'[^']+')/i.test(m[0])) continue;
    masalah.push(m[0].slice(0, 90).replace(/\s+/g, ' '));
  }
  return masalah;
}
for (const f of ['Index.html', 'SIASIK-Demo.html', 'AksesDitolak.html']) {
  const masalah = tombolIkonTanpaLabel(baca(f));
  cek('Tombol ikon punya title/aria-label (' + f + ')', masalah.length === 0,
    masalah.join(' | ') || 'OK');
}

// --- 14. Workflow GitHub Pages (.github/workflows/static.yml) — struktur YAML inti ---
// Node core tidak punya parser YAML dan proyek ini sengaja tanpa dependensi
// eksternal, jadi kita validasi struktur yang paling rawan regresi saat mengedit
// workflow (bukan parser YAML penuh):
//   - file workflow ada
//   - tanpa karakter tab (YAML melarang tab untuk indentasi)
//   - kunci top-level wajib: name / on / jobs
//   - indentasi konsisten (setiap level = +2 spasi; turun harus mendarat di
//     level yang sudah dikenal — menangkap indent tidak rata / campur tab)
//   - setiap job (anak `jobs:`) punya runs-on dan steps
//   - kurung ekspresi ${{ ... }} seimbang
// Blok literal (`key: |` / `key: >`) dilewati isinya agar heredoc (mis. isi
// index.html di langkah deploy) bebas indentasi.
const WORKFLOW = '.github/workflows/static.yml';
cek('Workflow ' + WORKFLOW + ' ada', adaFile(WORKFLOW));

function yamlMasalah(teks) {
  const masalah = [];
  const baris = teks.split('\n');

  // a) tab di posisi indentasi dilarang (YAML: indentasi hanya spasi).
  // Catatan: tab di dalam isi blok literal (run: | …) legal di YAML — hanya
  // tab di awal baris (indentasi) yang ditandai.
  baris.forEach((l, i) => {
    if (/^\s*\t/.test(l)) masalah.push('tab di baris ' + (i + 1));
  });

  // b) kunci top-level wajib (boleh berisi nilai setelah kolon, mis. `name: ...`)
  const kunciTop = new Set();
  for (const l of baris) {
    const m = /^([A-Za-z0-9_-]+):(\s|$)/.exec(l);
    if (m) kunciTop.add(m[1]);
  }
  for (const k of ['name', 'on', 'jobs']) {
    if (!kunciTop.has(k)) masalah.push('kunci top-level "' + k + '" hilang');
  }

  // c) pohon indentasi + properti setiap job
  const stack = [];       // {indent, kunci} — kunci null = elemen daftar (-)
  const jobs = new Map(); // kunci job -> {runsOn, steps}
  let dalamBlok = false, indentBlok = -1;
  for (let i = 0; i < baris.length; i++) {
    const asli = baris[i];
    const isi = asli.trim();
    if (!isi || isi.startsWith('#')) continue;
    const indent = asli.length - asli.trimStart().length;

    // lewati isi blok literal (run: | ...) sampai baris dedent
    if (dalamBlok) {
      if (indent > indentBlok) continue;
      dalamBlok = false;
    }

    const mKey = /^([A-Za-z0-9_.-]+):(\s|$)/.exec(isi);
    const mItem = /^-\s/.test(isi);
    const kunci = mKey && !mItem ? mKey[1] : null;

    // sejajarkan tumpukan indentasi dengan baris ini
    let induk = null;
    while (stack.length && indent < stack[stack.length - 1].indent) stack.pop();
    if (!stack.length) {
      if (indent !== 0) { masalah.push('indentasi tak konsisten di baris ' + (i + 1)); continue; }
      stack.push({ indent, kunci });
    } else if (indent === stack[stack.length - 1].indent) {
      induk = stack.length >= 2 ? stack[stack.length - 2].kunci : null;
      stack[stack.length - 1] = { indent, kunci };
    } else if (indent > stack[stack.length - 1].indent) {
      // Konvensi proyek: tiap level = +2 spasi (indent lebih besar dari +2,
      // mis. 4 spasi, juga ditandai sebagai tak konsisten — disengaja).
      if (indent !== stack[stack.length - 1].indent + 2) {
        masalah.push('indentasi tak konsisten di baris ' + (i + 1));
        continue;
      }
      induk = stack[stack.length - 1].kunci;
      stack.push({ indent, kunci });
    }
    // (stack tak kosong & indent > level teratas otomatis tercapai — setelah
    // while-pop di atas, indent >= top selalu; cabang "mendarat di antara
    // level" sudah tertangkap oleh cek +2 di atas, jadi tanpa else tambahan.)

    // catat blok literal (run: | / >) untuk baris berikutnya
    if (/^[A-Za-z0-9_.-]+:\s*[|>]\s*$/.test(isi)) {
      dalamBlok = true;
      indentBlok = indent;
    }

    // job = anak langsung `jobs:`; catat propertinya
    if (induk === 'jobs' && mKey) jobs.set(kunci, { runsOn: false, steps: false });
    if (mKey && jobs.has(induk)) {
      if (kunci === 'runs-on') jobs.get(induk).runsOn = true;
      if (kunci === 'steps') jobs.get(induk).steps = true;
    }
  }

  // d) setiap job punya runs-on & steps
  if (jobs.size === 0) masalah.push('tidak ada job di bawah "jobs:"');
  for (const [nama, j] of jobs) {
    if (!j.runsOn) masalah.push('job "' + nama + '" tanpa runs-on');
    if (!j.steps) masalah.push('job "' + nama + '" tanpa steps');
  }

  // e) ekspresi ${{ ... }} seimbang
  const buka = (teks.match(/\$\{\{/g) || []).length;
  const tutup = (teks.match(/\}\}/g) || []).length;
  if (buka !== tutup) masalah.push('${{ }} tidak seimbang (' + buka + ' buka vs ' + tutup + ' tutup)');

  return masalah;
}
const yamlWorkflow = baca(WORKFLOW);
const mYaml = yamlMasalah(yamlWorkflow);
cek('Struktur YAML ' + WORKFLOW + ' valid', mYaml.length === 0, mYaml.join(' | ') || 'OK');

// f) file yang direferensikan workflow (cp … _site/ atau href="…") harus ada di repo
const refWorkflow = [...yamlWorkflow.matchAll(/(?:cp\s+([A-Za-z0-9_.-]+)\s+_site\/|href="([A-Za-z0-9_.-]+)")/g)]
  .map((m) => m[1] || m[2]);
const hilangFile = [...new Set(refWorkflow)].filter((f) => !adaFile(f));
cek('File yang direferensikan workflow ada', hilangFile.length === 0,
  hilangFile.join(', ') || (new Set(refWorkflow).size + ' file dicek'));

console.log('\n' + (gagal === 0 ? '✅ SEMUA CEK LULUS' : '❌ ' + gagal + ' cek gagal'));
process.exit(gagal === 0 ? 0 : 1);
