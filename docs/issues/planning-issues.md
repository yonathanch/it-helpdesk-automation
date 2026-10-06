# 📝 Rincian Issue — IT Help Desk AI Automation

> Turunan rinci dari [`docs/planning.md`](../planning.md).
> Satu entri = satu issue yang bisa dikerjakan dan diuji.
>
> **Cara pakai:** kerjakan berurutan. Tiap entri punya *Selesai bila* —
> itulah definisi "beres", bukan sekadar kode ada.
>
> Untuk mendorong semua entri ke GitHub Issues, jalankan
> [`./create-issues.sh`](./create-issues.sh).

Legenda status: ✅ selesai · 🚧 dikerjakan · ⬜ belum

---

## 🟢 Milestone 1 — Backend Foundation

### B-1 · Setup proyek & infrastruktur ✅
- **Apa:** proyek NestJS, Docker Compose (PostgreSQL + pgvector, Redis, MinIO), konfigurasi env, ESLint & Prettier.
- **Selesai bila:** `npm run start:dev` hidup, `/` menjawab `Hello World!`, container database sehat.
- **Bukti:** `docker-compose.yml`, `backend/src/main.ts`.

### B-2 · Skema database & migrasi ✅
- **Apa:** Prisma ORM + entitas User, Ticket, TicketMessage, Attachment, Category, SLA, KnowledgeArticle, CSATSurvey, Notification.
- **Selesai bila:** `prisma migrate deploy` bersih dari database kosong, `db:seed` mengisi data contoh.
- **Catatan:** nomor tiket `HD-XXXX` memakai sequence Postgres `ticket_code_seq` supaya aman dari balapan (race condition).

### B-3 · Auth & RBAC ✅
- **Apa:** register/login, JWT akses (15 menit) + refresh (7 hari), tiga peran.
- **Selesai bila:** endpoint tanpa token → 401, role salah → 403.
- **Catatan:** guard dipasang global lewat `APP_GUARD`, jadi endpoint baru aman secara bawaan.

### B-4 · CRUD Ticket core ✅
- **Apa:** buat tiket, ubah status, penugasan, daftar dengan filter/paginasi/pengurutan.
- **Selesai bila:** transisi status ilegal ditolak 400, aturan transisi sama di backend dan frontend.
- **Catatan:** `ALLOWED_TRANSITIONS` di `tickets.service.ts` adalah sumber kebenaran. `CLOSED` bersifat final.

### B-5 · Percakapan & lampiran ✅
- **Apa:** balasan publik vs catatan internal, unggah lampiran ke MinIO.
- **Selesai bila:** pelapor tidak bisa membuat catatan internal (403) dan tidak melihat catatan internal orang lain.

### B-6 · Kategori & SLA ✅
- **Apa:** CRUD kategori, batas SLA per prioritas, job pemeriksa pelanggaran SLA.
- **Selesai bila:** tiket baru mendapat `slaDueAt` sesuai prioritas; job menandai `slaBreachedAt`.

### B-7 · Notifikasi ✅
- **Apa:** notifikasi in-app + antrean email (BullMQ).
- **Selesai bila:** pembuat tiket menerima notifikasi saat status berubah; email dicetak ke log saat `SMTP_HOST` kosong.

---

## 🟡 Milestone 2 — AI Automation

### A-1 · Lapisan layanan AI ✅
- **Apa:** abstraksi provider LLM (OpenAI/Claude/Gemini/Ollama/mock) dan embedding (OpenAI/mock).
- **Selesai bila:** mengganti `LLM_PROVIDER` di `.env` tidak mengubah kode lain.
- **Catatan:** `mock` membuat proyek bisa dijalankan dan diuji tanpa API key.

### A-2 · AI Triage ✅
- **Apa:** klasifikasi kategori + prioritas saat tiket dibuat, analisis sentimen.
- **Selesai bila:** tiket baru punya `aiTriaged`, `aiSentiment`, `aiConfidence`; kegagalan AI tidak menggagalkan pembuatan tiket.

### A-3 · RAG Knowledge Base ✅
- **Apa:** embedding artikel ke pgvector + pencarian semantik.
- **Selesai bila:** `GET /knowledge/search?q=...` mengembalikan skor `similarity`; query kosong ditolak 400.

### A-4 · Chatbot ✅
- **Apa:** `POST /chat` menjawab dari basis pengetahuan; bila tidak yakin menawarkan buat tiket.
- **Selesai bila:** respons memuat `answer`, `sources`, `suggestTicket`, `prefill`, `provider`; riwayat dibatasi 20 pesan.

### A-5 · Draf balasan ✅
- **Apa:** AI menyusun draf; agen menyunting lalu menyetujui.
- **Selesai bila:** draf tidak pernah terkirim tanpa persetujuan; setelah disetujui `aiDraft` kosong dan pesan ditandai `isAiGenerated`.

