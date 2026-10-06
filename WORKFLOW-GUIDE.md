# 📋 IT Help Desk AI Automation — Workflow & Usage Guide

> Panduan lengkap setup, cara pakai aplikasi per role, dan checklist fitur.

---

## 🚀 Setup & Menjalankan Aplikasi

### 1. Prerequisite
- **Docker & Docker Compose** terinstall
- **Node.js 20+** (untuk development lokal tanpa Docker)
- **Git** untuk cloning

### 2. Clone & Setup Awal

```bash
# Clone repository
git clone <repo-url>
cd it-helpdesk

# Setup environment
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### 3. Jalankan dengan Docker Compose

```bash
# Hanya infrastruktur (PostgreSQL, Redis, MinIO)
docker compose up -d

# Tunggu ~30 detik sampai semua service sehat
docker compose ps

# Kemudian jalankan backend + frontend
docker compose --profile app up -d --build

# Cek logs
docker compose logs -f backend
docker compose logs -f frontend
```

**Akses aplikasi:**
- Frontend: `http://localhost:3001`
- Backend API: `http://localhost:3000`
- Swagger API Docs: `http://localhost:3000/docs`
- Redis: `localhost:6379`
- PostgreSQL: `localhost:5433` (user: `helpdesk`, pass: `helpdesk`, db: `helpdesk`)
- MinIO Console: `http://localhost:9001` (user: `minioadmin`, pass: `minioadmin123`)

### 4. Development Lokal (tanpa Docker)

```bash
# Backend
cd backend
npm install
npm run db:migrate          # Jalankan migrasi Prisma
npm run db:seed             # Seed data testing
npm run start:dev           # Dev server (port 3000)

# Frontend (di terminal lain)
cd frontend
npm install
npm run dev                 # Dev server (port 3001)
```

**Akses:**
- Frontend: `http://localhost:3001`
- Backend: `http://localhost:3000`
- Swagger: `http://localhost:3000/docs`

---

## 👥 Role & Workflow Penggunaan

### 📌 Role yang Tersedia

| Role | Deskripsi | Akses |
|------|-----------|-------|
| **END_USER** | Pengguna akhir membuat tiket | Portal "Buat Tiket", chat AI, cek tiket pribadi |
| **AGENT** | Agen IT menangani tiket | Inbox semua tiket, balasan, AI draft, SLA tracking |
| **ADMIN** | Administrator sistem | Dashboard, user management, SLA settings, reporting |

---

## 🎯 Workflow per Role

### 🟢 END_USER — Pengguna Akhir

**Tujuan:** Membuat tiket masalah IT, berkomunikasi dengan agen, mengisi survei kepuasan.

#### Langkah-langkah:

1. **Registrasi / Login**
   - Buka `http://localhost:3001`
   - Klik "Register" → isi email, password, nama
   - Atau login jika sudah punya akun

2. **Buat Tiket Baru**
   - Menu "Buat Tiket" → isi:
     - **Judul**: deskripsi singkat masalah
     - **Deskripsi**: detail lengkap
     - **Kategori**: pilih kategori (Hardware, Software, Network, dll)
     - **Priority**: Auto-detected oleh AI triage (atau manual)
   - Klik "Buat" → tiket dibuat dengan nomor unik (HD-0001, HD-0002, dll)

3. **Pantau Tiket di "Inbox Saya"**
   - Lihat daftar tiket yang dibuat
   - Filter: status (Open, In Progress, Resolved), priority
   - Klik tiket → detail:
     - Status terkini + SLA deadline
     - Percakapan dengan agen
     - Upload lampiran (file)
     - Internal notes (catatan agen, tidak terlihat user)

4. **Chat dengan AI Bot** (Optional)
   - Menu "Chat" → tanya masalah ke AI
   - AI cari jawaban dari Knowledge Base
   - Kalau AI tidak bisa jawab → tawarkan "Buat Tiket" (auto-prefill dari chat)

5. **Survei Kepuasan (CSAT)** — setelah tiket resolved
   - Notifikasi: "Tiket HD-0001 resolved, berikan rating"
   - Isi rating 1-5 + komentar (optional)
   - Submit → feedback masuk ke admin reporting

