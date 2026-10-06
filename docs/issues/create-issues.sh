#!/usr/bin/env bash
#
# Dorong daftar issue proyek ke GitHub Issues memakai `gh` CLI.
#
# OPSIONAL — proyek ini berjalan tanpa ini. Pakai bila Anda ingin memantau
# pekerjaan lewat GitHub Issues, bukan hanya lewat docs/planning.md.
#
# Cara pakai:
#   ./create-issues.sh                 # buat issue yang belum ada
#   ./create-issues.sh --dry-run       # tampilkan saja, tidak mengubah apa pun
#   ./create-issues.sh --label sprint1 # label tambahan untuk semua issue
#
# Prasyarat:
#   - `gh` terpasang   → https://cli.github.com
#   - sudah login      → `gh auth login`
#   - dijalankan dari  → direktori repositori git
#
# Aman dijalankan berulang: judul yang sudah ada akan dilewati, bukan
# diduplikasi.

set -euo pipefail

DRY_RUN=false
EXTRA_LABEL=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --label)
      EXTRA_LABEL="${2:-}"
      if [[ -z "$EXTRA_LABEL" ]]; then
        echo "Error: --label butuh nilai, contoh: --label sprint1" >&2
        exit 1
      fi
      shift 2
      ;;
    --label=*)
      EXTRA_LABEL="${1#--label=}"
      shift
      ;;
    -h|--help)
      sed -n '2,20p' "$0"
      exit 0
      ;;
    *)
      echo "Argumen tidak dikenal: $1" >&2
      exit 1
      ;;
  esac
done

# ---- Pemeriksaan prasyarat -------------------------------------------------

if ! command -v gh >/dev/null 2>&1; then
  echo "Error: perintah 'gh' tidak ditemukan. Pasang dari https://cli.github.com" >&2
  exit 1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Error: jalankan skrip ini di dalam direktori repositori git." >&2
  exit 1
fi

if [[ "$DRY_RUN" == false ]] && ! gh auth status >/dev/null 2>&1; then
  echo "Error: belum login ke GitHub. Jalankan: gh auth login" >&2
  exit 1
fi

# ---- Daftar issue ----------------------------------------------------------
# Format: "Judul|body|label1,label2"
# Judul dipakai sebagai kunci anti-duplikat.

