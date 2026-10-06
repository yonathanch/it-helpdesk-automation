/**
 * Smoke test WebSocket realtime.
 *
 * Membuktikan: klien yang sudah berlangganan room tiket benar-benar
 * menerima event saat backend mengubah status tiket.
 *
 * Jalankan: node scripts/ws-smoke.mjs
 */
import { io } from 'socket.io-client';

const API = process.env.API_URL ?? 'http://localhost:3000';
const WS = API;

async function login(email) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Password123!' }),
  });
  if (!res.ok) throw new Error(`login ${email} gagal: ${res.status}`);
  return (await res.json()).accessToken;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const agentToken = await login('agent@helpdesk.local');

  // Ambil satu tiket yang masih OPEN.
  const listRes = await fetch(`${API}/tickets?status=OPEN&limit=1&scope=all`, {
    headers: { Authorization: `Bearer ${agentToken}` },
  });
  const list = await listRes.json();
  let ticket = list.data?.[0];

  // Database yang masih kosong (mis. saat CI) belum tentu punya tiket OPEN.
  // Buat sendiri agar smoke test ini bisa dijalankan di mana saja.
  if (!ticket) {
    console.log('Tidak ada tiket OPEN — membuat tiket uji baru…');
    const userToken = await login('user@helpdesk.local');
    const catRes = await fetch(`${API}/categories`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const categories = await catRes.json();
    const createRes = await fetch(`${API}/tickets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        title: `WS smoke ${Date.now()}`,
        description: 'Tiket sementara untuk menguji event realtime WebSocket.',
        categoryId: categories?.[0]?.id,
      }),
    });
    const created = await createRes.json();
    ticket = created;
    if (!ticket?.id) throw new Error('Gagal membuat tiket uji untuk WS smoke');
  }
  console.log(`Tiket uji: ${ticket.code} (${ticket.id})`);

  const received = [];
  let subscribeAcked = false;

  const triggerStatusChange = async () => {
    console.log('Memicu perubahan status via REST…');
    await fetch(`${API}/tickets/${ticket.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${agentToken}`,
      },
      body: JSON.stringify({ status: 'IN_PROGRESS' }),
    });
  };

  const socket = io(`${WS}/realtime`, {
    transports: ['websocket'],
    auth: { token: agentToken },
  });

  const result = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ ok: false, reason: 'timeout' }), 25000);

    socket.on('connect', () => {
      console.log('WebSocket terhubung');
    });

    socket.on('connected', (payload) => {
      console.log('Auth OK, role:', payload.role);
      // Berlangganan room tiket. Ack WAJIB diperiksa: kalau handler-nya
      // salah tanda tangan (mis. socket tanpa @ConnectedSocket), Nest tidak
      // mengirim ack sama sekali dan realtime diam-diam mati.
      socket.emit('subscribe', { ticketId: ticket.id }, (ack) => {
        if (ack?.ok === true) {
          subscribeAcked = true;
          console.log('Subscribe ack:', JSON.stringify(ack));
        } else {
          clearTimeout(timer);
          resolve({ ok: false, reason: `subscribe ack tidak ok: ${JSON.stringify(ack)}` });
          return;
        }
        setTimeout(triggerStatusChange, 800);
      });
    });

    socket.on('ticket_updated', (payload) => {
      console.log('EVENT ticket_updated diterima:', payload?.code, '->', payload?.status);
      received.push('ticket_updated');
      clearTimeout(timer);
      resolve({ ok: true });
    });

    socket.on('unauthorized', (payload) => {
      clearTimeout(timer);
      resolve({ ok: false, reason: `unauthorized: ${payload?.message}` });
    });

    socket.on('connect_error', (err) => {
      clearTimeout(timer);
      resolve({ ok: false, reason: `connect_error: ${err.message}` });
    });
  });

  socket.close();

  if (result.ok && received.length > 0 && subscribeAcked) {
    console.log('\n✅ REALTIME BERHASIL: subscribe ack diterima & event sampai');
    process.exit(0);
  }
  if (!subscribeAcked && result.ok) {
    console.log('\n❌ REALTIME GAGAL: subscribe tidak pernah mendapat ack');
    process.exit(1);
  }
  console.log(`\n❌ REALTIME GAGAL: ${result.reason}`);
  process.exit(1);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});