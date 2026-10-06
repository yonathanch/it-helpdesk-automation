# syntax=docker/dockerfile:1

# ============================================================
# Backend IT Help Desk AI — image produksi
#
# Multi-stage:
#   1. deps    — install seluruh dependency (termasuk dev) untuk build
#   2. builder — generate Prisma client + compile TypeScript
#   3. runner  — hanya production dependency, user non-root
# ============================================================

# ---------- 1. Dependency ----------
FROM node:22-alpine AS deps
WORKDIR /app

# Salin manifest dulu supaya layer cache tetap kena saat hanya src berubah.
COPY package.json package-lock.json ./
RUN npm ci

# ---------- 2. Build ----------
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY tsconfig*.json nest-cli.json ./
COPY src ./src

# Prisma Client perlu di-generate sebelum kompilasi (tipe diambil dari Prisma).
RUN npx prisma generate
RUN npm run build

# CATATAN: sengaja TIDAK memakai `npm prune --omit=dev` di sini.
# Perintah itu terbukti menghapus native module yang masih dipakai runtime
# (`bcrypt`), sehingga container produksi gagal boot dengan MODULE_NOT_FOUND.
# Image jadi sedikit lebih besar, tapi benar.

# ---------- 3. Runtime ----------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Alpine butuh libssl untuk Prisma engine.
RUN apk add --no-cache libssl3 openssl \
  && addgroup -S appgroup \
  && adduser -S appuser -G appgroup

COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/prisma ./prisma
COPY --chown=appuser:appgroup package.json ./

# Jangan jalankan sebagai root.
USER appuser

EXPOSE 3000

# Healthcheck: pastikan service benar-benar merespons.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/auth/me',r=>process.exit(r.statusCode<500?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "dist/main.js"]