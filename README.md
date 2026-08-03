Membangun sistem SIASIK (Sistem Informasi Aset Dan Logistik) menggunakan Google Apps Script memerlukan pendekatan yang berbeda dari platform no-code seperti AppSheet
. Berikut adalah tahapan pengembangan aplikasi tersebut berdasarkan fitur-fitur utama yang telah Anda tentukan:
1. Perancangan Struktur Database (Google Sheets)
Langkah pertama adalah menyiapkan Google Sheets sebagai basis data utama. Anda perlu membuat setidaknya tiga lembar kerja (Sheet) utama:
Sheet "Master Inventory": Berisi informasi rinci setiap aset, termasuk tanggal masuk, spesifikasi, dan lokasi penyimpanan
.
Sheet "Asset Masuk": Mencatat detail nama aset, jumlah, kondisi, dan asal aset yang baru masuk ke sistem
.
Sheet "Asset Keluar": Mencatat tujuan distribusi, tanggal keluar, serta ruangan atau departemen yang menerima aset
.
2. Pengembangan Antarmuka Pengguna (HTML/CSS)
Karena Apps Script memungkinkan pembuatan Web App, Anda perlu membuat file HTML untuk antarmuka:
Form Input: Buat formulir digital untuk memudahkan pengguna memasukkan informasi aset masuk dan aset keluar secara efisien
.
Dashboard Monitoring: Desain tampilan untuk memantau distribusi barang atau alat ke ruangan secara langsung dan real-time
.
3. Penulisan Logika Backend (Code.gs)
Gunakan JavaScript (Apps Script) untuk menghubungkan antarmuka dengan Google Sheets:
Fungsi doGet(): Untuk menampilkan halaman web aplikasi saat diakses.
Fungsi Simpan Data: Buat skrip untuk memproses input dari form ke dalam baris-baris di Google Sheets secara otomatis.
Logika Stok Otomatis: Tulis kode yang secara otomatis memperbarui jumlah total di "Master Inventory" setiap kali ada data masuk atau keluar, guna mencegah ketidakjelasan data
.
4. Implementasi Fitur Monitoring Distribusi
Untuk mencapai visibilitas tinggi terhadap perpindahan aset
:
Gunakan fungsi filter pada Apps Script untuk menarik data dari sheet "Asset Keluar" berdasarkan ruangan atau departemen tertentu.
Tampilkan data tersebut dalam bentuk tabel atau grafik di antarmuka web untuk pemantauan distribusi secara langsung
.
5. Keamanan dan Autentikasi
Berdasarkan kebutuhan akses tim terkait
:
Atur izin akses (permissions) agar hanya akun tertentu (seperti akun Google) yang bisa mengakses aplikasi ini
.
Gunakan Session.getActiveUser().getEmail() untuk mencatat siapa yang melakukan input data guna meningkatkan transparansi pengelolaan aset
.
6. Deployment (Penerbitan Aplikasi)
Simpan proyek Apps Script Anda.
Pilih menu "Deploy" > "New Deployment".
Pilih tipe "Web App" dan tentukan siapa yang memiliki akses.
Gunakan URL yang dihasilkan untuk mulai mengoperasikan sistem di lingkungan RSUD Mimika
.
Informasi Tambahan (Di luar sumber): Meskipun sumber Anda merujuk pada AppSheet
, penggunaan Google Apps Script memberikan fleksibilitas lebih dalam kustomisasi tampilan dan logika bisnis yang kompleks, namun memerlukan pemahaman pemrograman JavaScript yang lebih mendalam dibandingkan platform sebelumnya. Anda mungkin perlu menggunakan library tambahan seperti Bootstrap untuk memastikan tampilan aplikasi responsif di perangkat mobile dan desktop.

---

## 🌗 Tema: Auto / Terang / Gelap

