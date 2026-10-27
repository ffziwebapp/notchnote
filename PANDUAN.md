# NotchNote

Notch produktivitas untuk Windows, ditemani **Notnot** si burung hantu. Bisa menempel di tepi atas, bawah, kiri, atau kanan layar, atau melayang di mana saja. Isinya:

| Ikon | Halaman | Isi |
|---|---|---|
| Daftar centang | **To-do** | Kalender, tugas per tanggal, jam, dan pengingat |
| Buku | **Logbook** | Catatan kegiatan harian, mingguan, dan bulanan untuk laporan ke atasan |
| Kertas catatan | **Catatan** | Catatan teks, checklist, dan daftar prioritas, plus template |
| Papan klip | **Klip** | Riwayat screenshot dan teks yang kamu salin |
| Bintang | **AI** | Chat Claude, ChatGPT, atau Gemini langsung dari notch |
| Not balok | **Musik** | Lagu yang diputar, kontrol, dan lirik tersinkron |
| Masjid | **Sholat** | Jadwal sholat dan pengingat adzan |
| Target | **Fokus** | Pelacak produktivitas harian dan mingguan |
| Stopwatch | **Timer** | Pomodoro dengan alarm |
| Gerigi | **Pengaturan** | Semua pengaturan, langsung di dalam notch |

---

## 1. Instalasi

1. Buka https://github.com/ffziwebapp/notchnote/releases/latest
2. Unduh **`NotchNote_x.y.z_x64-setup.exe`** (sekitar 5 sampai 10 MB).
3. Jalankan file itu. Kalau muncul layar biru **"Windows protected your PC"**, klik **More info**, lalu **Run anyway**. Peringatan ini muncul karena aplikasinya belum punya sertifikat tanda tangan berbayar.
4. Selesai. NotchNote muncul di tepi atas layar. Ikonnya ada di tray dekat jam, dan di menu Start.

Tidak perlu memasang Python. Kalau sebelumnya memakai versi Python:

- data lama langsung terbaca;
- versi Python yang masih berjalan ditutup otomatis;
- "Mulai bersama Windows" dipindah ke aplikasi baru.

Setelah itu, folder versi Python boleh dihapus.

Agar NotchNote menyala otomatis setiap kali komputer dihidupkan, buka **Pengaturan → Umum → Mulai bersama Windows**.

---

## Yang baru di versi 1.2

- **Lirik lebih sinkron dan lebih halus.** Posisi lagu dihitung ulang supaya tidak tertinggal (terutama di Spotify). Lirik bergulir pelan dengan baris aktif paling terang, latarnya mengikuti warna sampul album, dan ada titik-titik saat jeda musik.
- **Tombol ketuk sinkron** (ikon target) di halaman Musik: ketuk tepat saat penyanyi mulai menyanyikan sebuah baris, maka waktu liriknya langsung disamakan.
- **Huruf lebih tipis** secara bawaan. Ketebalannya bisa dipilih di Pengaturan → Tampilan → Ketebalan huruf (Tipis, Normal, atau Tebal).
- **Catatan kini punya tiga jenis:** teks, checklist, dan daftar prioritas. Ada juga template, filter jenis, dan tombol untuk mengirim item ke To-do.
- **Logbook (baru):** to-do yang selesai otomatis tercatat sebagai laporan kegiatan harian, mingguan, dan bulanan, lengkap dengan ringkasan produktivitas. Lihat bagian 3a.
- **Tidak ada lagi versi lama yang ikut menyala.** NotchNote versi baru menutup versi lama yang masih berjalan, lalu memperbaiki pengaturan "Mulai bersama Windows" supaya menunjuk ke folder versi terbaru.

## Yang baru di versi 1.1

- **Notnot**, maskot burung hantu, muncul di notch kecil dan di atas panel. Matanya mengikuti kursor, dan ekspresinya berubah sesuai kegiatanmu.
- **Tema Notnot** (ungu malam) menjadi bawaan. Ada juga versi **Notnot terang**, dan tema lama masih bisa dipilih.
- **Notch kecil bisa diatur**: slot kiri, tengah, dan kanan boleh diisi apa saja.
- **Lirik berjalan** di notch kecil, dengan lencana sumber pemutarnya (YouTube, Spotify, dan lainnya).
- **Prioritas tugas**: Tinggi, Sedang, Rendah.
- **AI gratis**: Groq, OpenRouter, dan Ollama.
- Perbaikan: panel To-do tidak lagi terpotong oleh judul tugas yang panjang.

