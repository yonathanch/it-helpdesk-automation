# Panduan Uji Manual — Help Desk AI

Panduan ini untuk menguji aplikasi sendiri dari nol, tanpa perlu membaca kode.

Ikuti urutan dari atas ke bawah. Setiap langkah ADA yang seharusnya terjadi — kalau tidak sesuai, catat dan laporkan.

---

## Bagian 0 — Menyiapkan (sekali saja)

### Langkah 1: Nyalakan database

Buka **Git Bash** di folder proyek `it-helpdesk`, lalu jalankan:

```bash
docker compose up -d
```

Tunggu sekitar 15 detik. Cek:

```bash
docker ps --format "{{.Names}}  {{.Status}}"
```

Harus muncul 3 container, semuanya `Up`:
- `helpdesk-postgres`
- `helpdesk-redis`
- `helpdesk-minio`

Kalau belum up, tunggu lagi lalu ulangi `docker ps`.

### Langkah 2: Siapkan database

Cukup sekali. Kalau sudah pernah, lewati.

```bash
cd backend
npm install
npx prisma migrate deploy
npm run db:seed
```

`npm install` bisa memakan waktu beberapa menit untuk pertama kali.

### Langkah 3: Jalankan backend

```bash
cd backend
npm run start:dev
```

**Biarkan jendela ini tetap terbuka.** Tunggu sampai muncul tulisan:
```
Nest application successfully started
```

### Langkah 4: Jalankan frontend

Buka **jendela Git Bash baru** (supaya backend tidak ikut mati):

```bash
cd frontend
npm install
npm run dev
```

Tunggu sampai muncul `Ready in ...`.

### Langkah 5: Pastikan semuanya hidup

Di jendela ketiga, jalankan:

```bash
curl -s -o /dev/null -w "backend=%{http_code}\n" http://localhost:3000
curl -s -o /dev/null -w "frontend=%{http_code}\n" http://localhost:3001/login
```

Harus dua-duanya `200`.

Kalau `backend=000`, tunggu lebih lama — backend butuh ±40 detik untuk boot.

---

## Bagian 1 — Login

Buka **http://localhost:3001/login**

| Akun | Password | Untuk |
|---|---|---|
| `user@helpdesk.local` | `Password123!` | Pengguna biasa |
| `agent@helpdesk.local` | `Password123!` | Agen IT |
| `admin@helpdesk.local` | `Password123!` | Administrator |

**Yang harus dicek:**
- [ ] Login `user@...` → mendarat di **/tickets**
- [ ] Login `agent@...` → mendarat di **/inbox**
- [ ] Login `admin@...` → mendarat di **/admin**
- [ ] Password salah → muncul pesan "email atau password salah", TIDAK masuk
- [ ] Buka http://localhost:3001 tanpa login → otomatis ke halaman login

**Cara logout:** klik avatar/nama di kanan atas → tombol "Keluar". (Di tampilan mobile, ada juga tombol logout di sidebar.)

---

## Bagian 2 — Sebagai Pengguna Biasa

Login `user@helpdesk.local`.

### 2.1 Membuat tiket

1. Buka **http://localhost:3001/tickets/new**
2. Isi Judul: `Printer lantai 3 macet`
3. Isi Deskripsi: `Printer di lantai 3 tidak mau keluar kertas sejak pagi. Sudah di-restart tetap sama.`
4. Pilih Kategori: `Hardware`
5. Pilih Prioritas: `Sedang`
6. Klik **Kirim tiket**

**Yang harus dicek:**
- [ ] Otomatis pindah ke halaman detail tiket
- [ ] Kode tiket muncul format **HD-0001** (nomor bisa berbeda)
- [ ] Ada section "Analisis AI" — hasil klasifikasi kategori & prioritas
- [ ] Ada "Ditugaskan: Support Agent" (auto-routing jalan)
- [ ] Ada "Batas SLA" (contoh: "06 Okt, 13.09")

> **Catatan:** kategori & prioritas **bisa berubah oleh AI** setelah tiket dibuat. Itu memang perilaku yang benar — AI mengklasifikasi ulang. Jadi kalau Anda pilih "Hardware" tapi muncul "Akun & Akses", itu bukan bug.

