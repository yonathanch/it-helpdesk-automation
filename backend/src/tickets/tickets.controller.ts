import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { memoryStorage } from 'multer';
import type { AuthUser } from './tickets.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { ApproveDraftDto } from './dto/approve-draft.dto';
import { AssignTicketDto } from './dto/assign-ticket.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { ListTicketsQueryDto } from './dto/list-tickets.query.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { DraftService } from './draft.service';
import { TicketsService } from './tickets.service';
import {
  AiDraftDto,
  AttachmentDto,
  TicketDetailDto,
  TicketDto,
  TicketListDto,
  TicketMessageDto,
} from '../common/dto/api.dto';

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10 MB

@ApiTags('Tickets')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({
  description: 'Token tidak ditemukan, tidak valid, atau kedaluwarsa',
})
@Controller('tickets')
export class TicketsController {
  constructor(
    private readonly ticketsService: TicketsService,
    private readonly draftService: DraftService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Buat tiket baru',
    description:
      'Setelah dibuat, tiket masuk antrean triage AI (klasifikasi kategori, prioritas, sentimen). Kategori dan SLA ditentukan backend.',
  })
  @ApiCreatedResponse({ description: 'Tiket dibuat', type: TicketDto })
  create(@Body() dto: CreateTicketDto, @CurrentUser() user: AuthUser) {
    return this.ticketsService.create(dto, user);
  }

  @SkipThrottle()
  @Get()
  @ApiOperation({
    summary: 'Daftar tiket (dengan filter, pencarian, pengurutan, paginasi)',
    description:
      'END_USER otomatis hanya melihat tiketnya sendiri. AGENT/ADMIN dapat memakai `scope` untuk memfilter antrean.',
  })
  @ApiOkResponse({ type: TicketListDto })
  findAll(@Query() query: ListTicketsQueryDto, @CurrentUser() user: AuthUser) {
    return this.ticketsService.findAll(query, user);
  }

  @SkipThrottle()
  @Get(':id')
  @ApiOperation({
    summary: 'Detail tiket beserta percakapan dan lampiran',
    description:
      'Catatan internal (`isInternal`) tidak disertakan untuk peran END_USER.',
  })
  @ApiParam({ name: 'id', description: 'ID tiket (bukan kode HD-xxxx)' })
  @ApiOkResponse({ type: TicketDetailDto })
  @ApiNotFoundResponse({
    description: 'Tiket tidak ditemukan, atau bukan milik pengguna yang login',
  })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.ticketsService.findOne(id, user);
  }

  @Patch(':id/status')
  @Roles(Role.AGENT, Role.ADMIN)
  @ApiOperation({
    summary: 'Ubah status tiket',
    description:
      'Hanya transisi status yang diizinkan yang diterima, misalnya `OPEN → IN_PROGRESS → RESOLVED → CLOSED`. Transisi tidak valid dijawab `400`.',
  })
  @ApiOkResponse({ type: TicketDto })
  @ApiForbiddenResponse({ description: 'Hanya AGENT/ADMIN' })
  @ApiBadRequestResponse({ description: 'Transisi status tidak diizinkan' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ticketsService.updateStatus(id, dto, user);
  }

  @Patch(':id/assign')
  @Roles(Role.AGENT, Role.ADMIN)
  @ApiOperation({ summary: 'Tugaskan tiket ke agen' })
  @ApiOkResponse({ type: TicketDto })
  @ApiForbiddenResponse({ description: 'Hanya AGENT/ADMIN' })
  assign(
    @Param('id') id: string,
    @Body() dto: AssignTicketDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ticketsService.assign(id, dto.assigneeId, user);
  }

  // ============ Percakapan ============

  @Post(':id/messages')
  @ApiOperation({
    summary: 'Kirim pesan pada tiket',
    description:
      'END_USER hanya dapat mengirim pesan publik. `isInternal: true** menghasilkan catatan internal yang tidak terlihat oleh pengguna.',
  })
  @ApiCreatedResponse({
    description:
      'Pesan tersimpan; respons berisi objek TicketMessage yang baru dibuat',
    type: TicketMessageDto,
  })
  @ApiForbiddenResponse({
    description: 'END_USER mencoba mengirim catatan internal',
  })
  addMessage(
    @Param('id') id: string,
    @Body() dto: CreateMessageDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ticketsService.addMessage(id, dto, user);
  }

  // ============ Lampiran ============

  @Post(':id/attachments')
  @ApiOperation({
    summary: 'Unggah lampiran (maks. 10 MB)',
    description: 'File dikirim sebagai multipart field bernama `file`.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Lampiran tersimpan; respons berisi objek Attachment',
    type: AttachmentDto,
  })
  @ApiBadRequestResponse({
    description: 'Field `file` kosong atau melebihi batas ukuran',
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_ATTACHMENT_SIZE },
    }),
  )
  async addAttachment(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) {
      throw new BadRequestException('File wajib di-upload (field "file")');
    }
    return this.ticketsService.addAttachment(id, file, user);
  }

  @SkipThrottle()
  @Get(':id/attachments')
  @ApiOperation({ summary: 'Daftar lampiran pada tiket' })
  @ApiOkResponse({ type: [AttachmentDto] })
  listAttachments(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.ticketsService.listAttachments(id, user);
  }

  // ============ A-6: Auto-routing ============

  @Post(':id/auto-assign')
  @Roles(Role.AGENT, Role.ADMIN)
  @ApiOperation({
    summary: 'Tugaskan tiket otomatis (A-6)',
    description:
      'Memilih agen dengan skor terbaik: beban kerja aktif dikurangi pengalaman pada kategori tiket. Berguna untuk re-route tiket yang sudah terklasifikasi.',
  })
  @ApiOkResponse({ type: TicketDto })
  @ApiForbiddenResponse({ description: 'Hanya AGENT/ADMIN' })
  autoAssign(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.ticketsService.autoAssign(id, user);
  }

  // ============ A-5: Draft reply AI ============

  @Post(':id/ai-draft')
  @Roles(Role.AGENT, Role.ADMIN)
  @ApiOperation({
    summary: 'Buat draf balasan AI (A-5)',
    description:
      'AI menyusun draf balasan dari isi tiket, percakapan, dan artikel terkait. Hasil disimpan di tiket (`aiDraft`) dan **belum dikirim** ke pengguna.',
  })
  @ApiOkResponse({ type: AiDraftDto })
  @ApiForbiddenResponse({ description: 'Hanya AGENT/ADMIN' })
  @ApiBadRequestResponse({
    description: 'Tiket sudah ditutup, atau AI tidak menghasilkan draft',
  })
  generateDraft(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.draftService.generate(id, user);
  }

  @Post(':id/ai-draft/approve')
  @Roles(Role.AGENT, Role.ADMIN)
  @ApiOperation({
    summary: 'Setujui dan kirim draf (A-5)',
    description:
      'Kirim draf tersimpan apa adanya, atau kirim `content` hasil edit agen. Pesan hasil approve ditandai `isAiGenerated: true` dan draf dikosongkan.',
  })
  @ApiCreatedResponse({
    description: 'Balasan terkirim',
    type: TicketMessageDto,
  })
  @ApiForbiddenResponse({ description: 'Hanya AGENT/ADMIN' })
  @ApiBadRequestResponse({
    description:
      'Tiket ditutup, atau tidak ada draf maupun `content` yang dikirim',
  })
  approveDraft(
    @Param('id') id: string,
    @Body() dto: ApproveDraftDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.draftService.approve(id, dto.content, user);
  }

  @Delete(':id/ai-draft')
  @Roles(Role.AGENT, Role.ADMIN)
  @ApiOperation({
    summary: 'Buang draf tanpa mengirim',
    description: 'Menghapus draf yang tersimpan pada tiket.',
  })
  @ApiOkResponse({
    description: 'Draf dibuang',
    schema: { type: 'object', properties: { discarded: { type: 'boolean' } } },
  })
  @ApiForbiddenResponse({ description: 'Hanya AGENT/ADMIN' })
  discardDraft(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.draftService.discard(id, user);
  }
}