## 2. Cara memakai notch

| Aksi | Hasil |
|---|---|
| Klik notch | Buka atau tutup panel |
| Klik ikon di bilah bawah | Pindah halaman |
| Scroll di bilah ikon, atau tombol ← → | Pindah halaman |
| Klik kanan notch | Buka Pengaturan |
| Ikon pin di pojok kanan atas panel | Panel tetap terbuka walau kursor pergi |
| `Esc` | Tutup panel |

Panel tertutup sendiri saat kursor menjauh. Tapi selama kamu sedang mengetik (catatan, chat AI, tugas), panel tetap terbuka sampai kamu mengklik di luar.

### Memindah posisi

- **Tarik** notch, lalu dekatkan ke salah satu tepi layar (atas, bawah, kiri, kanan). Notch akan menempel dan berubah bentuk mengikuti tepi itu.
- Lepas di tengah layar supaya notch **melayang**.
- Posisi juga bisa dipilih di **Pengaturan → Notch → Posisi**.
- Di tepi kiri dan kanan, notch kecil berbentuk vertikal.
- Kalau ingin posisinya tidak bergeser, aktifkan **Kunci posisi**.

### Pintasan keyboard

| Tombol | Fungsi |
|---|---|
| `Ctrl + Alt + Space` | Tanya AI |
| `Ctrl + Alt + N` | Catatan baru |
| `Ctrl + Alt + T` | Tambah tugas |
| `Ctrl + Alt + H` | Buka atau tutup notch |

---

### Notch kecil (3 slot)

Atur di **Pengaturan → Notch → Notch kecil**. Setiap slot (kiri, tengah, kanan) bisa diisi salah satu dari ini:

- Jam, Tanggal, atau Jam + tanggal
- Lirik / musik
- Tugas berikutnya atau Jumlah tugas
- Timer Pomodoro, Sholat berikutnya, atau Skor fokus
- Cuaca atau Baterai
- Otomatis (memilih info yang paling relevan) atau Kosong

Bawaannya: kiri **Jam**, tengah **Lirik / musik** (cadangannya **Tugas berikutnya** saat tidak ada musik), kanan **Otomatis**. Setiap slot punya pilihan **cadangan** yang tampil kalau isi utamanya kosong.

Saat timer berjalan atau waktu sholat tinggal kurang dari 15 menit, infonya sementara muncul di slot kanan. Perilaku ini bisa dimatikan lewat **Info penting boleh mengambil alih**.

### Notnot

Notnot punya bagian sendiri di **Pengaturan → Notnot**. Di sana kamu bisa mencoba setiap ekspresinya, dan menyalakan atau mematikan maskotnya, mata yang mengikuti kursor, serta setiap ekspresi.

| Keadaan | Notnot |
|---|---|
| Kursor datang | Bergoyang dan menoleh |
| Diklik | Melompat |
| Musik diputar | Mengangguk dan muncul not musik |
| Pomodoro fokus | Memakai kacamata |
| Terlalu lama di aplikasi distraksi | Cemas |
| Ada pengingat | Melompat dan garis kuningnya berkedip |
| Komputer lama tidak dipakai atau sudah malam | Mengantuk (Zzz) |
| Semua tugas hari ini selesai | Senang dan muncul bintang |

## 3. To-do dan pengingat

- Pilih tanggal di kalender. Titik di bawah tanggal berarti ada tugas yang belum selesai di hari itu.
- Ketik tugas, lalu tekan Enter. Kalau kamu menulis jam di akhir, jamnya langsung dikenali. Contoh: `Rapat 09:00` atau `Telepon klien jam 9.30`.
- **Prioritas:** tulis `!1` (tinggi), `!2` (sedang), atau `!3` (rendah) saat menambah tugas, misalnya `Bayar pajak !1 10:00`. Prioritas juga bisa dipilih di editor. Tugas berprioritas tinggi selalu berada paling atas.
- Klik tugas untuk membuka **editor**. Di sana kamu bisa memilih tanggal di kalender atau lewat tombol cepat (Hari ini, Besok, Akhir pekan, Minggu depan), mengatur jam, dan memilih kapan diingatkan (**Tepat waktu, 10 menit, 1 jam, 1 hari** sebelumnya).
- Notifikasi pengingat punya tombol **Selesai** dan **Tunda 10 mnt**. Tanda panah di sebelah Tunda menampilkan pilihan 5 mnt, 30 mnt, 1 jam, atau Besok pagi.
- **Pagi hari:** saat kamu mulai memakai komputer, notch menampilkan tugas hari itu.
- **Malam hari** (bawaan jam 20:00): kalau to-do besok masih kosong, notch mengajak kamu menuliskannya.
- Tugas yang belum selesai otomatis pindah ke hari ini dengan label "dari kemarin".