#### Contoh Skenario:
```
User: Desktop tidak bisa hidup pagi ini
↓
Buat tiket → HD-0001 (URGENT, Hardware)
↓
AI triage: kategori Hardware, sentiment "urgent" → URGENT priority
↓
Agen lihat di inbox → assign ke diri sendiri → ubah status In Progress
↓
Agen balas: "Coba restart dulu"
↓
User lihat balasan → coba restart → berhasil
↓
User balas: "Sudah hidup, terima kasih!"
↓
Agen ubah status → Resolved
↓
Sistem kirim: "Rate kepuasan (1-5)"
↓
User rate 5 stars + "Cepat banget, terima kasih!"
```

---

### 🟡 AGENT — Agen IT

**Tujuan:** Menangani tiket, memberikan solusi, tracking SLA, approve draft AI.

#### Langkah-langkah:

1. **Login & Lihat Inbox**
   - Buka `http://localhost:3001` → login sebagai agent
   - Dashboard "Inbox" → daftar semua tiket (bukan hanya milik sendiri)
   - Filter: status, priority, category, assignee, assigned to me

2. **Ambil / Assign Tiket**
   - Klik tiket → tombol "Tugaskan ke Agen"
   - Dropdown agen + beban kerja tiap agen
   - Pilih agen (bisa diri sendiri)
   - Sistem auto-assign berdasarkan kategori & beban (bisa disable manual assign)

3. **Jawab Tiket**
   - Di detail tiket, section "Percakapan":
     - **Balasan Publik**: user bisa lihat (default)
     - **Catatan Internal**: hanya agen/admin lihat
   - Upload lampiran (screenshot, file solusi)
   - Klik "Kirim"

4. **Gunakan AI Draft Reply** (Fitur A-5)
   - Tombol "Generate Draft" → AI buat balasan saran
   - Review → edit kalau perlu
   - Klik "Approve & Send" atau "Discard"
   - Hemat waktu typing panjang-panjang

5. **Ubah Status Tiket**
   - Dropdown status: `OPEN` → `IN_PROGRESS` → `WAITING_USER` → `RESOLVED` → `CLOSED`
   - Sistem track: first reply time, resolution time (untuk MTTR)

6. **Monitor SLA**
   - SLA deadline tampil di tiket (warna merah jika dalam risiko breach)
   - Dashboard "SLA at Risk" → list tiket yang hampir deadline
   - Sistem auto-send notifikasi Slack/Teams/WhatsApp jika breach

7. **View Agent Performance** (Jika admin enable)
   - Dashboard agen: total tiket, avg resolution time, current load

#### Contoh Skenario:
```
Tiket masuk: "WiFi tidak konek"
↓
Agen lihat inbox → filter status=OPEN
↓
Klik tiket → lihat HD-0002, MEDIUM priority
↓
AI auto-triage: Network category
↓
Agen klik "Tugaskan ke Agen" → pilih diri sendiri (atau agen lain)
↓
Ubah status → IN_PROGRESS
↓
Klik "Generate Draft" → AI hasilkan:
   "Coba langkah berikut:
    1. Restart router
    2. Forget WiFi di device, reconnect
    3. Kalau tetap tidak konek, hubungi kami balik"
↓
Agen edit draft → tambah: "Atau update driver network card"
↓
Approve & Send
↓
User lihat balasan, coba langkah → WiFi konek
↓
User balas: "Sudah konek!"
↓
Agen ubah status → RESOLVED (auto-record resolution time)
```

---

### 🔵 ADMIN — Administrator

**Tujuan:** Monitor sistem, manage users, SLA rules, knowledge base, reporting.

#### Langkah-langkah:

1. **Dashboard Overview**
   - Login sebagai ADMIN
   - Homepage: statistik real-time
     - Total tiket, MTTR, SLA compliance %, CSAT rating rata-rata
     - Tren 7 hari (chart)
     - Tiket per kategori, beban agen

