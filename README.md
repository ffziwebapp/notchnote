# NotchNote

Notch produktivitas untuk Windows, ditemani **Notnot** si burung hantu. Isinya to-do, logbook, catatan, klip, chat AI, musik dengan lirik, jadwal sholat, pelacak fokus, dan Pomodoro dalam satu notch di tepi layar.

## Cara memasang (untuk pengguna)

1. Buka halaman **[Releases](../../releases/latest)**.
2. Unduh file **`NotchNote_x.y.z_x64-setup.exe`** (sekitar 5 sampai 10 MB).
3. Jalankan file itu. Kalau muncul layar biru **"Windows protected your PC"**, klik **More info**, lalu **Run anyway**. Peringatan ini muncul karena aplikasinya belum punya sertifikat tanda tangan berbayar, bukan karena berbahaya.
4. Ikuti langkah pemasangan sampai selesai. NotchNote langsung muncul di tepi atas layar. Ikonnya ada di tray dekat jam.

Tidak perlu memasang Python atau aplikasi lain. Kalau komputernya belum punya Microsoft Edge WebView2 (biasanya sudah ada di Windows 10 dan 11), installer akan mengunduhnya sendiri.

**Memperbarui:** unduh installer versi terbaru, lalu jalankan. Data tidak hilang.

**Menghapus:** Settings → Apps → NotchNote → Uninstall. Data tetap tersimpan di `%APPDATA%\NotchNote`. Hapus folder itu kalau ingin bersih total.

## Data dan privasi

- Semua data (to-do, catatan, logbook, statistik, klip) hanya tersimpan di komputer sendiri, di `%APPDATA%\NotchNote`.
- API key AI disimpan terenkripsi dengan akun Windows dan hanya dikirim ke penyedia AI-nya. Setiap orang memakai API key-nya sendiri.
- Pengguna versi Python sebelumnya: data langsung terbaca. Versi Python yang masih berjalan otomatis ditutup, dan "Mulai bersama Windows" dipindah ke aplikasi ini.

## Untuk pengembang

- `ui/`: antarmuka (HTML, CSS, JS)
- `src-tauri/`: aplikasi Rust ([Tauri 2](https://tauri.app)), termasuk jendela transparan, tray, pintasan keyboard, pelacak fokus, kontrol media Windows, lirik, AI, klip, dan autostart
- `.github/workflows/build.yml`: setiap push ke `main` membuat installer, yang bisa diunduh dari tab **Actions → Artifacts**. Rilis `v<versi>` dibuat atau diperbarui otomatis sesuai versi di `src-tauri/tauri.conf.json`, jadi untuk rilis baru cukup naikkan nomor versinya.

Menjalankan di komputer sendiri (perlu [Rust](https://rustup.rs) dan Node.js):

```
npx @tauri-apps/cli@^2 dev
```

Membuat installer:

```
npx @tauri-apps/cli@^2 build
```
