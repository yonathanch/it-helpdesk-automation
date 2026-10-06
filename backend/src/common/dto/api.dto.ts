import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Skema respons untuk dokumentasi OpenAPI.
 *
 * TIDAK berisi logika — murni dekorator Swagger supaya UI `/docs`
 * menampilkan bentuk data yang benar-benar dikembalikan backend.
 */

/** User yang sedang login / hasil register & login. */
export class UserDto {
  @ApiProperty({ example: 'cmut4ns740001fvkcuxopew7o' })
  id: string;

  @ApiProperty({ example: 'Siti Rahma' })
  name: string;

  @ApiProperty({ example: 'user@helpdesk.local' })
  email: string;

  @ApiProperty({ enum: ['ADMIN', 'AGENT', 'END_USER'], example: 'END_USER' })
  role: 'ADMIN' | 'AGENT' | 'END_USER';

  @ApiPropertyOptional({ nullable: true, example: 'Finance' })
  department: string | null;
}

/** Respons POST /auth/register|login|refresh. */
export class AuthResponseDto {
  @ApiProperty({ type: UserDto })
  user: UserDto;

  @ApiProperty({
    description: 'JWT akses (berlaku 15 menit)',
    example: 'eyJhbGciOiJIUzI1NiIs...',
  })
  accessToken: string;

  @ApiProperty({
    description: 'JWT refresh (berlaku 7 hari)',
    example: 'eyJhbGciOiJIUzI1NiIs...',
  })
  refreshToken: string;
}

/** Kategori tiket / artikel. */
export class CategoryDto {
  @ApiProperty({ example: 'cmut4ns740001fvkcuxopew6yn' })
  id: string;

  @ApiProperty({ example: 'Hardware' })
  name: string;

  @ApiProperty({ example: 'hardware' })
  slug: string;

  @ApiPropertyOptional({ nullable: true, example: 'Masalah perangkat keras' })
  description: string | null;

  @ApiPropertyOptional({
    example: 12,
    description: 'Jumlah tiket pada kategori ini',
  })
  _count?: { tickets: number };
}

/** Aturan SLA per prioritas. */
export class SlaDto {
  @ApiProperty({ example: 'cmut4ns740001fvkcuxopey9q' })
  id: string;

  @ApiProperty({ example: 'SLA HIGH' })
  name: string;

  @ApiProperty({ enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], example: 'HIGH' })
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

  @ApiProperty({ example: 60, description: 'Target first reply (menit)' })
  responseMinutes: number;

  @ApiProperty({ example: 480, description: 'Target penyelesaian (menit)' })
  resolutionMinutes: number;

  @ApiProperty({ example: true })
  isActive: boolean;
}

/** Ringkasan user yang menempel pada tiket (select Prisma TICKET_INCLUDE). */
export class TicketUserRefDto {
  @ApiProperty({ example: 'cmut4ns740001fvkcuxopew7o' })
  id: string;

  @ApiProperty({ example: 'Siti Rahma' })
  name: string;

  @ApiProperty({ example: 'user@helpdesk.local' })
  email: string;
}

/** Kategori versi ringkas (hanya id, name, slug). */
export class TicketCategoryRefDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  slug: string;
}

/** Lampiran pada tiket atau pesan. */
export class AttachmentDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'error-screenshot.png' })
  filename: string;

  @ApiProperty({ example: 'image/png' })
  mimeType: string;

  @ApiProperty({ example: 245760, description: 'Ukuran dalam byte' })
  size: number;

  @ApiProperty()
  createdAt: string;
}

/** Pesan pada percakapan tiket. */
export class TicketMessageDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Printer saya tidak terdeteksi di laptop.' })
  content: string;

  @ApiProperty({
    description: 'true = catatan internal (hanya terlihat AGENT/ADMIN)',
    example: false,
  })
  isInternal: boolean;

  @ApiProperty()
  ticketId: string;

  @ApiProperty()
  authorId: string;

  @ApiProperty({ type: TicketUserRefDto })
  author: TicketUserRefDto;

  @ApiProperty({
    description: 'true bila pesan dikirim dari draft AI (A-5)',
    example: false,
  })
  isAiGenerated: boolean;

  @ApiProperty({ type: [AttachmentDto] })
  attachments: AttachmentDto[];

  @ApiProperty()
  createdAt: string;
}

/** Objek tiket utama. */
export class TicketDto {
  @ApiProperty()
  id: string;

