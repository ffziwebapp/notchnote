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

## Keamanan

NotchNote aman dipasang, dan semua hal di bawah bisa kamu periksa sendiri.

**1. Kode terbuka.** Seluruh kode aplikasi ada di repositori ini. Siapa pun bisa membaca apa saja yang dilakukan aplikasi.

**2. Installer dibuat oleh server GitHub, bukan di komputer pribadi.** Setiap rilis dibuat otomatis oleh [GitHub Actions](../../actions) langsung dari kode di repositori ini. Langkah-langkahnya bisa dilihat di [`.github/workflows/build.yml`](.github/workflows/build.yml). Jadi file yang kamu unduh dari halaman [Releases](../../releases) memang hasil dari kode yang terlihat di sini.

**3. Periksa dengan antivirus.** Buka [virustotal.com](https://www.virustotal.com), lalu unggah file installer di tab **File** (atau tempel link unduhannya di tab **URL**). File akan diperiksa oleh sekitar 70 antivirus sekaligus.

Hasil pemeriksaan versi 1.2.5 (29 Oktober 2026):
- [Link unduhan](https://www.virustotal.com/gui/url/2a47051db3bf15ff55609e090cb7d300431f48e002c2707855c0551634000caf/detection): **0 dari 93** layanan menandai bahaya.
- [File installer](https://www.virustotal.com/gui/file/b69ce06851e1651a6551d84584aff98a99d2ddbdc2701866ad9ce088bbd37e50/detection): **4 dari 71** antivirus memberi tanda. Keempatnya adalah penilaian tebakan otomatis (*machine learning*), bukan virus yang dikenali: "Unsafe", "Malicious", "grayware_confidence_60%", dan "Suspicious.low.ml.score". 67 antivirus lainnya tidak menemukan apa pun.

Kenapa ada tebakan seperti itu? Aplikasi baru yang belum punya tanda tangan digital dan belum banyak diunduh sering ditebak "mencurigakan" oleh mesin semacam ini. Apalagi NotchNote memang membaca jendela yang sedang aktif (untuk statistik fokus), memantau clipboard (untuk fitur Klip), dan bisa mulai bersama Windows. Semua itu dilakukan terbuka dan bisa dibaca di kode sumbernya. Hal yang sama juga menjadi penyebab Windows menampilkan "Windows protected your PC".

**4. Pastikan file tidak diubah orang lain.** Setiap rilis mencantumkan sidik jari file (SHA-256). Setelah mengunduh, buka PowerShell di folder Downloads lalu jalankan:

```powershell
Get-FileHash .\NotchNote_*_x64-setup.exe
```

Kalau angka yang muncul sama dengan yang tertulis di halaman rilis, file itu asli.

**5. Apa saja yang dilakukan aplikasi di komputermu**

| | |
|---|---|
| Hak akses | Dipasang hanya untuk akun Windows-mu (tidak butuh izin Administrator) |
| Data | Disimpan hanya di `%APPDATA%\NotchNote`. Tidak ada akun dan tidak ada server NotchNote |
| Statistik fokus | Nama aplikasi yang sedang aktif dihitung di komputermu sendiri dan tidak dikirim ke mana pun |
| Klip | Riwayat salin/screenshot disimpan lokal. Isi yang ditandai rahasia oleh pengelola kata sandi tidak direkam |
| Jadwal sholat | Dihitung di komputermu, tanpa internet |
| Mulai bersama Windows | Hanya kalau diaktifkan, dan bisa dimatikan di Pengaturan |

**Koneksi internet yang dipakai**, hanya untuk fitur berikut:

| Fitur | Ke mana | Yang dikirim |
|---|---|---|
| Lirik lagu | `lrclib.net`, `api.lyrics.ovh` | Judul dan penyanyi lagu yang sedang diputar |
| Cuaca | `api.open-meteo.com` | Koordinat kota yang kamu pilih di Pengaturan (bisa dimatikan) |
| Asisten AI | Penyedia yang kamu pilih sendiri (Claude, OpenAI, Gemini, Groq, OpenRouter), atau Ollama di komputermu sendiri | Pesan yang kamu ketik, memakai API key milikmu sendiri |

API key disimpan terenkripsi dengan akun Windows-mu (Windows DPAPI) dan hanya dikirim ke penyedianya. Tidak ada data yang dikirim ke pembuat NotchNote.

Menemukan masalah keamanan? Lihat [SECURITY.md](SECURITY.md).

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
