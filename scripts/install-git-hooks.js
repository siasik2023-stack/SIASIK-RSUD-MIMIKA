#!/usr/bin/env node
// scripts/install-git-hooks.js — Aktifkan pre-commit hook SIASIK (validate.js)
// Cara pakai:  node scripts/install-git-hooks.js
//
// Cara kerja: menyetel `core.hooksPath` ke folder hooks yang TER-VERSIONING
// (scripts/git-hooks), sehingga hook selalu sinkron dengan repo — tidak perlu
// menyalin file ke .git/hooks (yang tidak ikut version control).
'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const hookPath = path.join(root, 'scripts', 'git-hooks', 'pre-commit');

// execFileSync memanggil git langsung tanpa shell → aman di Windows (cmd.exe)
// dan POSIX; tidak ada masalah escaping argumen.
function git(...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

// 1) Pastikan berada di dalam repo git
try {
  git('rev-parse', '--is-inside-work-tree');
} catch (e) {
  console.error('❌ Bukan repo git. Jalankan "git init" dulu di folder proyek, lalu ulangi perintah ini.');
  process.exit(1);
}

// 2) Pastikan file hook ada
if (!fs.existsSync(hookPath)) {
  console.error('❌ Hook tidak ditemukan: ' + hookPath);
  process.exit(1);
}

// 2b) Deteksi konflik dengan setup hooks lain (jangan menimpa diam-diam)
let existing = '';
try { existing = git('config', '--get', 'core.hooksPath'); } catch (e) { /* belum diset */ }
const oldHook = path.join(root, '.git', 'hooks', 'pre-commit');
const adaHookLama = fs.existsSync(oldHook) && !oldHook.endsWith('.sample');
const adaKonflik = (existing && existing !== 'scripts/git-hooks') || adaHookLama;
if (adaKonflik && !process.argv.includes('--force')) {
  console.warn('⚠️  Terdeteksi pengaturan hooks lain:');
  if (existing && existing !== 'scripts/git-hooks') console.warn('    core.hooksPath saat ini = ' + existing);
  if (adaHookLama) console.warn('    Ada file .git/hooks/pre-commit (bukan .sample)');
  console.error('❌ Batalkan agar tidak menimpa hooks lain.');
  console.error('   Jika yakin, jalankan ulang dengan:  node scripts/install-git-hooks.js --force');
  process.exit(1);
}
if (existing && existing !== 'scripts/git-hooks') {
  console.warn('⚠️  core.hooksPath sebelumnya (' + existing + ') akan diganti (--force).');
}

// 3) Arahkan git ke folder hooks ter-versioning (path relatif = dari akar repo,
//    tempat git menjalankan hook)
try {
  git('config', 'core.hooksPath', 'scripts/git-hooks');
  console.log('✅ core.hooksPath = scripts/git-hooks');
} catch (e) {
  console.error('❌ Gagal menyetel core.hooksPath: ' + (e.stderr || e.message));
  process.exit(1);
}

// 4) Pastikan bit executable (POSIX); di Windows sifat ini diabaikan git
try { fs.chmodSync(hookPath, 0o755); } catch (e) { /* Windows: abaikan */ }

console.log('✅ Pre-commit hook aktif: ' + hookPath);
console.log('   Berjalan otomatis setiap "git commit" — commit diblokir bila validate.js gagal.');
console.log('   Uji manual : bash scripts/git-hooks/pre-commit');
console.log('   Copot      : git config --unset core.hooksPath');
console.log('   Wajib node : SIASIK_HOOK_STRICT=1 membuat hook gagal bila node tak ada (mis. CI)');