2. **User Management**
   - Menu "Admin" → "User Management"
   - Tabel: Email, Name, Role, Department, Status (Active/Inactive)
   - **Buat User Baru**:
     - Tombol "Buat Pengguna" → form:
       - Email, password awal, nama, departemen
       - Role: END_USER, AGENT, ADMIN
     - User bisa ubah password di login pertama
   - **Edit User**:
     - Klik user → ubah nama, departemen, role, status active/inactive
     - Tidak bisa ubah role/nonaktif diri sendiri (keamanan)
     - Tidak bisa ubah akun ADMIN aktif terakhir
   - **Password Reset**: (optional) admin set temporary password

3. **SLA Settings**
   - Menu "Admin" → "SLA Management"
   - Tabel: Priority, Response Minutes, Resolution Minutes, Active status
   - **Edit SLA**:
     - Klik priority (LOW, MEDIUM, HIGH, URGENT)
     - Ubah target first response time (misal: 2 jam)
     - Ubah target resolution time (misal: 8 jam)
     - Toggle Active/Inactive
   - Perubahan berlaku langsung ke tiket baru + background job SLA check

4. **Knowledge Base Management**
   - Menu "Knowledge" (atau "Admin" → "Knowledge")
   - **Buat Artikel**:
     - Tombol "Buat Artikel" → form:
       - Judul, category, konten (markdown), publish toggle
     - Klik "Simpan" → artikel disimpan (draft)
     - Klik "Publish" → artikel embed ke vector DB (RAG)
     - Tombol "Rebuild Embeddings" → re-embed semua artikel (long-running job)
   - **Edit / Delete**: klik artikel → edit / hapus
   - **View Published**: user bisa cari artikel di Knowledge Browser

5. **Category Management**
   - Menu "Categories" (atau di Admin)
   - **Buat Category**: name, slug, description
   - **Edit / Delete**: klik category
   - Pengaruh: tiket, knowledge articles, AI routing

6. **Reporting & Export**
   - Menu "Reporting"
   - **Overview Report**: chart MTTR, SLA compliance, CSAT
   - **Trend Report**: line chart 7 hari terakhir
   - **Category Report**: tiket per kategori, MTTR per kategori
   - **SLA at Risk**: list tiket dalam risiko breach
   - **CSAT Survey**: rating distribution, comments
   - **Export CSV**: 4 tombol
     - `Export Tickets.csv` → all tickets (dengan status, SLA, resolution time)
     - `Export Overview.csv` → summary stats
     - `Export SLA at Risk.csv` → tiket dalam risiko
     - `Export CSAT.csv` → survey responses + rating

7. **Monitor Notifications & Webhooks**
   - Notifikasi in-app: tiket created/assigned/status changed
   - Webhook integrations (Slack/Teams/WhatsApp):
     - Konfigurasi di `.env` (backend env vars)
     - Sistem auto-send tiket event ke webhook

#### Contoh Skenario Admin:
```
Pagi, admin login dashboard
↓
Lihat: 42 tiket open, MTTR 3.5 jam, SLA 94% compliance
↓
SLA at Risk: 3 tiket (URGENT, resolutionnya tinggal 1 jam)
↓
Assign agen khusus untuk ketiganya
↓
Lihat Knowledge Base → 23 artikel published
↓
Buat artikel baru: "Cara reset Windows password"
↓
Publish → auto-embed ke vector DB (RAG)
↓
Lihat reporting → CSAT rating turun ke 4.2 minggu ini
↓
Lihat CSAT survey: 2 user komplain "lama diresponse"
↓
Edit SLA: naik target response dari 4 jam → 2 jam (HIGH priority)
↓
Export tickets CSV → share ke manager operasional
```

---

## ✅ Feature Checklist & Status

### Backend Features