  @ApiProperty({
    example: 'HD-0001',
    description: 'Kode tiket yang tampil ke pengguna',
  })
  code: string;

  @ApiProperty({ example: 'Printer tidak terdeteksi' })
  title: string;

  @ApiProperty({
    example: 'Printer di meja saya tidak muncul di daftar perangkat.',
  })
  description: string;

  @ApiProperty({
    enum: ['OPEN', 'IN_PROGRESS', 'WAITING_USER', 'RESOLVED', 'CLOSED'],
  })
  status: 'OPEN' | 'IN_PROGRESS' | 'WAITING_USER' | 'RESOLVED' | 'CLOSED';

  @ApiProperty({ enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] })
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

  @ApiProperty()
  categoryId: string;

  @ApiProperty({ type: TicketCategoryRefDto })
  category: TicketCategoryRefDto;

  @ApiProperty()
  requesterId: string;

  @ApiProperty({ type: TicketUserRefDto })
  requester: TicketUserRefDto;

  @ApiPropertyOptional({ nullable: true })
  assigneeId: string | null;

  @ApiPropertyOptional({ type: TicketUserRefDto, nullable: true })
  assignee: TicketUserRefDto | null;

  @ApiPropertyOptional({ nullable: true, description: 'Batas waktu SLA' })
  slaDueAt: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Diisi otomatis job bila SLA terlampaui',
  })
  slaBreachedAt: string | null;

  @ApiPropertyOptional({ nullable: true })
  firstReplyAt: string | null;

  @ApiPropertyOptional({ nullable: true })
  resolvedAt: string | null;

  @ApiPropertyOptional({ nullable: true })
  closedAt: string | null;

  @ApiProperty({ description: 'true bila AI sudah menriage tiket ini (A-2)' })
  aiTriaged: boolean;

  @ApiPropertyOptional({
    nullable: true,
    enum: ['POSITIVE', 'NEUTRAL', 'NEGATIVE'],
    description: 'Hasil analisis sentimen AI',
  })
  aiSentiment: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Confidence 0..1 dari AI',
  })
  aiConfidence: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Draf balasan AI yang belum dikirim (A-5)',
  })
  aiDraft: string | null;

  @ApiPropertyOptional({ nullable: true })
  aiDraftAt: string | null;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}

/** Detail tiket: tiket + percakapan + lampiran. */
export class TicketDetailDto extends TicketDto {
  @ApiProperty({
    type: [TicketMessageDto],
    description: 'Catatan internal tidak dikirim ke END_USER',
  })
  messages: TicketMessageDto[];

  @ApiProperty({ type: [AttachmentDto] })
  attachments: AttachmentDto[];
}

/** Metadata paginasi. */
export class PaginationMetaDto {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 42 })
  total: number;

  @ApiProperty({ example: 3 })
  totalPages: number;
}

/** Respons GET /tickets. */
export class TicketListDto {
  @ApiProperty({ type: [TicketDto] })
  data: TicketDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}

/** Artikel knowledge base (ringkas, tanpa isi). */
export class KnowledgeArticleDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Cara Reset Password' })
  title: string;

  @ApiProperty({ example: 'cara-reset-password' })
  slug: string;

  @ApiProperty({
    description: 'Hanya artikel published yang tampil ke END_USER',
  })
  published: boolean;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Terisi bila vektor embedding sudah dibuat',
  })
  embeddedAt: string | null;

  @ApiPropertyOptional({ nullable: true })
  categoryId: string | null;

  @ApiProperty({ type: TicketUserRefDto })
  author: TicketUserRefDto;

  @ApiPropertyOptional({ type: TicketCategoryRefDto, nullable: true })
  category: TicketCategoryRefDto | null;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}

/** Artikel + isi markdown. */
export class KnowledgeArticleDetailDto extends KnowledgeArticleDto {
  @ApiProperty({ example: '# Cara Reset Password\n\n1. Buka ...' })
  content: string;
}

/** Hasil pencarian semantik (RAG). */
export class KnowledgeSearchHitDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Cara Reset Password' })
  title: string;

  @ApiProperty({ example: 'cara-reset-password' })
  slug: string;

  @ApiProperty({ example: '1. Buka portal...' })
  content: string;

  @ApiProperty({
    example: 0.7691,
    description: 'Similarity cosine 0..1 (1 = paling mirip)',
  })
  similarity: number;
}

/** Notifikasi in-app. */
export class NotificationDto {
  @ApiProperty()
  id: string;

