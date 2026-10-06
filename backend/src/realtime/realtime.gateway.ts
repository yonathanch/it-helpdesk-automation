import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import type { Server, Socket } from 'socket.io';
import type { AccessTokenPayload } from '../auth/auth.service';

/**
 * Realtime update via Socket.IO.
 *
 * Ruang (_room) yang dipakai:
 * - `ticket:<id>` — room khusus satu tiket, untuk percakapan & perubahan status
 * - `agents`       — semua AGENT/ADMIN, untuk tiket baru & perubahan antrean
 * - `user:<id>`    — notifikasi pribadi
 *
 * Autentikasi: token JWT dikirim lewat handshake `auth.token` (sama dengan
 * accessToken dari /auth/login). Koneksi tanpa token valid akan ditolak.
 */
@WebSocketGateway({
  cors: { origin: true, credentials: true },
  namespace: '/realtime',
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  private server?: Server;

  /** socket.id -> user */
  private readonly users = new Map<string, AccessTokenPayload>();

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.jwtSecret = config.getOrThrow<string>('JWT_SECRET');
  }

  private readonly jwtSecret: string;

  handleConnection(client: Socket) {
    // `handshake.auth` bertipe any pada Socket.IO — amankan lewat unknown
    // supaya tidak ada nilai any yang merembet ke logika berikutnya.
    const handshakeAuth = client.handshake.auth as unknown;
    const authToken =
      typeof handshakeAuth === 'object' && handshakeAuth !== null
        ? (handshakeAuth as { token?: unknown }).token
        : undefined;
    const header = client.handshake.headers.authorization;
    const token =
      typeof authToken === 'string'
        ? authToken
        : typeof header === 'string'
          ? header.replace('Bearer ', '')
          : undefined;

    if (!token) {
      client.emit('unauthorized', { message: 'Token tidak ditemukan' });
      client.disconnect();
      return;
    }

    try {
      const payload = this.jwt.verify<AccessTokenPayload>(token, {
        secret: this.jwtSecret,
      });
      this.users.set(client.id, payload);

      // Agen/admin ikut room global untuk pembaruan antrean.
      if (payload.role === Role.AGENT || payload.role === Role.ADMIN) {
        void client.join('agents');
      }
      void client.join(`user:${payload.sub}`);

      client.emit('connected', { userId: payload.sub, role: payload.role });
    } catch {
      client.emit('unauthorized', {
        message: 'Token tidak valid atau kedaluwarsa',
      });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.users.delete(client.id);
  }

  /**
   * Klien mengirim: `{ "event": "subscribe", "data": { "ticketId": "..." } }`
   *
   * CATATAN KEAMANAN: room ini hanya untuk kontrol tampilan, bukan otorisasi.
   * Backend tetap memvalidasi hak akses saat membaca detail tiket, jadi
   * berlangganan tidak membuat seseorang bisa melihat tiket yang bukan miliknya.
   */
  @SubscribeMessage('subscribe')
  subscribe(
    @MessageBody() body: { ticketId?: string },
    // WAJIB memakai @ConnectedSocket(). Tanpa dekorator ini Nest tidak
    // menyuntikkan socket sebagai argumen terakhir, sehingga `client`
    // bernilai undefined dan pemanggilan join() melempar TypeError.
    @ConnectedSocket() client: Socket,
  ) {
    const ticketId = body?.ticketId;
    if (!ticketId || typeof ticketId !== 'string') return { ok: false };

    void client.join(`ticket:${ticketId}`);
    return { ok: true, ticketId };
  }

  /** Berhenti berlangganan (dipakai saat pindah halaman di UI). */
  @SubscribeMessage('unsubscribe')
  unsubscribe(
    @MessageBody() body: { ticketId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const ticketId = body?.ticketId;
    if (!ticketId || typeof ticketId !== 'string') return { ok: false };

    void client.leave(`ticket:${ticketId}`);
    return { ok: true, ticketId };
  }

  // ---------------- emit helpers ----------------

  /** Kirim event ke semua watcher satu tiket. */
  emitToTicket(ticketId: string, event: string, payload: unknown) {
    this.server?.to(`ticket:${ticketId}`).emit(event, payload);
  }

  /** Kirim event ke semua agen & admin. */
  emitToAgents(event: string, payload: unknown) {
    this.server?.to('agents').emit(event, payload);
  }

  /** Kirim event ke satu pengguna (notifikasi pribadi). */
  emitToUser(userId: string, event: string, payload: unknown) {
    this.server?.to(`user:${userId}`).emit(event, payload);
  }
}
