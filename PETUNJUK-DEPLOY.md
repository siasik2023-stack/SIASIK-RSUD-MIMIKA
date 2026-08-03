# 📘 Petunjuk Deployment — SIASIK (RSUD Mimika)

**SIASIK — Sistem Informasi Aset dan Logistik** dibangun dengan **Google Apps Script** dan menggunakan
**Google Sheets** sebagai basis data (sesuai panduan `README.md`).

---

## 📁 Struktur Proyek

| File | Peran |
|---|---|
| `appsscript.json` | Manifest proyek (zona waktu WIT `Asia/Jayapura`, runtime V8, konfigurasi Web App) |
| `Code.gs` | Backend: `doGet()`, simpan Aset Masuk/Keluar, logika stok otomatis, monitoring, autentikasi |
| `Index.html` | Halaman utama (dashboard, form, tabel, monitoring) |
| `styles.html` | CSS antarmuka (di-include ke `Index.html`) |
| `script.html` | JavaScript klien (di-include ke `Index.html`) |
| `AksesDitolak.html` | Halaman penolakan akses |
| `scripts/validate.js` | (Opsional) Validasi sintaks & konsistensi — jalankan dengan `node scripts/validate.js` |
| `SIASIK-Demo.html` | **Demo offline**: buka langsung di browser untuk mempratinjau tampilan & fitur ekspor (data contoh di localStorage, bukan bagian dari proyek Apps Script) |
| `AksesDitolak-Demo.html` | **Demo halaman Akses Ditolak**: pratinjau langsung di browser (termasuk mode terang/gelap via toggle tema); bisa dibuka dari banner demo SIASIK |

---

## 🚀 Langkah Deployment

