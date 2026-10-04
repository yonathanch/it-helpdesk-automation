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
- [ ] Komentar internal (agen only) vs publik (terlihat user)
- [ ] Upload file/attachment ke MinIO/S3

### B-6: Category & SLA module
- [ ] CRUD kategori
- [ ] Aturan SLA per prioritas, deadline otomatis
- [ ] Background job cek SLA breach (BullMQ + Redis)

### B-7: Notifikasi dasar
- [ ] Email notification (queue via Redis)
- [ ] In-app notification

---

## 🟡 Milestone 2 — AI Automation

### A-1: AI service layer
- [ ] Integrasi LLM provider (OpenAI/Claude/Gemini)
- [ ] Abstraction layer agar mudah ganti provider

### A-2: AI Triage pipeline
- [ ] Klasifikasi otomatis kategori + prioritas saat tiket baru
- [ ] Sentiment analysis → eskalasi prioritas jika user frustrasi

### A-3: RAG Knowledge Base
- [ ] Embedding artikel → pgvector
- [ ] Endpoint semantic search

### A-4: Chatbot virtual agent
- [ ] Endpoint chat dengan jawaban dari RAG
- [ ] Fallback: tawarkan buat tiket (data chat dipakai untuk prefill)

### A-5: Draft reply untuk agen
- [ ] AI generate draft jawaban per tiket
- [ ] Agen approve / edit sebelum kirim

### A-6: Auto-routing
- [ ] Assign tiket otomatis berdasarkan kategori & beban kerja agen

---

## 🔵 Milestone 3 — Frontend

### F-1: Setup Next.js + design system
- [ ] Next.js 15 + TypeScript + Tailwind + shadcn/ui
- [ ] Layout auth (login/register)

### F-2: Portal end user
- [ ] Buat tiket, list "tiket saya"
- [ ] Chat dengan AI bot

### F-3: Dashboard agen
- [ ] Inbox tiket, reply, internal note
- [ ] Ubah status & assign

### F-4: Knowledge base UI
- [ ] Search artikel + CRUD artikel

### F-5: Admin dashboard
- [ ] Statistik, SLA monitoring
- [ ] Manajemen user & kategori

---

## 🟣 Milestone 4 — Polish & Integrasi

- [ ] **Reporting & export** — MTTR, SLA compliance, CSAT
- [ ] **Integrasi Slack/Teams/WhatsApp** — webhook notifikasi
- [ ] **Realtime update** — WebSocket untuk status tiket & chat live
- [ ] **Testing E2E + Swagger** — dokumentasi API
- [ ] **Deployment CI/CD** — GitHub Actions + Docker

---

## 📌 Referensi

- Detail issue per checklist: [`docs/issues/planning-issues.md`](issues/planning-issues.md)
- Script opsional untuk push issue ke GitHub Issues: [`docs/issues/create-issues.sh`](issues/create-issues.sh)