## 3a. Logbook (laporan kegiatan)

Untuk kamu yang harus melaporkan pekerjaan harian, mingguan, atau bulanan ke atasan.

- **Otomatis:** setiap to-do yang kamu centang selesai langsung tercatat di Logbook beserta jam selesainya. Kalau centangnya dibatalkan, catatannya ikut hilang. Kalau tugasnya dihapus dari To-do, catatan di Logbook tetap ada.
- **Kegiatan di luar to-do:** ketik di kolom **Tambah kegiatan lain**, misalnya `09:00 Rapat koordinasi` atau `08:00-10:00 Verifikasi berkas`.
- **Keterangan atau hasil:** arahkan kursor ke sebuah kegiatan, lalu klik ikon pensil. Di situ kamu bisa mengubah uraian, jam, dan menambah keterangan (misalnya "15 dokumen selesai diverifikasi").
- **Ikon mata** menyembunyikan kegiatan dari laporan tanpa menghapusnya.
- **Harian, Mingguan, Bulanan:** pilih di atas, lalu geser periodenya dengan tanda panah. Di tampilan mingguan dan bulanan, klik nama hari untuk membuka hari itu.
- **Ringkasan produktivitas** di sebelah kanan berisi jumlah kegiatan, waktu produktif, persentase produktif dan gangguan, grafik per hari, sesi Pomodoro, dan aplikasi yang paling banyak dipakai. Datanya diambil dari pelacak fokus, jadi tercatat selama NotchNote menyala.
- **Salin laporan** menyalin laporan rapi (nama, jabatan, tanggal, uraian kegiatan bernomor, dan ringkasan produktivitas). Tinggal tempel di WhatsApp, email, atau dokumen.
- **Excel** menyimpan daftar kegiatan sebagai file CSV yang bisa dibuka di Excel. Kolomnya: No, Tanggal, Hari, Jam, Uraian Kegiatan, Keterangan, Sumber, dan Prioritas.

Atur di **Pengaturan → Logbook**:

- nama, jabatan, dan unit kerja untuk kepala laporan
- menyalakan atau mematikan ringkasan produktivitas dan prioritas di laporan
- pencatatan otomatis dari to-do
- **Ringkasan sore**: pengingat Senin sampai Jumat untuk memeriksa logbook sebelum pulang. Bawaannya mati.

## 4. Catatan

Ada tiga jenis catatan. Buat lewat tombol **Teks**, **Checklist**, atau **Prioritas** di kanan atas, atau tekan `Ctrl+Alt+N` untuk catatan teks.

- **Teks:** baris pertama otomatis menjadi judul. Awali baris dengan `- ` atau `1. `, lalu tekan Enter, maka tanda daftarnya berlanjut sendiri. Tekan Enter dua kali untuk berhenti.
- **Checklist:** tulis item lalu tekan Enter. Klik lingkaran untuk mencentang, dan bilah kemajuan menunjukkan berapa yang sudah selesai.
- **Prioritas:** item dikelompokkan menjadi **Tinggi**, **Sedang**, dan **Rendah**. Klik bendera untuk mengganti prioritas, atau tulis `!1` (tinggi), `!2` (sedang), atau `!3` (rendah) di item.

Tips:

- **Ubah urutan:** tarik ikon titik-titik di kiri item. Di daftar prioritas, menarik item ke kelompok lain juga mengganti prioritasnya.
- **Enter** di tengah item memecahnya menjadi dua. **Backspace** di awal item menggabungkannya dengan item di atasnya.
- **Ubah jenis catatan** lewat tiga ikon di kiri atas editor. Misalnya, catatan teks berisi daftar bisa diubah jadi checklist.
- **Kirim ke To-do** (ikon daftar centang di toolbar) memindahkan item yang belum selesai ke To-do hari ini atau besok. Item prioritas ikut membawa benderanya.
- **Template** tersedia untuk notulen rapat, daftar belanja, prioritas minggu ini, persiapan berangkat, jurnal harian, dan ide.
- **Sembunyikan** atau **hapus** item yang sudah selesai lewat tautan di bawah daftar.
- Catatan bisa diberi warna, disematkan, disalin, dan dicari (termasuk isi itemnya). Tombol hapus perlu diklik dua kali supaya tidak terhapus tanpa sengaja.

