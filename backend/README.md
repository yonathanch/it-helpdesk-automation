# Backend — IT Help Desk AI

Service API utama (NestJS + TypeScript).

## Perintah

```bash
npm install       # install dependencies
npm run start:dev # jalankan dev server (port 3000)
npm run build     # build untuk produksi
npm run lint      # ESLint + Prettier check
npm test          # unit test (Jest)
```

## Konfigurasi

Salin `.env.example` ke `.env` lalu sesuaikan nilai (saat setup B-1, file `.env` sudah dibuat otomatis).

## Infrastruktur (Docker)

Dari **root repo** jalankan:

```bash
docker compose up -d
```

| Service | Port | Kegunaan |
|---|---|---|
| PostgreSQL | 5432 | Database utama |
| Redis | 6379 | Queue & cache |
| MinIO | 9000 / 9001 (console) | Attachment tiket |

## Struktur

```
backend/
├── src/
│   ├── main.ts
│   ├── app.module.ts   # ConfigModule global (load .env)
│   ├── app.controller.ts
│   └── app.service.ts
├── test/               # E2E tests
├── .env                # environment (jangan di-commit)
└── package.json
```
