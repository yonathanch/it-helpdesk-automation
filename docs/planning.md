# 📋 Project Planning — IT Help Desk AI Automation

> **Visi:** Sistem IT Help Desk dengan AI Automation — portal tiket lengkap dengan chatbot AI, AI triage otomatis, knowledge base RAG, dan SLA management.
>
> **Urutan pengerjaan:** Backend → AI Service → Frontend → Integrasi
> **Prinsip:** Tidak ada deadline — selesai satu issue baru lanjut ke berikutnya.

---

## 🛠️ Tech Stack

| Layer | Teknologi | Alasan |
|---|---|---|
| Frontend | Next.js 15 + TypeScript + Tailwind + shadcn/ui | SSR, cepat, komponen siap pakai |
| Backend | NestJS + TypeScript | Struktur modular, cocok sistem besar |
| Database | PostgreSQL + Prisma | Relasional kuat untuk tiket & SLA |
| Cache/Queue | Redis + BullMQ | Queue job AI & notifikasi |
| Realtime | Socket.io | Update status tiket & chat live |
| LLM | OpenAI GPT-4o / Claude / Gemini (Ollama untuk on-premise) | Chatbot, triage, draft reply |
| Vector DB | pgvector | RAG knowledge base |
| AI Framework | LangChain.js / Vercel AI SDK | Orkestrasi RAG & agent |
| Auth | JWT + refresh (NextAuth / Keycloak untuk SSO) | Login & role management |
| File Storage | MinIO / S3 | Attachment tiket |
| Infra | Docker + GitHub Actions | CI/CD mudah |

---

## 🟢 Milestone 1 — Backend Foundation

### B-1: Setup proyek & infra
- [x] Init proyek NestJS + TypeScript
- [x] Docker Compose: PostgreSQL, Redis, MinIO
- [x] Konfigurasi environment (.env, config module)
- [x] Setup linter (ESLint + Prettier)

### B-2: Skema database & migrasi
- [x] Setup Prisma ORM
- [x] Entitas: User, Role, Ticket, TicketMessage, Attachment, Category, SLA, KnowledgeArticle, CSATSurvey
- [x] Migrasi awal + seed data dasar

### B-3: Auth & RBAC
- [x] Register / login (JWT + refresh token)
- [x] Role: End User, Agent, Admin
- [x] Guard per endpoint berdasarkan role

### B-4: CRUD Ticket core
- [x] Buat tiket (judul, deskripsi, kategori, prioritas)
- [x] Update status: Open → In Progress → Waiting User → Resolved → Closed
- [x] Assign tiket ke agen
- [x] List tiket: filter, pagination, sorting

### B-5: Ticket conversation & attachment
- [x] Komentar internal (agen only) vs publik (terlihat user)
- [x] Upload file/attachment ke MinIO/S3

### B-6: Category & SLA module
- [x] CRUD kategori
- [x] Aturan SLA per prioritas, deadline otomatis
- [x] Background job cek SLA breach (BullMQ + Redis)

### B-7: Notifikasi dasar
- [x] Email notification (queue via Redis)
- [x] In-app notification

---

## 🟡 Milestone 2 — AI Automation

### A-1: AI service layer
- [x] Integrasi LLM provider (OpenAI/Claude/Gemini)
- [x] Abstraction layer agar mudah ganti provider

### A-2: AI Triage pipeline
- [x] Klasifikasi otomatis kategori + prioritas saat tiket baru
- [x] Sentiment analysis → eskalasi prioritas jika user frustrasi

### A-3: RAG Knowledge Base
- [x] Embedding artikel → pgvector
- [x] Endpoint semantic search

### A-4: Chatbot virtual agent
- [x] Endpoint chat dengan jawaban dari RAG
- [x] Fallback: tawarkan buat tiket (data chat dipakai untuk prefill)

### A-5: Draft reply untuk agen
- [x] AI generate draft jawaban per tiket
- [x] Agen approve / edit sebelum kirim

### A-6: Auto-routing
- [x] Assign tiket otomatis berdasarkan kategori & beban kerja agen

---

## 🔵 Milestone 3 — Frontend

### F-1: Setup Next.js + design system
- [x] Next.js 15 + TypeScript + Tailwind + shadcn/ui
- [x] Layout auth (login/register)
- [x] Layout aplikasi: sidebar per role, header, breadcrumb, nav mobile
- [x] CORS backend diaktifkan (env `CORS_ORIGINS`)

### F-2: Portal end user
- [x] Buat tiket, list "tiket saya"
- [x] Detail tiket: deskripsi, percakapan, lampiran, ringkasan SLA
- [x] Chat dengan AI bot (+ prefill otomatis ke form tiket)
- [x] Survei kepuasan (CSAT) untuk pelapor tiket yang sudah selesai