- Tombol **🌗 / ☀️ / 🌙** di pojok kanan atas topbar mengalihkan tema secara berurutan: **Auto** (mengikuti pengaturan sistem) → **Terang** → **Gelap**.
- Preferensi user tersimpan di `localStorage` (key `siasik_tema`); mode **Auto** mengikuti perubahan tema sistem secara real-time (`prefers-color-scheme`).
- Peralihan tema dianimasikan halus (±0,35 detik) dan otomatis dimatikan bila sistem mengaktifkan *reduce motion* (`prefers-reduced-motion`).
- Grafik (Chart.js), halaman Akses Ditolak, dan popup Cetak/CSV ikut menyesuaikan tema yang aktif.

## 🌐 Tema Global (Script Properties)

Default tema untuk **semua pengguna** disimpan server-side di **Script Properties** (key `SIASIK_TEMA`), sinkron antar halaman (`Index.html` & `AksesDitolak.html`) dan lintas perangkat/browser.

**Prioritas tema efektif:** preferensi lokal user → **default global** → sistem.

- **Fungsi server:** `getTemaGlobal()` (baca) dan `setTemaGlobal(tema)` (tulis — hanya pemilik skrip/admin; nilai valid: `''`, `auto`, `terang`, `gelap`).
- **Cara mengatur (admin):**
  - Tombol **🌐** di topbar → tema yang sedang aktif menjadi default global.
  - Menu spreadsheet **SIASIK → Tema Global** (Auto / Terang / Gelap / Hapus default) — tanpa membuka aplikasi, tersedia jika script diikat ke spreadsheet.
- **Indikator visual:** badge kecil **"Default global: …"** di samping tombol 🌐 menampilkan nilai saat ini (tersembunyi di layar ≤900px).
- **Anti-kedipan (FOUC):** nilai global di-cache ke `localStorage` (`siasik_tema_global`) saat dimuat, sehingga halaman berikutnya langsung tampil dengan tema yang benar.
- Jika default global dihapus, cache ikut dihapus dan pengguna kembali mengikuti pengaturan sistem.

## 🖨️ Sinkronisasi Tema pada Popup Cetak/CSV

Saat popup **Cetak/PDF** atau **CSV** dibuka, tema efektif dihitung ulang dari **preferensi lokal → default global (diambil dari server) → sistem**, sehingga popup selalu mengikuti default global terbaru meskipun halaman utama belum selesai sinkron.

- **Timeout fallback 1,5 detik:** jika server lambat/macet, popup tetap terbuka memakai tema aktif saat ini (tidak pernah blank).
- **Output kertas/PDF tetap terang** (aturan `@media print` memaksa warna terang) — hemat tinta dan hasil cetak resmi tetap profesional.

## 🧪 Demo Offline

- `SIASIK-Demo.html` — pratinjau aplikasi lengkap (dashboard, form, monitoring, laporan, ekspor) tanpa server; data contoh di `localStorage`.
- `AksesDitolak-Demo.html` — pratinjau halaman penolakan akses; bisa dibuka dari banner demo SIASIK.
- Tema di demo mengikuti logika prioritas yang sama, dengan default global **disimulasikan** lewat key `siasik_tema_global` (tanpa panggilan server).

## 📊 Dashboard & Monitoring

- **Grafik stok per ruangan/lokasi** — bar chart stok saat ini (agregasi `Jumlah Total` Master Inventory berdasarkan `Lokasi Penyimpanan`) di Dashboard.
- **Cetak/PDF per ruangan** — di Monitoring Distribusi, tombol **🖨 Per Ruangan** mencetak laporan khusus satu ruangan (transaksi + rekap aset yang masuk ke ruangan itu); pilih ruangan pada filter dulu.

## 🔍 Validasi Otomatis & Git pre-commit hook

**`node scripts/validate.js`** — 47 cek statis (selesai <1 detik) yang memblokir `git commit` bila ada regresi.
**`node scripts/test-form-simas.js`** — tes otomatis alur form (Aset Masuk/Keluar) dengan menjalankan logika demo di Node + DOM mock: aset baru, stok bertambah, validasi, stok tak cukup (17 cek).