### 1. Buat Google Sheet (database)
1. Buka [sheets.new](https://sheets.new) → beri nama **"Database SIASIK - RSUD Mimika"**.
2. Biarkan sheet kosong (tiga lembar kerja akan dibuat otomatis: **Master Inventory**, **Asset Masuk**, **Asset Keluar**).

### 2. Buka editor Apps Script
1. Dari spreadsheet: menu **Ekstensi → Apps Script**.
2. Beri nama proyek **"SIASIK"**.

### 3. Salin file ke editor
| Di editor Apps Script | Salin isi file ini |
|---|---|
| File `Code.gs` (ganti isi bawaan) | `Code.gs` |
| File HTML baru **`Index`** | `Index.html` |
| File HTML baru **`styles`** | `styles.html` |
| File HTML baru **`script`** | `script.html` |
| File HTML baru **`AksesDitolak`** | `AksesDitolak.html` |

> Pastikan nama file HTML **persis**: `Index`, `styles`, `script`, `AksesDitolak`
> (kode memanggil `include('styles.html')`, `include('script.html')`, dan `createHtmlOutputFromFile('AksesDitolak')`).

### 4. Aktifkan manifest (`appsscript.json`)
1. Di editor: **⚙️ Project Settings → centang "Show `appsscript.json` manifest file"**.
2. Klik file `appsscript.json` di kiri → salin isi dari proyek ini.
   - `timeZone: "Asia/Jayapura"` — zona waktu WIT Papua.
   - `webapp.access: "ANYONE_GOOGLE"` — hanya akun Google (dikontrol lebih lanjut oleh whitelist di langkah 5).

### 5. (Opsional) Batasi akun yang boleh mengakses
1. **⚙️ Project Settings → Script properties → Add property**:
   - **Property**: `SIASIK_ALLOWED_EMAILS`
   - **Value**: daftar email dipisah koma, mis. `budi@rsudmimika.id, sari@gmail.com`
2. Jika property ini **tidak diisi**, semua akun Google yang login boleh mengakses (aman untuk tahap uji coba).

### 6. Siapkan database & otorisasi
1. Pilih fungsi `onOpen` di toolbar → **Run** → **Review permissions** → pilih akun → **Allow**.
   (Ini menambahkan menu **SIASIK** di spreadsheet.)
2. Atau pilih fungsi `siapkanDatabase` → **Run** untuk membuat tiga lembar kerja sekaligus.
3. Pastikan ketiga sheet terbentuk: **Master Inventory**, **Asset Masuk**, **Asset Keluar**.

### 7. Deploy sebagai Web App
1. Klik **Deploy → New deployment**.
2. Klik ikon ⚙️ → pilih **Web app**.
3. Isi:
   - **Description**: `SIASIK v1`
   - **Execute as**: **Me** *(akun Anda)*
   - **Who has access**: **Anyone with Google account** (whitelist internal tetap aktif)
4. Klik **Deploy** → salin **Web app URL**.

### 8. Uji coba
1. Buka URL Web App di browser (incognito juga boleh untuk menguji akses).
2. Isi **Aset Masuk** → cek **Master Inventory** (baris aset + jumlah total bertambah otomatis).
3. Isi **Aset Keluar** ke ruangan → cek stok berkurang & status berubah (Tersedia/Menipis/Habis).
4. Buka **Monitoring Distribusi** → filter per ruangan + lihat grafik rekapitulasi.

---

## 🔄 Memperbarui Aplikasi

Setiap kali mengubah `Code.gs` / HTML:
1. Klik **Deploy → Manage deployments**.
2. Klik **✏️ Edit** pada deployment → **Version: New version** → **Deploy**.
3. Buka kembali URL (gunakan URL yang sama).

---

## 🧹 Validasi Otomatis (Git pre-commit hook)

Setiap **commit** ke repo git otomatis menjalankan `node scripts/validate.js` — jika ada regresi,
**commit diblokir** sampai diperbaiki (46 cek, selesai <1 detik).

- **Aktifkan** (sekali saja per clone): `node scripts/install-git-hooks.js`
  (menyetel `core.hooksPath` ke folder hooks ter-versioning `scripts/git-hooks` — tidak perlu
  menyalin file; hook selalu sinkron dengan repo). Bila terdeteksi pengaturan hooks lain
  (mis. husky atau `.git/hooks/pre-commit`), installer menolak menimpa kecuali dijalankan
  dengan `node scripts/install-git-hooks.js --force`.
- **Uji manual**: `bash scripts/git-hooks/pre-commit`
- **Lewati paksa** (tidak disarankan): `git commit --no-verify`
- **Copot**: `git config --unset core.hooksPath`
- Jika `node` tidak terpasang di PATH, hook memperingatkan dan **tidak** memblokir commit;
  untuk mewajibkan node (mis. di CI), set variabel lingkungan `SIASIK_HOOK_STRICT=1`.

### 📋 Daftar cek `validate.js`

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
  (cegah error saat popup ditutup sebelum jawaban server tiba)
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

---

## ⚠️ Catatan Penting

- **Basis data** adalah spreadsheet tempat skrip terikat. Data tersimpan di Google Sheets dan dapat
  dicadangkan dengan menu *File → Make a copy*.
- **Stok otomatis**: Setiap transaksi masuk menambah `Jumlah Total`, transaksi keluar menguranginya.
  Transaksi keluar **ditolak** jika stok tidak mencukupi.
- **Transparansi**: kolom *Dicatat Oleh* otomatis berisi email pengguna
  (`Session.getActiveUser().getEmail()`), sesuai panduan README.
- **Laporan**: tombol **Cetak/PDF** & **CSV** tersedia di header tiap bagian (Master Inventory, Aset Masuk,
  Aset Keluar, Monitoring Distribusi). Unduhan CSV memakai jendela popup — izinkan popup bila browser memintanya.
  File CSV diberi BOM UTF-8 agar terbuka rapi di Microsoft Excel.
- **Popup laporan mengikuti tema**: jendela popup Cetak/PDF dan unduhan CSV menyesuaikan tema terang/gelap
  aktif. Namun output **cetak ke kertas/PDF tetap terang** (dipaksa `@media print`) agar hemat tinta dan
  hasil cetak resmi tetap profesional.
- **Filter periode**: pada Riwayat Aset Masuk, Riwayat Aset Keluar, dan Monitoring Distribusi tersedia filter
  tanggal **Dari–Sampai** yang berlaku untuk tampilan tabel maupun laporan Cetak/CSV (termasuk ringkasan rekapitulasi).
- **Halaman Laporan**: menu **Laporan** menyajikan rekapitulasi terpusat — statistik ringkas (total aset, stok,
  masuk/keluar periode) serta tabel rekap Stok per Kategori, Aset Masuk per Kategori, Aset Keluar per Ruangan,
  dan Tren Bulanan — dengan filter periode global (Dari–Sampai) yang berlaku untuk tampilan, **Cetak/PDF**
  (semua rekap dalam satu dokumen), dan **CSV** (semua bagian dalam satu file).
- **Tema (Auto/Terang/Gelap)**: tombol di pojok kanan atas topbar mengalihkan tema secara berurutan —
  **Auto** (mengikuti pengaturan sistem `prefers-color-scheme`, termasuk perubahan real-time), **Terang**,
  dan **Gelap**. Preferensi tersimpan di `localStorage` browser. Grafik ikut menyesuaikan warna grid,
  label, dan legenda. Peralihan tema dianimasikan halus (transisi warna ±0,35 detik), dan otomatis
  dimatikan jika sistem mengaktifkan *reduce motion* (`prefers-reduced-motion`).
- **Tema global (Script Properties)**: selain preferensi lokal, tersedia **default tema global** yang
  disinkronkan antar halaman (`Index.html` & `AksesDitolak.html`) dan perangkat via `Script Properties`
  (key `SIASIK_TEMA`). Aturan prioritas: **preferensi lokal user (localStorage) → default global → sistem**.
  Untuk mengatur default global, admin (pemilik skrip) klik tombol **🌐** di topbar — tema yang sedang aktif
  akan menjadi default bagi semua pengguna; nilai ini juga di-cache di `localStorage` (`siasik_tema_global`)
  agar tidak berkedip saat halaman dimuat.  **Popup Cetak/CSV ikut tersinkron**: saat dibuka, tema efektifnya
  dihitung ulang dari preferensi lokal → default global (diambil dari server) → sistem, jadi popup selalu
  mengikuti default global terbaru walau halaman utama belum selesai sinkron. Jika server lambat/macet,
  ada **timeout fallback 1,5 detik** — popup tetap terbuka memakai tema aktif saat ini (tidak blank).
  **Alternatif tanpa membuka aplikasi**: menu spreadsheet **SIASIK →
  Tema Global** (submenu Auto/Terang/Gelap/Hapus default) — tersedia jika script diikat ke spreadsheet dan
  menampilkan nilai global saat ini di label submenu. Fungsi server terkait: `getTemaGlobal()` dan
  `setTemaGlobal()` (hanya pemilik skrip yang boleh menulis).
- **Keamanan**: akses Web App dibatasi via `ANYONE_GOOGLE` + whitelist `SIASIK_ALLOWED_EMAILS`.
- Jika ingin mengubah zona waktu, edit `timeZone` di `appsscript.json` (mis. `Asia/Makassar` untuk WITA).