| Fitur | Status | Catatan |
|-------|--------|---------|
| **B-1: Setup & Infra** | ✅ | Docker, .env config done |
| **B-2: Database Schema** | ✅ | Prisma migrasi lengkap |
| **B-3: Auth & RBAC** | ✅ | JWT, 3 role, guard per endpoint |
| **B-4: CRUD Ticket** | ✅ | Create, read, list, status transition |
| **B-5: Conversation** | ✅ | Public/internal messages, attachment |
| **B-6: Category & SLA** | ✅ | SLA per priority, background job check |
| **B-7: Notifications** | ✅ | Email queue, in-app notifications |
| **A-1: AI Service** | ✅ | LLM provider abstraction (OpenAI, Claude, Gemini, mock) |
| **A-2: AI Triage** | ✅ | Auto category + priority + sentiment |
| **A-3: RAG Knowledge** | ✅ | pgvector embedding, semantic search |
| **A-4: Chatbot** | ✅ | Chat endpoint, fallback to ticket |
| **A-5: Draft Reply** | ✅ | AI generate, agent approve/edit/discard |
| **A-6: Auto-Routing** | ✅ | Assign berdasarkan kategori & beban |
| **M4-1: Reporting** | ✅ | Swagger, E2E tests (99 checks) |
| **M4-2: Webhooks** | ✅ | Slack, Teams, WhatsApp integration |
| **M4-3: Realtime** | ✅ | Socket.io WebSocket, ticket updates live |
| **M4-4: User Mgmt** | ✅ | CRUD user, role management, anti-lock guards |
| **M4-5: Assign UI** | ✅ | Dropdown assign dengan beban agen |

### Frontend Features

| Fitur | Status | Catatan |
|-------|--------|---------|
| **F-1: Setup & Design** | ✅ | Next.js 15, shadcn/ui, Tailwind |
| **F-2: End User Portal** | ✅ | Create ticket, list, detail, chat, CSAT |
| **F-3: Agent Dashboard** | ✅ | Inbox, reply, status change, AI draft |
| **F-4: Knowledge UI** | ✅ | Search semantik, list, detail, CRUD (admin) |
| **F-5: Admin Dashboard** | ✅ | Stats, user mgmt, SLA settings, reporting |
| **Realtime Updates** | ✅ | WebSocket inbox + detail tiket auto-refresh |
| **CORS** | ✅ | Frontend ↔ Backend communication |

---

## 🔴 Kekurangan & Saran Tambahan

### Priority Tinggi

1. **Environment Setup Documentation**
   - ❌ Belum ada `.env.example` di repo (user bingung env var apa yang dibutuhkan)
   - ✅ **Action**: Buat `backend/.env.example` dan `frontend/.env.example` dengan semua var + penjelasan

2. **API Key Management untuk LLM**
   - ⚠️ `LLM_PROVIDER` default `mock` (untuk testing, tapi di production perlu real key)
   - ✅ **Action**: Dokumentasi setup OpenAI/Claude/Gemini API keys, isi di `.env`

3. **Error Handling & User Feedback**
   - ⚠️ Beberapa endpoint belum konsisten error format
   - ✅ **Action**: Standardize error response di app exception filter

4. **Rate Limiting**
   - ❌ Belum ada rate limiter di backend
   - ✅ **Action**: Tambahkan `@nestjs/throttler` untuk anti-spam

### Priority Medium

5. **Bulk Operations**
   - ❌ Tidak ada bulk assign, bulk close, bulk export tiket
   - ✅ **Action**: Tambahan endpoint `PATCH /tickets/bulk` untuk operations massal

6. **Ticket Tags / Labels**
   - ❌ Hanya ada category, tidak ada tags fleksibel
   - ✅ **Action**: Add `Tag` model & many-to-many relasi ke `Ticket`

7. **Search Full-text**
   - ⚠️ Hanya ada filter, tidak ada full-text search di tiket
   - ✅ **Action**: Setup PostgreSQL full-text search atau Elasticsearch

8. **Soft Delete**
   - ❌ Delete permanen, tidak bisa recover
   - ✅ **Action**: Add `deletedAt` field (soft delete) di Ticket, User, KnowledgeArticle

9. **Audit Log**
   - ❌ Tidak ada log siapa yang ubah apa & kapan
   - ✅ **Action**: Add `AuditLog` model, middleware track perubahan

10. **Email Template**
    - ⚠️ Email notifikasi plain text, tidak ada HTML template
    - ✅ **Action**: Use `mjml` atau `handlebars` untuk email template profesional

### Priority Rendah