## 5. Klip (screenshot dan clipboard)

- Setiap kali kamu menekan **PrtSc**, **Win+Shift+S**, atau memakai Snipping Tool, gambarnya tersimpan di Klip dan muncul pratinjau di notch.
- Teks yang kamu salin juga tersimpan. Pengecualiannya teks dari pengelola kata sandi, yang tidak ikut disimpan. Penyimpanan teks bisa dimatikan di Pengaturan → Klip.
- **Klik item** untuk menyalinnya lagi. Arahkan kursor ke item untuk tombol **sematkan**, **simpan sebagai file**, **buka**, **jadikan catatan**, dan **hapus**.
- Bawaannya, Klip menyimpan 40 item terakhir. Item yang disematkan tidak ikut terhapus.

## 6. AI langsung dari notch

**Pilihan gratis** (tanpa kartu kredit):

| Penyedia | Cara mendapatkan | Kira-kira gratis |
|---|---|---|
| **Groq** | Buat API key di https://console.groq.com/keys | sekitar 1.000 chat/hari |
| **Gemini** | Buat API key di https://aistudio.google.com/apikey | tergantung model (Flash-Lite paling longgar) |
| **OpenRouter** | Buat API key di https://openrouter.ai/settings/keys (model `openrouter/free`) | sekitar 50 chat/hari |
| **Ollama** | Pasang dari https://ollama.com, lalu jalankan `ollama pull llama3.2` | tanpa batas, berjalan di komputermu sendiri (butuh RAM sekitar 8 GB atau lebih) |

Batas gratis bisa berubah sewaktu-waktu. Layanan gratis bisa memakai isi chat untuk melatih modelnya, jadi hindari memasukkan data sensitif.

**Pilihan berbayar:** Claude dan ChatGPT.

1. Pilih AI utama di **Pengaturan → AI** (Claude, ChatGPT, atau Gemini).
2. Supaya bisa chat langsung dari notch, tempel **API key** di pengaturan itu. Link untuk mendapatkannya:
   - Claude: https://platform.claude.com/settings/keys. Saat membuat key, pilih sebuah **workspace**. Kalau key-nya tidak terikat workspace, isi **Workspace ID** di pengaturan.
   - ChatGPT (OpenAI): https://platform.openai.com/api-keys
   - Gemini: https://aistudio.google.com/apikey (ada kuota gratis)
3. Klik **Tes koneksi** untuk memastikan API key-nya berfungsi.

Kalau belum ada API key, pertanyaanmu dibuka di situs AI-nya. Untuk Gemini, pertanyaan disalin dulu, lalu kamu tinggal menekan Ctrl+V.

API key disimpan **terenkripsi** dengan akun Windows-mu dan hanya dikirim ke penyedia AI itu sendiri. Biaya mengikuti pemakaian di akunmu. Kalau muncul pesan "Model tidak ditemukan", ganti nama model di Pengaturan → AI.

## 7. Musik dan lirik

- Bisa dipakai untuk Spotify, YouTube atau YouTube Music di browser, dan pemutar lain yang muncul di kontrol media Windows.
- Lirik diambil dari LRCLIB (gratis). Baris yang sedang dinyanyikan disorot, dan kamu bisa klik satu baris untuk lompat ke bagian itu.
- Saat lagu diputar, baris lirik juga berjalan di notch kecil. Fitur ini, ukuran lirik, dan latar sampul album bisa diatur di **Pengaturan → Musik**.

### Kalau lirik tidak muncul atau salah

- **Cari manual:** di halaman Musik, klik **Cari manual** (atau **Salah lirik?**). Tulis "artis - judul", lalu pilih hasil yang benar. Pilihanmu diingat untuk lagu itu.
- **Lirik terlalu cepat atau lambat:** cara paling mudah adalah klik **ikon target** tepat saat penyanyi mulai menyanyikan baris berikutnya, maka lirik langsung pas. Bisa juga dengan tombol − atau + (per 0,25 detik) di samping tulisan LIVE SYNC. Klik angkanya untuk mengembalikan ke 0. Pengaturan ini diingat per lagu.
- **Kalau semua lagu terasa sedikit terlambat,** pilih **Pengaturan → Musik → Majukan lirik**.
- **Label "versi beda"** muncul kalau durasi lagu di pemutar berbeda jauh dengan durasi liriknya. Biasanya ini video klip dengan intro panjang. Pakai ikon target untuk menyamakan.
- **Saat iklan diputar**, notch tidak mencari lirik, dan halaman Musik menampilkan "Iklan sedang diputar".