### F-3: Dashboard agen
- [x] Inbox tiket dengan pencarian, filter, sort, dan paginasi
- [x] Balasan publik + catatan internal
- [x] Ubah status (mengikuti aturan transisi backend) & assign otomatis
- [x] Panel draf balasan AI: buat, sunting, setujui, atau buang

### F-4: Knowledge base UI
- [x] Pencarian semantik dengan skor kemiripan
- [x] Daftar & detail artikel (versi draf hanya untuk agen/admin)
- [x] CRUD artikel + rebuild embedding (admin)

### F-5: Admin dashboard
- [x] Statistik: total, MTTR, kepatuhan SLA, CSAT, tren harian
- [x] Beban per kategori & daftar tiket berisiko SLA
- [x] Tombol unduh 4 laporan CSV
- [x] Manajemen target SLA per prioritas
- [x] Manajemen kategori

---

## 🟣 Milestone 4 — Polish & Integrasi

- [x] **Reporting & export** — MTTR, SLA compliance, CSAT
  - [x] `GET /reporting/overview|trend|categories|sla-at-risk` (ADMIN)
  - [x] CSAT: `POST /surveys/tickets/:id` (pelapor saja) + `GET /surveys` (ADMIN)
  - [x] Ekspor CSV: `GET /reporting/export/{tickets|overview|sla-at-risk|csat}.csv` (proteksi CSV injection + BOM UTF-8)
- [x] **Integrasi Slack/Teams/WhatsApp** — webhook notifikasi
  - [x] Service + BullMQ worker, format Slack/Teams/WhatsApp, retry 3x backoff
  - [x] Hook: tiket dibuat, ditugaskan, status berubah, SLA breach
- [x] **Realtime update** — WebSocket untuk status tiket & chat live
  - [x] Gateway `/realtime` (JWT auth), room `ticket:<id>` + `agents`
  - [x] Event: `message`, `ticket_updated`, `ticket_created`, notifikasi
  - [x] Klien Socket.IO di frontend: inbox & detail tiket ikut berubah tanpa muat ulang
- [x] **Manajemen pengguna** — admin mengelola akun tanpa menyentuh database
  - [x] `GET /users` (ADMIN) — filter peran/status, pencarian, sort, paginasi
  - [x] `POST /users` (ADMIN) — satu-satunya jalur membuat akun AGENT/ADMIN
  - [x] `PATCH /users/:id` (ADMIN) — ubah nama/departemen/peran, aktif/nonaktif
  - [x] `GET /users/agents` (AGENT/ADMIN) — daftar agen + beban tiket aktif
  - [x] Pengaman anti-kunci: admin aktif terakhir tidak bisa diturunkan/dinonaktifkan, tidak bisa mengubah peran/menonaktifkan akun sendiri, `passwordHash` tidak pernah dikirim ke klien
  - [x] Panel UI di dashboard admin: tabel, filter, form buat, ubah peran, aktif/nonaktif + konfirmasi
- [x] **Penugasan tiket dari UI** — agen memilih penanggung jawab langsung dari detail tiket
  - [x] Dropdown "Tugaskan ke agen" (menampilkan beban tiket tiap agen) memakai `PATCH /tickets/:id/assign`
- [x] **Testing E2E + Swagger** — dokumentasi API
  - [x] Swagger UI (`/docs`) + OpenAPI JSON (`/docs-json`), 46 operasi, 36 schema
  - [x] E2E end-to-end: [`backend/scripts/e2e.mjs`](../backend/scripts/e2e.mjs) — 99 pemeriksaan, 14 bagian (auth → tiket → AI → SLA → CSAT → ekspor CSV → manajemen pengguna → penugasan)
  - [x] Smoke test WebSocket: [`backend/scripts/ws-smoke.mjs`](../backend/scripts/ws-smoke.mjs) — membuat tiket sendiri bila belum ada tiket OPEN
- [x] **Deployment CI/CD** — GitHub Actions + Docker
  - [x] `backend/Dockerfile`, `frontend/Dockerfile` (multi-stage, non-root, healthcheck)
  - [x] `.github/workflows/ci.yml` (lint + typecheck + test + build + docker smoke)
  - [x] Job `e2e`: PostgreSQL+Redis sebagai service, migrasi + seed, jalankan backend lalu E2E + smoke WebSocket
  - [x] Service `backend` & `frontend` di `docker-compose.yml` (profile `app`)

---

## 📌 Referensi

- Detail issue per checklist: [`docs/issues/planning-issues.md`](issues/planning-issues.md)
- Script opsional untuk push issue ke GitHub Issues: [`docs/issues/create-issues.sh`](issues/create-issues.sh)