ISSUES=(
"B-1 Setup proyek NestJS & infrastruktur Docker|Proyek NestJS + Docker Compose (PostgreSQL/pgvector, Redis, MinIO), konfigurasi env, ESLint & Prettier.|backend,infra"
"B-2 Skema database Prisma & migrasi|Entitas User, Ticket, TicketMessage, Attachment, Category, SLA, KnowledgeArticle, CSATSurvey, Notification. Nomor tiket memakai sequence Postgres agar aman dari race condition.|backend,database"
"B-3 Auth JWT & RBAC tiga peran|Register/login, access token 15 menit, refresh token 7 hari, guard global per role (ADMIN/AGENT/END_USER).|backend,security"
"B-4 CRUD Ticket core|Buat tiket, ubah status mengikuti ALLOWED_TRANSITIONS, penugasan agen, daftar dengan filter/paginasi/pengurutan.|backend"
"B-5 Percakapan tiket & lampiran MinIO|Balasan publik vs catatan internal; pelapor tidak boleh membuat atau melihat catatan internal.|backend"
"B-6 Modul kategori & SLA|CRUD kategori, aturan SLA per prioritas, job pemeriksaan pelanggaran SLA lewat BullMQ.|backend"
"B-7 Notifikasi in-app & email|Notifikasi dalam aplikasi plus antrean email; tanpa SMTP_HOST email dicetak ke log.|backend"
"A-1 Lapisan layanan AI multi-provider|Abstraksi LLM (OpenAI/Claude/Gemini/Ollama) dan embedding (OpenAI), dengan mode mock untuk pengembangan tanpa API key.|ai,backend"
"A-2 AI Triage otomatis|Klasifikasi kategori & prioritas saat tiket dibuat, plus analisis sentimen. Kegagalan AI tidak menggagalkan pembuatan tiket.|ai,backend"
"A-3 RAG Knowledge Base dengan pgvector|Embedding artikel dan pencarian semantik dengan skor kemiripan.|ai,backend"
"A-4 Chatbot virtual agent dengan fallback tiket|POST /chat menjawab dari basis pengetahuan; bila tidak yakin menawarkan pembuatan tiket lengkap dengan prefill.|ai,backend"
"A-5 Draf balasan AI untuk agen|AI menyusun draf, agen menyunting dan menyetujui. Draf tidak pernah terkirim tanpa persetujuan.|ai,backend"
"A-6 Auto-routing tiket|Penugasan otomatis berdasarkan kategori dan beban kerja agen.|ai,backend"
"F-1 Setup Next.js & design system|Next.js 15, Tailwind v4, token warna, layout auth dan layout aplikasi dengan sidebar per peran serta drawer mobile.|frontend"
"F-2 Portal pengguna|Tiket saya, buat tiket, detail tiket (percakapan, lampiran, ringkasan SLA), asisten AI, dan survei kepuasan.|frontend"
"F-3 Dashboard agen|Inbox dengan pencarian/filter/urut/paginasi, balasan publik & catatan internal, ubah status, penugasan manual & otomatis, panel draf AI.|frontend"
"F-4 Antarmuka basis pengetahuan|Pencarian semantik, daftar & detail artikel, CRUD artikel + rebuild embedding untuk admin.|frontend"
"F-5 Dashboard admin|Metrik MTTR/kepatuhan SLA/CSAT/tren, beban per kategori, tiket berisiko SLA, unduh 4 laporan CSV, target SLA, kategori, dan manajemen pengguna.|frontend"
"M4-1 Dokumentasi Swagger/OpenAPI|Dokumentasi API di /docs dan JSON di /docs-json, lengkap dengan contoh query dan skema respons.|docs,backend"
"M4-2 Webhook Slack/Teams/WhatsApp|Service dan worker BullMQ dengan retry backoff; sistem tetap jalan saat webhook belum dikonfigurasi.|backend,integrasi"
"M4-3 Reporting, ekspor CSV, dan CSAT|Ringkasan, tren, per kategori, tiket berisiko SLA, ekspor CSV aman formula injection, dan survei kepuasan pelapor.|backend"
"M4-4 Realtime update lewat WebSocket|Gateway Socket.IO /realtime dengan autentikasi JWT dan klien di frontend.|backend,frontend"
"M4-5 Manajemen pengguna|GET/POST/PATCH /users dan GET /users/agents plus panel admin. passwordHash tidak pernah keluar dari API; admin terakhir tidak bisa diturunkan.|backend,frontend,security"
"M4-6 Uji E2E alur nyata|Skrip E2E lewat HTTP yang menguji auth, tiket, AI, SLA, CSAT, ekspor, dan manajemen pengguna.|testing"
"M4-7 Penugasan tiket dari antarmuka|Dropdown agen di detail tiket yang menampilkan beban kerja masing-masing agen.|frontend,backend"
)

CREATED=0
SKIPPED=0

echo "Menuju repositori: $(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo 'tidak diketahui')"
if [[ "$DRY_RUN" == true ]]; then
  echo "Mode DRY-RUN — tidak ada yang dibuat di GitHub."
fi
echo

for entry in "${ISSUES[@]}"; do
  TITLE="${entry%%|*}"
  REST="${entry#*|}"
  BODY="${REST%%|*}"
  LABELS="${REST##*|}"

  if [[ -n "$EXTRA_LABEL" ]]; then
    LABELS="${LABELS},${EXTRA_LABEL}"
  fi

  if gh issue list --search "$TITLE in:title" --state all --limit 1 --json title -q '.[].title' 2>/dev/null | grep -qxF "$TITLE"; then
    echo "  lewati   $TITLE (sudah ada)"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  if [[ "$DRY_RUN" == true ]]; then
    echo "  akan buat $TITLE  [${LABELS}]"
    CREATED=$((CREATED + 1))
    continue
  fi

  # Label yang belum ada di repositori akan menggagalkan pembuatan issue,
  # jadi label tidak dikenal dibuat lebih dulu.
  IFS=',' read -ra LABEL_ARRAY <<< "$LABELS"
  LABEL_FLAGS=()
  for label in "${LABEL_ARRAY[@]}"; do
    [[ -z "$label" ]] && continue
    if ! gh label list --limit 200 --json name -q '.[].name' 2>/dev/null | grep -qxF "$label"; then
      gh label create "$label" --color "BFD4F2" --description "Dibuat otomatis" >/dev/null 2>&1 || true
    fi
    LABEL_FLAGS+=("--label" "$label")
  done

  if gh issue create --title "$TITLE" --body "$BODY" "${LABEL_FLAGS[@]}" >/dev/null 2>&1; then
    echo "  dibuat   $TITLE"
    CREATED=$((CREATED + 1))
  else
    echo "  GAGAL    $TITLE" >&2
  fi
done

echo
echo "Selesai: ${CREATED} dibuat, ${SKIPPED} dilewati."