### A-6 · Auto-routing ✅
- **Apa:** penugasan otomatis berdasarkan kategori & beban kerja agen.
- **Selesai bila:** `POST /tickets/:id/auto-assign` memilih agen dengan tiket aktif paling sedikit.

---

## 🔵 Milestone 3 — Frontend

### F-1 · Setup Next.js & design system ✅
- **Apa:** Next.js 15, Tailwind v4, token warna, layout auth & layout aplikasi (sidebar per peran, drawer mobile).
- **Selesai bila:** navigasi berbeda per peran; CORS backend menerima `http://localhost:3001`.

### F-2 · Portal pengguna ✅
- **Apa:** tiket saya, buat tiket, detail tiket (percakapan, lampiran, ringkasan SLA), asisten AI, survei kepuasan.
- **Selesai bila:** hasil chat bisa langsung dijadikan tiket lewat tombol "Buat tiket" (judul & deskripsi terisi).
- **Catatan:** formulir survei memperlakukan 409 sebagai "sudah dinilai", bukan galat.

### F-3 · Dashboard agen ✅
- **Apa:** inbox dengan pencarian/filter/urut/paginasi, balasan publik & catatan internal, ubah status, penugasan manual + otomatis, panel draf AI.
- **Selesai bila:** tidak ada perpindahan status yang ditawarkan UI tapi ditolak server.

### F-4 · Basis pengetahuan ✅
- **Apa:** pencarian semantik, daftar & detail artikel, CRUD + rebuild embedding untuk admin.
- **Selesai bila:** artikel draf hanya terlihat AGENT/ADMIN.

### F-5 · Dashboard admin ✅
- **Apa:** metrik (total, MTTR, kepatuhan SLA, CSAT, tren), beban per kategori, tiket berisiko SLA, unduh 4 laporan CSV, target SLA, kategori, **manajemen pengguna**.
- **Selesai bila:** admin bisa membuat akun Agen IT; admin aktif terakhir tidak bisa diturunkan; akun sendiri tidak bisa dinonaktifkan.

---

## 🟣 Milestone 4 — Polish & Integrasi

### M4-1 · Swagger ✅
- **Apa:** dokumentasi OpenAPI di `/docs` + JSON di `/docs-json`.
- **Selesai bila:** setiap endpoint punya ringkasan, contoh query, dan skema respons.

### M4-2 · Webhook Slack/Teams/WhatsApp ✅
- **Apa:** service + worker BullMQ, format per kanal, retry 3x backoff.
- **Selesai bila:** tanpa `WEBHOOK_*_URL` sistem tetap jalan dan hanya memberi peringatan.

### M4-3 · Reporting & CSAT ✅
- **Apa:** `overview`, `trend`, `categories`, `sla-at-risk`, ekspor CSV, survei kepuasan.
- **Selesai bila:** CSV terlindungi dari formula injection dan punya BOM UTF-8; "tidak ada data" ditulis `n/a`, bukan `0`.
- **Catatan:** filter tanggal `YYYY-MM-DD` diperlakukan sebagai **hari penuh** — kalau tidak, tiket hari ini ikut terbuang.

### M4-4 · Realtime ✅
- **Apa:** gateway Socket.IO `/realtime`, klien di frontend.
- **Selesai bila:** tiket yang diubah agen lain langsung tampil tanpa muat ulang.

### M4-5 · Manajemen pengguna ✅
- **Apa:** `GET/POST/PATCH /users`, `GET /users/agents`, panel admin.
- **Selesai bila:** `passwordHash` tidak pernah keluar dari API; akun dinonaktifkan tidak bisa login (401).

### M4-6 · Testing E2E ✅
- **Apa:** skrip alur nyata lewat HTTP.
- **Selesai bila:** `npm run test:e2e` keluar 0 dan menguji auth → tiket → AI → SLA → CSAT → ekspor → pengguna.

### M4-7 · Penugasan tiket dari UI ✅
- **Apa:** dropdown "Tugaskan ke agen" di detail tiket (memakai `PATCH /tickets/:id/assign`).
- **Selesai bila:** agen bisa memilih penanggung jawab dan pilihannya tersimpan.

---

## ⬜ Yang masih terbuka (opsional, bukan bug)

Item di bawah **tidak menghalangi pemakaian** dan sengaja belum dikerjakan:

1. **AI mode `mock`** — jawaban masih contoh. Isi API key lalu ubah `LLM_PROVIDER` di `backend/.env`.
2. **Impor/ekspor daftar pengguna (CSV)** — belum ada.
3. **Login SSO / Keycloak** — direncanakan di tech stack, belum diimplementasi.
4. **PWA / mode luring** — belum.
5. **Uji unggah lampiran di CI** — job `e2e` sengaja tidak menyediakan MinIO (aplikasi tetap boot dengan peringatan). Tambahkan service `minio` bila nanti ada uji unggah berkas.