  @ApiProperty({
    enum: [
      'TICKET_CREATED',
      'TICKET_ASSIGNED',
      'TICKET_STATUS_CHANGED',
      'SLA_BREACH',
      'GENERAL',
    ],
  })
  type:
    | 'TICKET_CREATED'
    | 'TICKET_ASSIGNED'
    | 'TICKET_STATUS_CHANGED'
    | 'SLA_BREACH'
    | 'GENERAL';

  @ApiProperty({ example: 'Tiket HD-0001 diperbarui' })
  title: string;

  @ApiProperty({ example: 'Status tiket diubah menjadi IN_PROGRESS' })
  body: string;

  @ApiPropertyOptional({ nullable: true, description: 'null = belum dibaca' })
  readAt: string | null;

  @ApiPropertyOptional({ nullable: true })
  ticketId: string | null;

  @ApiPropertyOptional({ type: TicketDto, nullable: true })
  ticket: TicketDto | null;

  @ApiProperty()
  createdAt: string;
}

/** Sumber artikel yang dipakai jawaban asisten AI. */
export class ChatSourceDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  slug: string;

  @ApiProperty({ example: 0.6051 })
  similarity: number;

  @ApiProperty({ example: 'Ikuti langkah reset password berikut...' })
  content: string;
}

/** Data prefill untuk pembuatan tiket dari hasil chat. */
export class ChatPrefillDto {
  @ApiProperty({ example: 'Lupa password' })
  title: string;

  @ApiProperty({
    example: 'Saya lupa password dan tidak bisa masuk ke sistem.',
  })
  description: string;
}

/** Respons POST /chat (A-4). */
export class ChatResultDto {
  @ApiProperty({ example: 'Anda bisa mereset password lewat portal...' })
  answer: string;

  @ApiProperty({
    type: [ChatSourceDto],
    description: 'Artikel yang jadi sumber jawaban',
  })
  sources: ChatSourceDto[];

  @ApiProperty({
    description: 'true bila AI tidak yakin — tawarkan pengguna membuat tiket',
    example: false,
  })
  suggestTicket: boolean;

  @ApiPropertyOptional({ type: ChatPrefillDto, nullable: true })
  prefill: ChatPrefillDto | null;

  @ApiProperty({ example: 'mock', description: 'Provider LLM yang dipakai' })
  provider: string;
}

/** Hasil generate draft AI (A-5). */
export class AiDraftDto {
  @ApiProperty({ example: 'Halo, terima kasih sudah melapor...' })
  draft: string;

  @ApiProperty({
    type: [ChatSourceDto],
    description: 'Artikel yang dirujuk AI',
  })
  sources: ChatSourceDto[];

  @ApiProperty()
  generatedAt: string;
}

/** Data pengguna yang dilihat administrator (tanpa passwordHash). */
export class AdminUserDto {
  @ApiProperty({ example: 'cmut4ns740001fvkcuxopew7o' })
  id: string;

  @ApiProperty({ example: 'Siti Rahma' })
  name: string;

  @ApiProperty({ example: 'user@helpdesk.local' })
  email: string;

  @ApiProperty({ enum: ['ADMIN', 'AGENT', 'END_USER'], example: 'AGENT' })
  role: 'ADMIN' | 'AGENT' | 'END_USER';

  @ApiPropertyOptional({ nullable: true, example: 'IT Support' })
  department: string | null;

  @ApiProperty({
    description: 'false = akun dinonaktifkan dan tidak bisa login',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}

/** Respons GET /users. */ export class UserListDto {
  @ApiProperty({ type: [AdminUserDto] })
  data: AdminUserDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}

/** Pilihan agen untuk dropdown penugasan tiket. */
export class AgentOptionDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Support Agent' })
  name: string;

  @ApiProperty({ example: 'agent@helpdesk.local' })
  email: string;

  @ApiProperty({ enum: ['ADMIN', 'AGENT'], example: 'AGENT' })
  role: 'ADMIN' | 'AGENT';

  @ApiProperty({
    example: 3,
    description: 'Jumlah tiket belum selesai yang sedang ditangani',
  })
  activeTickets: number;
}

/** Format error NestJS. */
export class ErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode: number;

  @ApiProperty({
    example: 'title harus memiliki panjang minimal 3 karakter',
    description:
      'String tunggal, atau array pesan validasi bila beberapa field gagal',
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
  })
  message: string | string[];

  @ApiProperty({ example: 'Bad Request' })
  error: string;
}
