#!/usr/bin/env node
/**
 * Smoke test end-to-end (M4-6).
 *
 * Menjalankan alur pengguna NYATA lewat HTTP terhadap backend yang sedang
 * berjalan + PostgreSQL/MinIO sungguhan. Tidak mocking apa pun — kalau
 * script ini hijau, berarti rantai penuh (auth → tiket → AI → SLA → CSAT)
 * benar-benar bekerja.
 *
 * Cara pakai:
 *   node scripts/e2e.mjs                 # backend di http://localhost:3000
 *   API_URL=http://localhost:3001 node scripts/e2e.mjs
 *
 * Keluar dengan kode 0 bila semua pemeriksaan lolos, 1 bila ada yang gagal.
 */

const BASE = (process.env.API_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
const PASSWORD = 'Password123!';

let passed = 0;
const failures = [];

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ok  ${name}`);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

async function api(path, { method = 'GET', token, body, raw = false } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (raw) return response;

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: response.status, data };
}

const unique = Date.now().toString().slice(-6);

async function main() {
  console.log(`E2E help desk → ${BASE}\n`);

  section('1. Health & autentikasi');
  const health = await api('/', { raw: true });
  check('backend merespons', health.status === 200, `status ${health.status}`);

  const badLogin = await api('/auth/login', {
    method: 'POST',
    body: { email: 'user@helpdesk.local', password: 'salah-total' },
  });
  check('login dengan password salah ditolak', badLogin.status === 401);

  const adminLogin = await api('/auth/login', {
    method: 'POST',
    body: { email: 'admin@helpdesk.local', password: PASSWORD },
  });
  check('admin bisa login', adminLogin.status === 200, JSON.stringify(adminLogin.data));
  const adminToken = adminLogin.data?.accessToken;

  const agentLogin = await api('/auth/login', {
    method: 'POST',
    body: { email: 'agent@helpdesk.local', password: PASSWORD },
  });
  const agentToken = agentLogin.data?.accessToken;
  check('agen bisa login', Boolean(agentToken));

  const userLogin = await api('/auth/login', {
    method: 'POST',
    body: { email: 'user@helpdesk.local', password: PASSWORD },
  });
  const userToken = userLogin.data?.accessToken;
  check('pengguna bisa login', Boolean(userToken));

  const noToken = await api('/tickets');
  check('tanpa token ditolak (401)', noToken.status === 401, `status ${noToken.status}`);

  section('2. Registrasi pengguna baru');
  const newEmail = `e2e-${unique}@helpdesk.local`;
  const reg = await api('/auth/register', {
    method: 'POST',
    body: { name: 'Pengguna E2E', email: newEmail, password: PASSWORD, department: 'QA' },
  });
  check('registrasi berhasil', reg.status === 201, JSON.stringify(reg.data));
  const freshToken = reg.data?.accessToken;
  const freshUserId = reg.data?.user?.id;
  check(
    'pendaftaran publik selalu menghasilkan END_USER',
    reg.data?.user?.role === 'END_USER',
    `role=${reg.data?.user?.role}`,
  );

  const dupe = await api('/auth/register', {
    method: 'POST',
    body: { name: 'Ganda', email: newEmail, password: PASSWORD },
  });
  check('email ganda ditolak', dupe.status === 409, `status ${dupe.status}`);

  section('3. Kategori & tiket');
  const categories = await api('/categories', { token: userToken });
  check('daftar kategori bisa dibaca', Array.isArray(categories.data) && categories.data.length > 0);

  const categoryId = categories.data?.[0]?.id;
  check('ada kategori untuk pengujian', Boolean(categoryId));

  const badTicket = await api('/tickets', {
    method: 'POST',
    token: userToken,
    body: { title: 'ab', description: 'pendek', categoryId },
  });
  check('validasi tiket menolak judul/deskripsi terlalu pendek', badTicket.status === 400, `status ${badTicket.status}`);

  const created = await api('/tickets', {
    method: 'POST',
    token: userToken,
    body: {
      title: `E2E printer macet ${unique}`,
      description: 'Printer di lantai 3 tidak bisa dipakai sama sekali sejak pagi.',
      categoryId,
      priority: 'HIGH',
    },
  });
  check('tiket dibuat', created.status === 201, JSON.stringify(created.data));
  const ticket = created.data;
  check('kode tiket berformat HD-XXXX', /^HD-\d{4,}$/.test(ticket?.code ?? ''), ticket?.code);
  check('SLA punya batas waktu (slaDueAt)', Boolean(ticket?.slaDueAt));

  const mine = await api('/tickets', { token: userToken });
  check(
    'tiket muncul di daftar sendiri',
    mine.data?.data?.some((item) => item.id === ticket.id),
  );

  const forbidden = await api(`/tickets/${ticket.id}/status`, {
    method: 'PATCH',
    token: userToken,
    body: { status: 'IN_PROGRESS' },
  });
  check('pengguna tidak bisa ubah status (403)', forbidden.status === 403, `status ${forbidden.status}`);

  section('4. Percakapan & lampiran');
  const reply = await api(`/tickets/${ticket.id}/messages`, {
    method: 'POST',
    token: agentToken,
    body: { content: 'Sudah kami terima, sedang dicek.', isInternal: false },
  });
  check('agen bisa membalas', reply.status === 201, JSON.stringify(reply.data));
  check(
    'pesan selalu punya field attachments',
    reply.data && Array.isArray(reply.data.attachments),
    `attachments=${typeof reply.data?.attachments}`,
  );
  // Bentuk respons ini dikonsumen TicketConversation lewat setTicket(), jadi
  // harus benar-benar satu TicketMessage. Kalau backend diam-diam mengembalikan
  // detail tiket (atau sebaliknya), percakapan di UI akan kosong/rusak.
  check(
    'respons kirim pesan adalah TicketMessage (bukan detail tiket)',
    reply.data?.id === reply.data?.ticketId || (typeof reply.data?.content === 'string' && !('messages' in (reply.data ?? {}))),
    `keys=${Object.keys(reply.data ?? {}).join(',')}`,
  );
  check(
    'respons kirim pesan tidak menyertakan daftar messages',
    !('messages' in (reply.data ?? {})),
    'frontend menambahkan pesan sendiri ke state',
  );

  const internal = await api(`/tickets/${ticket.id}/messages`, {
    method: 'POST',
    token: agentToken,
    body: { content: 'catatan internal: cek driver', isInternal: true },
  });
  check('agen bisa membuat catatan internal', internal.status === 201);

  const userInternal = await api(`/tickets/${ticket.id}/messages`, {
    method: 'POST',
    token: userToken,
    body: { content: 'meniru', isInternal: true },
  });
  check('pengguna tidak bisa membuat catatan internal (403)', userInternal.status === 403);

  const detailAsUser = await api(`/tickets/${ticket.id}`, { token: userToken });
  check(
    'catatan internal tidak terlihat oleh pelapor',
    detailAsUser.data?.messages?.every((message) => message.isInternal === false),
  );
  check(
    'semua pesan memiliki field attachments',
    detailAsUser.data?.messages?.every((message) => Array.isArray(message.attachments)),
  );

  // Bentuk respons upload juga dikonsumsi UI lewat setTicket(), jadi harus
  // benar-benar satu Attachment — kalau tidak, lampiran yang baru diunggah
  // akan membuat state tiket kehilangan daftar percakapan.
  const form = new FormData();
  form.append(
    'file',
    new Blob(['lampiran uji E2E'], { type: 'text/plain' }),
    `e2e-${unique}.txt`,
  );
  const upload = await fetch(`${BASE}/tickets/${ticket.id}/attachments`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${agentToken}` },
    body: form,
  });
  const uploaded = upload.ok ? await upload.json() : null;
  check('lampiran bisa diunggah', upload.status === 201, `status ${upload.status}`);
  check(
    'respons unggah adalah Attachment (bukan detail tiket)',
    Boolean(uploaded?.id) && Boolean(uploaded?.filename) && !('messages' in (uploaded ?? {})),
    `keys=${Object.keys(uploaded ?? {}).join(',')}`,
  );

  const noFile = await api(`/tickets/${ticket.id}/attachments`, {
    method: 'POST',
    token: agentToken,
    body: {},
  });
  check('unggah tanpa berkas ditolak (400)', noFile.status === 400, `status ${noFile.status}`);

  section('5. AI: draf balasan');
  const endUserDraft = await api(`/tickets/${ticket.id}/ai-draft`, {
    method: 'POST',
    token: userToken,
  });
  check('pengguna tidak bisa buat draf AI (403)', endUserDraft.status === 403, `status ${endUserDraft.status}`);

  const draft = await api(`/tickets/${ticket.id}/ai-draft`, {
    method: 'POST',
    token: agentToken,
  });
  check('agen bisa buat draf AI', draft.status === 201, JSON.stringify(draft.data)?.slice(0, 160));
  check('draf berisi teks', Boolean(draft.data?.draft));

  const discard = await api(`/tickets/${ticket.id}/ai-draft`, {
    method: 'DELETE',
    token: agentToken,
  });
  check('draf bisa dibuang', discard.status === 200 && discard.data?.discarded === true);

  const regenerated = await api(`/tickets/${ticket.id}/ai-draft`, {
    method: 'POST',
    token: agentToken,
  });
  const approved = await api(`/tickets/${ticket.id}/ai-draft/approve`, {
    method: 'POST',
    token: agentToken,
    body: { content: 'Kami sudah mengganti driver printer Anda.' },
  });
  check('draf bisa disetujui & dikirim', approved.status === 201, JSON.stringify(approved.data)?.slice(0, 160));
  check('pesan hasil approve ditandai sebagai AI', approved.data?.isAiGenerated === true);

  const afterApprove = await api(`/tickets/${ticket.id}`, { token: agentToken });
  check(
    'draf terkosongkan setelah dikirim',
    afterApprove.data?.aiDraft === null,
    `aiDraft=${afterApprove.data?.aiDraft}`,
  );

  section('6. Status, penugasan, dan SLA');
  const autoAssign = await api(`/tickets/${ticket.id}/auto-assign`, {
    method: 'POST',
    token: agentToken,
  });
  check(
    'auto-routing menugaskan agen',
    autoAssign.status === 201 && Boolean(autoAssign.data?.assigneeId),
    JSON.stringify(autoAssign.data)?.slice(0, 120),
  );

  // Dari OPEN/IN_PROGRESS, RESOLVED tidak termasuk daftar transisi yang
  // diizinkan — server harus menolak, bukan diam-diam menerima.
  const badTransition = await api(`/tickets/${ticket.id}/status`, {
    method: 'PATCH',
    token: agentToken,
    body: { status: 'RESOLVED' },
  });
  check(
    'transisi di luar daftar yang diizinkan ditolak (400)',
    badTransition.status === 400,
    `status ${badTransition.status}`,
  );

  // Tiket kedua khusus untuk menguji CLOSED yang bersifat final.
  const second = await api('/tickets', {
    method: 'POST',
    token: userToken,
    body: {
      title: `E2E tiket kedua ${unique}`,
      description: 'Tiket kedua untuk menguji aturan status final.',
      categoryId,
    },
  });
  const closed = await api(`/tickets/${second.data.id}/status`, {
    method: 'PATCH',
    token: agentToken,
    body: { status: 'CLOSED' },
  });
  check('tiket bisa ditutup', closed.status === 200, `status ${closed.status}`);

  const afterClose = await api(`/tickets/${second.data.id}/status`, {
    method: 'PATCH',
    token: agentToken,
    body: { status: 'IN_PROGRESS' },
  });
  check(
    'CLOSED bersifat final (transisi keluar ditolak)',
    afterClose.status === 400,
    `status ${afterClose.status}`,
  );

  const inProgress = await api(`/tickets/${ticket.id}/status`, {
    method: 'PATCH',
    token: agentToken,
    body: { status: 'IN_PROGRESS' },
  });
  check('tiket bisa diproses', inProgress.status === 200, `status ${inProgress.status}`);

  const resolved = await api(`/tickets/${ticket.id}/status`, {
    method: 'PATCH',
    token: agentToken,
    body: { status: 'RESOLVED' },
  });
  check('tiket bisa diselesaikan', resolved.status === 200, `status ${resolved.status}`);
  check('resolvedAt terisi', Boolean(resolved.data?.resolvedAt));

  section('7. Notifikasi');
  const notifications = await api('/notifications', { token: userToken });
  check(
    'pelapor menerima notifikasi',
    Array.isArray(notifications.data) && notifications.data.length > 0,
  );
  check(
    'ada notifikasi perubahan status',
    notifications.data?.some((item) => item.type === 'TICKET_STATUS_CHANGED'),
  );

  const unreadBefore = await api('/notifications/unread-count', { token: userToken });
  const readAll = await api('/notifications/read-all', {
    method: 'PATCH',
    token: userToken,
  });
  const unreadAfter = await api('/notifications/unread-count', { token: userToken });
  check(
    'tandai semua terbaca menurunkan angka',
    unreadAfter.data?.count === 0,
    `sebelum=${unreadBefore.data?.count} sesudah=${unreadAfter.data?.count}`,
  );
  check('read-all mengembalikan jumlah diperbarui', typeof readAll.data?.updated === 'number');

  section('8. Survei CSAT');
  const otherUserRating = await api(`/surveys/tickets/${ticket.id}`, {
    method: 'POST',
    token: agentToken,
    body: { rating: 1 },
  });
  check('bukan pelapor tidak bisa menilai (403)', otherUserRating.status === 403, `status ${otherUserRating.status}`);

  const openTicketRating = await api(`/surveys/tickets/${ticket.id}`, {
    method: 'POST',
    token: userToken,
    body: { rating: 4 },
  });
  check('pelapor bisa menilai tiket yang sudah selesai', openTicketRating.status === 201, JSON.stringify(openTicketRating.data)?.slice(0, 120));

  const dupeRating = await api(`/surveys/tickets/${ticket.id}`, {
    method: 'POST',
    token: userToken,
    body: { rating: 5 },
  });
  check('tiket hanya bisa dinilai sekali (409)', dupeRating.status === 409, `status ${dupeRating.status}`);

  const badRating = await api(`/surveys/tickets/${ticket.id}`, {
    method: 'POST',
    token: userToken,
    body: { rating: 9 },
  });
  check('rating di luar 1–5 ditolak', [400, 409].includes(badRating.status));

  section('9. AI chat & basis pengetahuan');
  const chat = await api('/chat', {
    method: 'POST',
    token: userToken,
    body: { message: 'Bagaimana cara reset kata sandi email kantor?', history: [] },
  });
  check('chat AI menjawab', chat.status === 201 && Boolean(chat.data?.answer), JSON.stringify(chat.data)?.slice(0, 140));
  check('jawaban chat punya daftar sumber', Array.isArray(chat.data?.sources));
  check('chat melaporkan provider yang dipakai', typeof chat.data?.provider === 'string');

  const articles = await api('/knowledge', { token: userToken });
  check('daftar artikel terbaca', Array.isArray(articles.data) && articles.data.length > 0);

  const search = await api('/knowledge/search?q=reset%20password&limit=3', {
    token: userToken,
  });
  check('pencarian semantik mengembalikan hasil', Array.isArray(search.data));

  const emptySearch = await api('/knowledge/search?q=', { token: userToken });
  check('pencarian kosong ditolak (400)', emptySearch.status === 400, `status ${emptySearch.status}`);

  const userCreateArticle = await api('/knowledge', {
    method: 'POST',
    token: userToken,
    body: { title: 'E2E artikel', content: 'should be forbidden for end user' },
  });
  check('pengguna tidak bisa buat artikel (403)', userCreateArticle.status === 403);

  const article = await api('/knowledge', {
    method: 'POST',
    token: adminToken,
    body: { title: `E2E artikel ${unique}`, content: 'Dokumentasi sementara untuk pengujian otomatis E2E.' },
  });
  check('admin bisa buat artikel', article.status === 201, JSON.stringify(article.data)?.slice(0, 120));

  if (article.status === 201) {
    const updated = await api(`/knowledge/${article.data.id}`, {
      method: 'PATCH',
      token: adminToken,
      body: { published: false },
    });
    check('admin bisa ubah artikel', updated.status === 200 && updated.data?.published === false);

    const removed = await api(`/knowledge/${article.data.id}`, {
      method: 'DELETE',
      token: adminToken,
    });
    check('admin bisa hapus artikel', removed.status === 200 && removed.data?.deleted === true);
  }

  section('10. Laporan & ekspor (khusus ADMIN)');
  const userReporting = await api('/reporting/overview', { token: userToken });
  check('pengguna tidak bisa akses laporan (403)', userReporting.status === 403, `status ${userReporting.status}`);

  const overview = await api('/reporting/overview', { token: adminToken });
  check('admin bisa ambil ringkasan', overview.status === 200);
  check('jumlah tiket di laporan', typeof overview.data?.totals?.all === 'number', `all=${overview.data?.totals?.all}`);

  const today = new Date().toISOString().slice(0, 10);
  const ranged = await api(`/reporting/overview?from=${today}&to=${today}`, {
    token: adminToken,
  });
  check(
    'filter tanggal hari-ini menyertakan tiket yang dibuat hari ini',
    ranged.data?.totals?.all >= 1,
    `all=${ranged.data?.totals?.all} (regresi batas tengah malam?)`,
  );

  const trend = await api('/reporting/trend', { token: adminToken });
  check('tren harian mengembalikan deret waktu', Array.isArray(trend.data) && trend.data.length > 0);

  const byCategory = await api('/reporting/categories', { token: adminToken });
  check('statistik per kategori tersedia', Array.isArray(byCategory.data));

  const slaRisk = await api('/reporting/sla-at-risk', { token: adminToken });
  check('daftar tiket berisiko SLA tersedia', Array.isArray(slaRisk.data));

  const surveys = await api('/surveys?limit=10', { token: adminToken });
  check('admin bisa daftar penilaian CSAT', Array.isArray(surveys.data) && surveys.data.length > 0);
  check('penilaian CSAT memuat nama pelapor', Boolean(surveys.data?.[0]?.user?.name));

  for (const kind of ['tickets', 'overview', 'sla-at-risk', 'csat']) {
    const csv = await api(`/reporting/export/${kind}.csv`, { token: adminToken, raw: true });
    // Response.text() di Node membuang BOM, jadi periksa lewat byte pertama.
    const bytes = new Uint8Array(await csv.arrayBuffer());
    const first = bytes[0];
    const hasBom = first === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
    check(
      `ekspor ${kind}.csv berhasil (200 + BOM UTF-8)`,
      csv.status === 200 && hasBom && bytes.length > 10,
      `status=${csv.status} bom=${hasBom} ukuran=${bytes.length}`,
    );
  }

  section('11. SLA & kategori');
  const slas = await api('/slas', { token: adminToken });
  check('daftar SLA tersedia', Array.isArray(slas.data) && slas.data.length > 0);

  if (slas.data?.[0]) {
    const sla = slas.data[0];
    const updatedSla = await api(`/slas/${sla.id}`, {
      method: 'PATCH',
      token: adminToken,
      body: { responseMinutes: sla.responseMinutes },
    });
    check('admin bisa ubah SLA', updatedSla.status === 200);

    const userSla = await api(`/slas/${sla.id}`, {
      method: 'PATCH',
      token: userToken,
      body: { responseMinutes: 5 },
    });
    check('pengguna tidak bisa ubah SLA (403)', userSla.status === 403);
  }

  const newCategory = await api('/categories', {
    method: 'POST',
    token: adminToken,
    body: { name: `E2E Kategori ${unique}`, description: 'Kategori sementara untuk E2E' },
  });
  check('admin bisa buat kategori', newCategory.status === 201, JSON.stringify(newCategory.data)?.slice(0, 120));

  if (newCategory.status === 201) {
    const removed = await api(`/categories/${newCategory.data.id}`, {
      method: 'DELETE',
      token: adminToken,
    });
    check('kategori kosong bisa dihapus', removed.status === 200 && removed.data?.deleted === true);
  }

  section('12. Manajemen pengguna (ADMIN)');
  const userList = await api('/users', { token: userToken });
  check('pengguna biasa tidak bisa daftar user (403)', userList.status === 403, `status ${userList.status}`);

  const noTokenUsers = await api('/users');
  check('tanpa token ditolak (401)', noTokenUsers.status === 401);

  const adminUsers = await api('/users?limit=5', { token: adminToken });
  check('admin bisa daftar pengguna', adminUsers.status === 200 && Array.isArray(adminUsers.data?.data));
  check(
    'passwordHash TIDAK pernah dikirim ke klien',
    !JSON.stringify(adminUsers.data).includes('passwordHash'),
  );

  const filtered = await api('/users?role=AGENT&isActive=true', { token: adminToken });
  check(
    'filter role & status aktif bekerja',
    Array.isArray(filtered.data?.data) && filtered.data.data.every((u) => u.role === 'AGENT' && u.isActive),
  );

  // --- Buat agen baru: satu-satunya jalur membuat akun AGENT/ADMIN ---
  const newAgentEmail = `e2e-agen-${unique}@helpdesk.local`;
  const createdUser = await api('/users', {
    method: 'POST',
    token: adminToken,
    body: {
      name: 'Agen E2E',
      email: newAgentEmail,
      password: PASSWORD,
      role: 'AGENT',
      department: 'IT Support',
    },
  });
  check('admin bisa membuat akun AGENT', createdUser.status === 201, JSON.stringify(createdUser.data)?.slice(0, 140));
  check('role tersimpan sebagai AGENT', createdUser.data?.role === 'AGENT');
  check(
    'respons pembuatan tidak memuat passwordHash',
    !JSON.stringify(createdUser.data).includes('passwordHash'),
  );

  const agentLogin2 = await api('/auth/login', {
    method: 'POST',
    body: { email: newAgentEmail, password: PASSWORD },
  });
  check('agen baru bisa login & berperan AGENT', agentLogin2.data?.user?.role === 'AGENT');

  const dupeEmail = await api('/users', {
    method: 'POST',
    token: adminToken,
    body: { name: 'Ganda', email: newAgentEmail, password: PASSWORD, role: 'AGENT' },
  });
  check('email duplikat ditolak (409)', dupeEmail.status === 409, `status ${dupeEmail.status}`);

  const weakPassword = await api('/users', {
    method: 'POST',
    token: adminToken,
    body: { name: 'Lemah', email: `lemah-${unique}@x.local`, password: '123', role: 'AGENT' },
  });
  check('password kurang dari 8 karakter ditolak (400)', weakPassword.status === 400, `status ${weakPassword.status}`);

  // --- Agen/admin yang bisa ditugaskan ---
  const agents = await api('/users/agents', { token: agentToken });
  check('agen bisa membaca daftar agen', agents.status === 200 && Array.isArray(agents.data));
  check(
    'daftar agen hanya berisi AGENT/ADMIN aktif',
    agents.data?.every((a) => ['AGENT', 'ADMIN'].includes(a.role)),
  );
  check(
    'setiap agen melaporkan beban kerja',
    agents.data?.every((a) => typeof a.activeTickets === 'number'),
  );

  const endUserAgents = await api('/users/agents', { token: userToken });
  check('pengguna biasa tidak bisa lihat daftar agen (403)', endUserAgents.status === 403);

  // --- Aturan anti-lockout ---
  const adminMe = await api('/auth/me', { token: adminToken });
  const selfDemote = await api(`/users/${adminMe.data.id}`, {
    method: 'PATCH',
    token: adminToken,
    body: { role: 'END_USER' },
  });
  check(
    'admin tidak bisa menurunkan role akunnya sendiri',
    selfDemote.status === 400,
    `status ${selfDemote.status}`,
  );

  const selfDeactivate = await api(`/users/${adminMe.data.id}`, {
    method: 'PATCH',
    token: adminToken,
    body: { isActive: false },
  });
  check(
    'admin tidak bisa menonaktifkan akun sendiri',
    selfDeactivate.status === 400,
    `status ${selfDeactivate.status}`,
  );

  const emptyPatch = await api(`/users/${createdUser.data.id}`, {
    method: 'PATCH',
    token: adminToken,
    body: {},
  });
  check('permintaan tanpa perubahan ditolak (400)', emptyPatch.status === 400, `status ${emptyPatch.status}`);

  // --- Siklus nonaktif → tidak bisa login → aktif lagi ---
  const deactivated = await api(`/users/${createdUser.data.id}`, {
    method: 'PATCH',
    token: adminToken,
    body: { isActive: false },
  });
  check('akun bisa dinonaktifkan', deactivated.data?.isActive === false);

  const blockedLogin = await api('/auth/login', {
    method: 'POST',
    body: { email: newAgentEmail, password: PASSWORD },
  });
  check('akun nonaktif tidak bisa login (401)', blockedLogin.status === 401, `status ${blockedLogin.status}`);

  const reactivated = await api(`/users/${createdUser.data.id}`, {
    method: 'PATCH',
    token: adminToken,
    body: { isActive: true },
  });
  check('akun bisa diaktifkan kembali', reactivated.data?.isActive === true);

  const endUserPatch = await api(`/users/${createdUser.data.id}`, {
    method: 'PATCH',
    token: userToken,
    body: { isActive: false },
  });
  check('pengguna biasa tidak bisa ubah user lain (403)', endUserPatch.status === 403);

  section('13. Penugasan tiket ke agen');
  const assignTarget = agents.data?.find((a) => a.id !== autoAssign.data?.assigneeId);
  const assigned = await api(`/tickets/${ticket.id}/assign`, {
    method: 'PATCH',
    token: agentToken,
    body: { assigneeId: assignTarget?.id },
  });
  check(
    'tiket bisa ditugaskan ke agen pilihan',
    assigned.status === 200 && assigned.data?.assigneeId === assignTarget?.id,
    `status ${assigned.status}`,
  );

  const assignToEndUser = await api(`/tickets/${ticket.id}/assign`, {
    method: 'PATCH',
    token: agentToken,
    body: { assigneeId: freshUserId },
  });
  check(
    'tiket tidak bisa ditugaskan ke END_USER (400)',
    assignToEndUser.status === 400,
    `status ${assignToEndUser.status}`,
  );

  const endUserAssign = await api(`/tickets/${ticket.id}/assign`, {
    method: 'PATCH',
    token: userToken,
    body: { assigneeId: assignTarget?.id },
  });
  check('pengguna biasa tidak bisa assign tiket (403)', endUserAssign.status === 403);

  section('14. Isolation antar pengguna');
  const strangerRead = await api(`/tickets/${ticket.id}`, { token: freshToken });check(
    'pengguna lain tidak bisa membaca tiket orang (404)',
    strangerRead.status === 404,
    `status ${strangerRead.status}`,
  );

  console.log('\n' + '-'.repeat(52));
  if (failures.length === 0) {
    console.log(`SEMUA LOLOS — ${passed} pemeriksaan.`);
    process.exit(0);
  } else {
    console.log(`${passed} lolos, ${failures.length} GAGAL:`);
    for (const failure of failures) console.log(`  - ${failure}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('\nE2E terhenti:', error);
  process.exit(1);
});