### 2.2 Menulis pesan di tiket

1. Di halaman detail tiket, ketik di kotak "Isi pesan": `Halo, sudah saya coba di komputer lain tapi hasilnya sama.`
2. Klik **Kirim**

**Yang harus dicek:**
- [ ] Pesan Anda **muncul di percakapan**
- [ ] Halaman **tidak crash** (tidak muncul "Application error")
- [ ] Kotak isian kembali kosong
- [ ] Percakapan lama **tidak hilang**

### 2.3 Mengunggah lampiran

1. Klik **Unggah berkas**
2. Pilih file kecil apa saja (gambar atau .txt, di bawah 10 MB)
3. Tunggu sampai nama file muncul di daftar

**Yang harus dicek:**
- [ ] Nama file muncul di daftar Lampiran
- [ ] Percakapan **tetap utuh** (tidak hilang)
- [ ] Halaman tidak crash

### 2.4 Bertanya ke Asisten AI

1. Klik menu **Asisten AI** di sidebar (atau buka **/chat**)
2. Ketik: `Bagaimana cara reset password email kantor?`
3. Tekan Enter

**Yang harus dicek:**
- [ ] Ada jawaban muncul
- [ ] Ada daftar "sumber" artikel di bawah jawaban

### 2.5 Melihat Basis Pengetahuan

Buka **http://localhost:3001/knowledge**

**Yang harus dicek:**
- [ ] Daftar artikel tampil
- [ ] Ada kotak search — ketik `password`, hasil muncul
- [ ] Kotak search dikosongkan → cari tombol nonaktif atau pesan error

### 2.6 Membuka notifikasi

Klik ikon lonceng di kanan atas (atau **/notifications**).

**Yang harus dicek:**
- [ ] Ada notifikasi (mis. "Tiket dibuat")
- [ ] Klik **Tandai semua terbaca** → angka badge berkurang jadi 0

### 2.7 Coba akses halaman admin

Buka **http://localhost:3001/admin**

**Yang harus dicek:**
- [ ] Anda **TIDAK** bisa melihat dashboard admin
- [ ] Ada pesan "Akses tidak tersedia" atau otomatis dikembalikan ke beranda

---

## Bagian 3 — Sebagai Agen IT

Keluar dulu, lalu login `agent@helpdesk.local`.

### 3.1 Melihat antrean

Otomatis mendarat di **/inbox**.

**Yang harus dicek:**
- [ ] Daftar tiket masuk (termasuk tiket yang Anda buat di Bagian 2)
- [ ] Bisa filter status (Baru, Diproses, Menunggu Balasan, Selesai, Ditutup)
- [ ] Bisa filter prioritas
- [ ] Ada kotak pencarian

### 3.2 Menangani tiket

1. Klik salah satu tiket (pilih yang statusnya **Baru**)
2. Ubah **Status** ke `Diproses`

**Yang harus dicek:**
- [ ] Status berubah jadi "Diproses"
- [ ] Daftar pilihan status berubah — jadi **Baru / Menunggu Balasan / Selesai** saja
  (artinya transisi tidak sembarangan — dari "Diproses" tidak bisa langsung "Ditutup")

### 3.3 Balas ke pengguna

1. Di kotak pesan, pastikan mode **"Balasan publik"**
2. Ketik: `Halo, kami sedang mengirim teknisi ke lokasi Anda.`
3. Klik **Kirim**

**Yang harus dicek:**
- [ ] Pesan muncul di percakapan
- [ ] Tidak ada crash

### 3.4 Buat catatan internal

1. Klik tombol **"Catatan internal"** (yang ada ikon gembok)
2. Ketik: `Internal: cek stok toner, jangan lupa pesan bagian.`
3. Klik **Kirim**

**Yang harus dicek:**
- [ ] Pesan muncul dengan gaya berbeda (kuning/ber garis putus-putus)
- [ ] Ada label **"Catatan internal"**
- [ ] Ada tulisan "Hanya terlihat oleh tim IT"

### 3.5 Menugaskan agen

Di panel kanan "Aksi agen" → dropdown **"Tugaskan ke agen"**.