Lirik diambil dari LRCLIB (gratis, dikelola komunitas), dengan cadangan dari lyrics.ovh berupa teks tanpa sinkron. Lagu Indonesia yang kurang populer kadang memang belum punya liriknya di sana.

## 8. Jadwal sholat

- Bawaannya memakai metode **Kemenag RI** (Subuh 20°, Isya 18°, ihtiyat 2 menit). Hasilnya sudah dicocokkan dengan jadwal Kemenag untuk Jakarta.
- Pilih kotamu di **Pengaturan → Sholat**. Tersedia daftar kota di Indonesia, atau kamu bisa mengisi koordinat sendiri.
- Klik ikon lonceng pada setiap waktu sholat untuk menyalakan atau mematikan pengingatnya.
- Bawaannya, ada pengingat 10 menit sebelum waktu sholat.
- Suara pengingat: bunyi lembut, berkas .wav sendiri (misalnya rekaman adzan), atau tanpa suara.
- 15 menit sebelum waktu sholat, nama sholat dan hitung mundurnya muncul di notch kecil.
- Kalau jadwalnya berbeda dengan masjid setempat, geser beberapa menit di **Koreksi per waktu**.

## 9. Fokus dan Pomodoro

- **Fokus** mencatat aplikasi yang aktif lalu menggolongkannya: produktif, netral, atau distraksi. Daftarnya bisa diubah di Pengaturan → Produktivitas.
- **Timer** menyediakan mode fokus, istirahat, dan istirahat panjang. Kalau alarm dinyalakan, alarm berbunyi berulang saat sesi selesai dan notch ikut bergetar. Ada tombol **Matikan** atau **Mulai istirahat**.
- Durasi, lama alarm, dan suara alarm (bawaan atau .wav sendiri) bisa diatur di Pengaturan → Pomodoro.

## 10. Tema

Atur di **Pengaturan → Tampilan**:

- **Latar:** Hitam, Grafit, Malam, Hutan, Kopi, Aurora, Senja, Samudra, Kaca, Terang, atau Krem.
- **Warna aksen:** 11 pilihan, ditambah warna bebas pilihanmu sendiri.
- Ukuran notch, kepekatan latar, cahaya notifikasi, dan animasi (Normal atau Kurangi gerak).

---

## 11. Kalau ada masalah

| Masalah | Solusi |
|---|---|
| Ada kotak hitam di sekitar notch | Nyalakan **Pengaturan → Tampilan → Mode kompatibilitas** |
| Notch hilang | Klik ikon NotchNote di tray (dekat jam), lalu pilih **Kembalikan ke tengah atas** |
| Pintasan keyboard tidak jalan | Kombinasinya mungkin dipakai aplikasi lain. Matikan aplikasi itu, atau pakai klik biasa |
| Lirik tidak muncul | Lagu belum ada di LRCLIB, atau tidak ada koneksi internet |
| Yang muncul versi lama | Jalankan sekali versi terbaru: versi lama ditutup otomatis dan autostart dipindah ke folder baru. Setelah itu folder versi lama boleh dihapus. Lokasi yang sedang berjalan terlihat di **Pengaturan → Umum → Tentang** |
| Muncul error lain | Buka **Pengaturan → Umum → Buka folder**, lalu kirim isi `notchnote.log` |

## 12. Membagikan ke teman

Kirim saja tautan ini: https://github.com/ffziwebapp/notchnote/releases/latest

Teman tinggal mengunduh installer-nya dan menjalankannya. Setiap orang memakai API key AI-nya sendiri, jadi **jangan bagikan API key-mu**.

**Membuat versi baru** (untuk pemilik repositori):

1. Ubah kodenya.
2. Naikkan nomor versi di `src-tauri/tauri.conf.json` dan `src-tauri/Cargo.toml`.
3. Buat tag, misalnya `v1.2.1`.

GitHub akan membuat installer-nya otomatis dan menerbitkannya di halaman Releases.

## 13. Privasi

Semua data tersimpan hanya di komputermu, di folder `%APPDATA%\NotchNote`. Koneksi internet hanya dipakai untuk tiga hal:

- lirik (judul dan artis lagu dikirim ke LRCLIB),
- cuaca (koordinat kota dikirim ke Open-Meteo),
- chat AI (dikirim ke penyedia AI yang kamu pilih).
