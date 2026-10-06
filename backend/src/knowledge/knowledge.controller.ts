import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { KnowledgeService } from './knowledge.service';
import {
  KnowledgeArticleDetailDto,
  KnowledgeArticleDto,
  KnowledgeSearchHitDto,
} from '../common/dto/api.dto';

@ApiTags('Knowledge')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({
  description: 'Token tidak ditemukan atau tidak valid',
})
@Controller('knowledge')
export class KnowledgeController {
  constructor(private readonly knowledge: KnowledgeService) {}

  /** Semantic search (RAG) — GET /knowledge/search?q=kata sandi lupa */
  @SkipThrottle()
  @Get('search')
  @ApiOperation({
    summary: 'Cari artikel secara semantik (RAG)',
    description:
      'Mengubah pertanyaan menjadi vektor lalu membandingkan dengan vektor artikel memakai pgvector. `similarity` nearer 1 berarti makin mirip. Dipakai juga oleh asisten AI.',
  })
  @ApiQuery({
    name: 'q',
    description: 'Kata kunci/pertanyaan (wajib, minimal 1 karakter)',
    example: 'lupa password',
  })
  @ApiQuery({
    name: 'limit',
    description: 'Jumlah hasil (1–20, default 5)',
    example: 5,
    required: false,
  })
  @ApiOkResponse({ type: [KnowledgeSearchHitDto] })
  @ApiBadRequestResponse({ description: 'Query pencarian kosong' })
  search(@Query('q') q = '', @Query('limit') limit?: string) {
    const parsed = Number.parseInt(limit ?? '5', 10);
    return this.knowledge.search(
      q,
      Number.isNaN(parsed) ? 5 : Math.min(Math.max(parsed, 1), 20),
    );
  }

  @SkipThrottle()
  @Get()
  @ApiOperation({
    summary: 'Daftar artikel',
    description:
      'Secara default hanya artikel `published` yang dikembalikan. `includeDraft=true` menampilkan artikel draf — hanya berlaku untuk AGENT/ADMIN.',
  })
  @ApiQuery({
    name: 'includeDraft',
    description: 'true = ikut tampilkan artikel draf (AGENT/ADMIN)',
    required: false,
  })
  @ApiOkResponse({ type: [KnowledgeArticleDto] })
  findAll(
    @CurrentUser('role') role: Role,
    @Query('includeDraft') includeDraft?: string,
  ) {
    const isAdmin = role === Role.ADMIN || role === Role.AGENT;
    return this.knowledge.findAll(isAdmin && includeDraft === 'true');
  }

  @SkipThrottle()
  @Get(':slug')
  @ApiOperation({
    summary: 'Detail artikel',
    description:
      'Menggunakan **slug** (bukan id). Artikel draf tidak terlihat oleh END_USER.',
  })
  @ApiOkResponse({ type: KnowledgeArticleDetailDto })
  @ApiNotFoundResponse({
    description: 'Artikel tidak ada, atau masih draf dan diakses END_USER',
  })
  findOne(@Param('slug') slug: string, @CurrentUser('role') role: Role) {
    const isAdmin = role === Role.ADMIN || role === Role.AGENT;
    return this.knowledge.findOne(slug, isAdmin);
  }

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Buat artikel baru',
    description:
      'Slug dibuat otomatis bila tidak diisi. Artikel langsung di-embed saat disimpan agar bisa dicari oleh RAG.',
  })
  @ApiCreatedResponse({ type: KnowledgeArticleDetailDto })
  @ApiForbiddenResponse({ description: 'Hanya ADMIN' })
  create(@Body() dto: CreateArticleDto, @CurrentUser('sub') userId: string) {
    return this.knowledge.create(dto, userId);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Ubah artikel',
    description:
      'Menggunakan **id**. Perubahan isi memicu pembuatan ulang embedding.',
  })
  @ApiOkResponse({ type: KnowledgeArticleDetailDto })
  @ApiForbiddenResponse({ description: 'Hanya ADMIN' })
  @ApiNotFoundResponse({ description: 'Artikel tidak ditemukan' })
  update(@Param('id') id: string, @Body() dto: UpdateArticleDto) {
    return this.knowledge.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Hapus artikel',
    description: 'Menggunakan **id**.',
  })
  @ApiOkResponse({
    description: 'Artikel dihapus',
    schema: { type: 'object', properties: { deleted: { type: 'boolean' } } },
  })
  @ApiForbiddenResponse({ description: 'Hanya ADMIN' })
  @ApiNotFoundResponse({ description: 'Artikel tidak ditemukan' })
  remove(@Param('id') id: string) {
    return this.knowledge.remove(id);
  }

  /** Re-embed seluruh artikel published (mis. setelah ganti embedding provider) */
  @Post('embed-all')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Buat ulang embedding semua artikel published',
    description:
      'Berguna setelah mengganti `EMBEDDING_PROVIDER`, supaya seluruh vektor konsisten dengan provider yang aktif.',
  })
  @ApiOkResponse({
    description: 'Jumlah artikel yang berhasil di-embed',
    schema: {
      type: 'object',
      properties: { updated: { type: 'number', example: 3 } },
    },
  })
  @ApiForbiddenResponse({ description: 'Hanya ADMIN' })
  embedAll() {
    return this.knowledge.embedAll();
  }
}