**Yang harus dicek:**
- [ ] Ada daftar nama agen + jumlah tiket aktif
- [ ] Bisa pilih salah satu
- [ ] Nama di "Ditugaskan" berubah sesuai pilihan

### 3.6 Coba draf AI

1. Klik **Buat draf** (section "Draf balasan AI")
2. Tunggu beberapa detik

**Yang harus dicek:**
- [ ] Ada teks draf muncul di kotak yang bisa disunting
- [ ] Tombol **Setujui & kirim** dan **Buang draf** muncul

**Uji "Buang draf"** → draf hilang, tombol "Buat draf" kembali muncul.

### 3.7 Selesaikan tiket, lalu beri CSAT

1. Ubah status ke `Selesai` (pilih dari transisi yang tersedia)
2. Keluar, login `user@helpdesk.local`
3. Buka tiket tadi
4. Seharusnya muncul **formulir rating bintang**

**Yang harus dicek:**
- [ ] Bisa beri rating 1-5
- [ ] Ada kolom komentar opsional
- [ ] Setelah dikirim, tidak bisa dinilai lagi (tombol hilang)

### 3.8 Uji realtime (penting)

Jalankan dua browser berdampingan — satu Incognito:

| Browser | Akun login |
|---|---|
| Normal | `agent@helpdesk.local` |
| Incognito | `user@helpdesk.local` |

Buka **tiket yang sama** di keduanya (copy-paste URL-nya).

Lalu di browser **agent**, ubah status tiket.

**Yang harus dicek:**
- [ ] Di browser **user**, status berubah **OTOMATIS tanpa tekan F5**
- [ ] Di browser **user**, pesan baru dari agent **muncul otomatis**

> Kalau tidak berubah otomatis, itu bug. Sudah pernah saya perbaiki — kalau muncul lagi, laporkan.

### 3.9 Coba akses admin

Buka **http://localhost:3001/admin** sebagai agen.

**Yang harus dicek:**
- [ ] **TIDAK** bisa melihat dashboard admin
- [ ] Pesan akses tidak tersedia

---

## Bagian 4 — Sebagai Administrator

Keluar, login `admin@helpdesk.local`. Otomatis ke **/admin**.

### 4.1 Statistik

**Yang harus dicek:**
- [ ] Kartu angka tampil: Total tiket, Tiket selesai, Rata-rata penyelesaian, Kepatuhan SLA, CSAT
- [ ] Ada grafik **Tren tiket**
- [ ] Tabel **Beban per kategori** — klik judul kolom untuk mengurutkan
- [ ] Filter **7 hari / 30 hari / 90 hari** berfungsi — angka berubah saat diganti
- [ ] Tombol **Muat ulang** berfungsi

### 4.2 Tiket berisiko SLA

**Yang harus dicek:**
- [ ] Daftar tiket merah (terlampaui) dan kuning (mendekati batas)
- [ ] Klik salah satu → langsung ke detail tiket

### 4.3 Unduh laporan CSV

Klik keempat tombol: **Daftar tiket**, **Ringkasan metrik**, **Tiket berisiko SLA**, **Hasil survei CSAT**.

**Yang harus dicek:**
- [ ] 4 file `.csv` terunduh
- [ ] Buka di Excel → data terbaca rapi, **tidak ada baris kosong aneh**
- [ ] Kolom angka terbaca sebagai angka, bukan teks

### 4.4 Hasil survei CSAT

**Yang harus dicek:**
- [ ] Skor rata-rata (mis. "4.15")
- [ ] Grafik distribusi bintang 1-5
- [ ] Daftar penilaian + komentar

### 4.5 Manajemen pengguna

Scroll ke section **Manajemen pengguna**.

**Yang harus dicek:**
- [ ] Bisa cari pakai kotak "Cari nama, email, atau departemen"
- [ ] Bisa filter **Role** dan **Status**
- [ ] Klik **Tambah pengguna** → buat akun uji, misal `agent.baru@helpdesk.local`, role **Agen IT**
- [ ] Akun baru langsung **muncul di dropdown "Tugaskan ke agen"** di Bagian 3.5
- [ ] Ubah role dropdown → berubah
- [ ] Klik **Nonaktifkan** → tombol jadi "Aktifkan"
- [ ] Halaman ada paginasi