Daftar cek statis validate.js:

**1. Struktur & konfigurasi**
- 6 file inti ada: `appsscript.json`, `Code.gs`, `Index.html`, `styles.html`, `script.html`, `AksesDitolak.html`
- `appsscript.json` JSON valid (Web App + runtime V8)

**2. Sintaks**
- `Code.gs` ter-parse tanpa error
- `styles.html` & `script.html` bebas scriptlet (`<?`)
- JS inline `Index.html` (scriptlet dibuang) & `script.html` valid

**3. Konsistensi UI (id & handler)**
- Semua id yang dirujuk JS (`$('…')`, `getElementById('…')`) ada di `Index.html`
- Semua fungsi handler inline (`onclick`/`onchange`/`onsubmit`/dll.) terdefinisi di `script.html`
- Tidak ada id duplikat di `Index.html`

**4. Fungsi server inti**
- 16 fungsi server terdaftar di `Code.gs`: `getDaftarAset`, `getRuanganList`, `getDashboardData`,
  `getMasterAset`, `getRiwayatMasuk`, `getRiwayatKeluar`, `getDistribusiByRuangan`,
  `getRingkasanDistribusi`, `getRiwayatTransaksi`, `getTrenBulanan`, `getDataLaporan`,
  `getTemaGlobal`, `setTemaGlobal`, `simpanAsetMasuk`, `simpanAsetKeluar`, `hapusAset`

**5. Template include**
- `Index.html` memuat `styles.html` & `script.html` lewat `include()`

**6. Popup Cetak/CSV sinkron tema global** 🌐
- Semua fungsi pembuka popup (`window.open('', '_blank')`) **wajib** memakai `temaGelapUntukPopup_`
  — diperiksa di `script.html` (app) dan `SIASIK-Demo.html` (demo), dideteksi dinamis (bukan hardcode)
- Guard `if (w.closed) return` ada di `bukaUnduhCsv_`, `cetakLaporan_`, `cetakLaporanGabungan_`
- Popup cetak memakai `gayaCetak_(g)` — varian lama tanpa argumen (`gayaCetak_()`) dilarang
- Helper `temaGelapUntukPopup_` punya **timeout fallback 1500 ms** (popup tak pernah blank)

**7. Kontrak `google.script.run` ↔ `Code.gs`**
- Setiap panggilan `google.script.run` menunjuk fungsi yang **terdaftar** di `Code.gs`
  (diekstrak dinamis dari `script.html`, inline script `Index.html`, dan `AksesDitolak.html`)
- Cek silang: setiap fungsi server inti **benar-benar dipanggil** dari klien (anti kode mati)

**8. Aksesibilitas tombol ikon**
- Semua tombol **ikon murni** (teks tanpa huruf/angka: emoji, ✕/↻, SVG, atau kosong) wajib punya
  `title` atau `aria-label`/`aria-labelledby` **non-kosong** (case-insensitive, kutip ganda/tunggal)
- Diperiksa di `Index.html`, `SIASIK-Demo.html`, dan `AksesDitolak.html`

**Pre-commit hook** menjalankan validasi otomatis setiap `git commit`:
- **`node scripts/validate.js`** (47 cek statis) **dan** **`node scripts/test-form-simas.js`**
  (17 cek alur simpan form) dijalankan berurutan — commit diblokir jika salah satu gagal.
- Aktifkan (sekali per clone): `node scripts/install-git-hooks.js`
  (menolak menimpa hooks lain kecuali dengan `--force`)
- Lewati paksa (tidak disarankan): `git commit --no-verify`
- Jika `node` tidak terpasang, hook memperingatkan tanpa memblokir; di CI bisa diwajibkan
  dengan `SIASIK_HOOK_STRICT=1`.