11. **Mobile Responsive**
    - ⚠️ Frontend Next.js, tapi belum di-test di mobile
    - ✅ **Action**: QA test di smartphone, fix responsive issue

12. **Dark Mode**
    - ❌ Hanya ada light theme
    - ✅ **Action**: Tambah dark mode toggle (Next.js + Tailwind support)

13. **Internationalization (i18n)**
    - ❌ Semua hardcoded Bahasa Indonesia / Inggris
    - ✅ **Action**: Setup `next-i18next` untuk multi-bahasa (ID, EN, dll)

14. **Performance Monitoring**
    - ❌ Tidak ada APM (Application Performance Monitoring)
    - ✅ **Action**: Integrate Sentry untuk error tracking, New Relic / DataDog untuk metrics

15. **Automated Testing Coverage**
    - ⚠️ Ada unit tests & E2E, tapi coverage masih incomplete
    - ✅ **Action**: Target 80%+ code coverage, tambah integration tests

---

## 🧪 Testing & Deployment

### Unit & E2E Tests

```bash
# Backend
cd backend

# Unit tests
npm run test

# E2E tests (jalankan backend dulu)
npm run test:e2e

# WebSocket smoke test
npm run test:ws

# Test coverage
npm run test:cov
```

### Build & Deploy

```bash
# Build Docker images
docker compose build

# Deploy (dengan infra services)
docker compose --profile app up -d --build

# Check health
curl http://localhost:3000/docs
curl http://localhost:3001
```

---

## 📚 API Documentation

**Swagger UI**: `http://localhost:3000/docs`

Semua endpoint terlihat di sini, bisa langsung test dengan "Try it out" button:
- **Auth**: login, register, refresh token
- **Tickets**: CRUD, list, assign, update status, messages, attachments
- **AI**: chat, triage, draft reply, semantic search
- **Users**: CRUD, list agents
- **Admin**: reporting, SLA, categories, webhooks
- **Realtime**: WebSocket `/realtime` (JWT + Socket.io)

---

## 🎓 Contoh Integrasi

### Setup OpenAI untuk AI Triage

1. **Daftar OpenAI** → dapat API key: `sk-...`

2. **Update `.env` backend**:
   ```
   LLM_PROVIDER=openai
   LLM_API_KEY=sk-your-key-here
   EMBEDDING_PROVIDER=openai
   EMBEDDING_API_KEY=sk-your-key-here
   ```

3. **Restart backend** → AI features aktif

### Setup Slack Notification

1. **Buat Slack webhook** → dapat URL: `https://hooks.slack.com/services/...`

2. **Update `.env` backend**:
   ```
   WEBHOOK_SLACK_URL=https://hooks.slack.com/services/...
   ```

3. **Restart backend** → tiket event dikirim ke Slack channel

---

## 📞 Support & Debugging

### Common Issues

| Issue | Solusi |
|-------|--------|
| `PostgreSQL connection refused` | Pastikan Docker postgres sehat: `docker compose logs postgres` |
| `Redis connection refused` | Restart Redis: `docker compose restart redis` |
| `AI draft reply kosong` | Check `LLM_API_KEY` di `.env`, pastikan provider aktif |
| `Realtime updates tidak jalan` | Check WebSocket connection di DevTools Network, pastikan JWT valid |
| `Email notifikasi tidak terkirim` | SMTP settings tidak ada (optional feature, bisa disable) |

### Debug Mode

```bash
# Backend verbose logging
DEBUG=* npm run start:dev

# Frontend React DevTools
# Install React DevTools browser extension

# Check Docker logs
docker compose logs -f backend
docker compose logs -f frontend
```

---

## 🚀 Next Steps

1. ✅ **Setup project** → pilih setup method (Docker atau dev lokal)
2. ✅ **Seed data** → `npm run db:seed` buat test users & tickets
3. ✅ **Explore features** → test per role (END_USER → AGENT → ADMIN)
4. ✅ **Konfigurasi LLM** → setup OpenAI / Claude API key
5. ✅ **Setup webhooks** (optional) → Slack, Teams, WhatsApp
6. ✅ **Deploy** → production di Docker atau cloud (AWS, GCP, Azure)

---

**Happy coding! 🎉**