**Uji anti-lockout (penting):**
- [ ] Baris akun Anda sendiri → kolom Aksi menulis **"Akun sendiri"**, tidak bisa diubah
- [ ] Tidak ada tombol hapus (cuma nonaktifkan)

**Uji akun nonaktif:**
- [ ] Nonaktifkan akun `agent.baru@...`, coba login → ditolak

### 4.6 Target SLA

**Yang harus dicek:**
- [ ] Ada daftar target per prioritas (Rendah/Sedang/Tinggi/Mendesak)
- [ ] Bisa ubah angka menit respons/penyelesaian

### 4.7 Kategori

**Yang harus dicek:**
- [ ] Daftar kategori (Hardware, Network, Software, dst.)
- [ ] Bisa tambah kategori baru → **langsung muncul** di dropdown form buat tiket (Bagian 2.1)

---

## Bagian 5 — Uji Error (wajib)

Pastikan aplikasi menolak input salah dengan baik.

| Uji | Yang diharapkan |
|---|---|
| Login password salah | Pesan error, tidak masuk |
| Judul tiket kosong | Pesan "wajib diisi", tidak terkirim |
| Judul tiket 1 huruf | Ditolak (minimal terlalu pendek) |
| Deskripsi kosong | Ditolak |
| Kirim pesan kosong | Tombol Kirim **nonaktif** (abu-abu) |
| Upload file > 10 MB | Pesan "melebihi 10 MB", tidak terunggah |
| Kategori tidak dipilih | Ditolak |
| Buka tiket milik orang lain | 404 / "tidak ditemukan" |
| Klik link logout lalu klik "kembali" di browser | Tetap logout, tidak bisa balik masuk |

---

## Kalau Ada yang Tidak Sesuai

Catat 4 hal ini:

1. **Langkah mana** — contoh: "Langkah 2.2 kirim pesan"
2. **Akun apa** — admin / agen / pengguna
3. **Yang diharapkan** — apa yang seharusnya terjadi
4. **Yang terjadi** — apa yang benar-benar terjadi, boleh disalin persis dari pesan error

---

## Ringkasan Alur Kerja

```
PENGGUNA                    AGEN IT                    ADMIN
   |                           |                         |
   |-- buat tiket ------------>|                         |
   |-- tulis pesan ------------>|                         |
   |                           |-- lihat antrean          |
   |                           |-- ubah status           |
   |                           |-- balas publik          |
   |                           |-- catatan internal      |
   |                           |-- tugaskan agen         |
   |                           |-- draf AI               |
   |<-- melihat update ---------|                         |
   |                           |                         |
   |-- tiket selesai ---------->|                         |
   |-- beri rating CSAT        |                         |
   |                           |                         |
   |                           |                         |-- lihat statistik
   |                           |                         |-- unduh CSV
   |                           |                         |-- kelola pengguna
   |                           |                         |-- atur SLA & kategori
```

---

## Masalah Umum

**"npm: command not found"**
Node.js belum terinstall. Unduh dari nodejs.org (versi 20 ke atas), lalu tutup & buka ulang Git Bash.

**"docker: command not found"**
Docker Desktop belum jalan. Buka aplikasi Docker Desktop, tunggu sampai ikonnya tidak menunjukkan "starting".

**Port 3000 sudah dipakai**
Ada proses backend lama masih jalan. Tutup jendela backend sebelumnya, atau jalankan:
```bash
netstat -ano | grep ":3000"
taskkill //PID <nomor> //F
```

**Halaman tampil "Application error"**
Refresh dengan **Ctrl+Shift+R** (hard refresh). Kalau masih muncul, buka **http://localhost:3000/docs** untuk cek apakah backend masih hidup.

**Akun admin tidak ada**
Jalankan ulang seed:
```bash
cd backend
npm run db:seed
```

**Ingin mulai benar-benar dari nol (semua data hilang)**
```bash
docker compose down
docker volume rm it-helpdesk_pgdata
docker compose up -d
cd backend
npx prisma migrate deploy
npm run db:seed
```
> **HATI-HATI:** perintah ini MENGHAPUS semua tiket, pengguna, dan artikel yang ada.
