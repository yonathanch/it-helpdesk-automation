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

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10 MB

@Controller('tickets')
export class TicketsController {
  constructor(
    private readonly ticketsService: TicketsService,
    private readonly draftService: DraftService,
  ) {}

  @Post()
  create(@Body() dto: CreateTicketDto, @CurrentUser() user: AuthUser) {
    return this.ticketsService.create(dto, user);
  }

  @Get()
  findAll(@Query() query: ListTicketsQueryDto, @CurrentUser() user: AuthUser) {
    return this.ticketsService.findAll(query, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.ticketsService.findOne(id, user);
  }

  @Patch(':id/status')
  @Roles(Role.AGENT, Role.ADMIN)
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ticketsService.updateStatus(id, dto, user);
  }

  @Patch(':id/assign')
  @Roles(Role.AGENT, Role.ADMIN)
  assign(
    @Param('id') id: string,
    @Body() dto: AssignTicketDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ticketsService.assign(id, dto.assigneeId, user);
  }

  // ============ B-5: Percakapan ============

  @Post(':id/messages')
  addMessage(
    @Param('id') id: string,
    @Body() dto: CreateMessageDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ticketsService.addMessage(id, dto, user);
  }

  // ============ B-5: Lampiran ============

  @Post(':id/attachments')
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

  @Get(':id/attachments')
  listAttachments(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.ticketsService.listAttachments(id, user);
  }

  // ============ A-6: Auto-routing ============

  /** Trigger manual auto-routing (re-route berdasarkan kategori & beban kerja) */
  @Post(':id/auto-assign')
  @Roles(Role.AGENT, Role.ADMIN)
  autoAssign(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.ticketsService.autoAssign(id, user);
  }

  // ============ A-5: Draft reply AI ============

  /** Generate draf balasan AI (tersimpan, belum terkirim) */
  @Post(':id/ai-draft')
  @Roles(Role.AGENT, Role.ADMIN)
  generateDraft(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.draftService.generate(id, user);
  }

  /** Approve: kirim draft (atau konten hasil edit agen) sebagai balasan publik */
  @Post(':id/ai-draft/approve')
  @Roles(Role.AGENT, Role.ADMIN)
  approveDraft(
    @Param('id') id: string,
    @Body() dto: ApproveDraftDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.draftService.approve(id, dto.content, user);
  }

  /** Buang draft tanpa mengirim */
  @Delete(':id/ai-draft')
  @Roles(Role.AGENT, Role.ADMIN)
  discardDraft(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.draftService.discard(id, user);
  }
}
