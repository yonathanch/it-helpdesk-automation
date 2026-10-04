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
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { KnowledgeService } from './knowledge.service';

@Controller('knowledge')
export class KnowledgeController {
  constructor(private readonly knowledge: KnowledgeService) {}

  /** Semantic search (RAG) — GET /knowledge/search?q=kata sandi lupa */
  @Get('search')
  search(@Query('q') q = '', @Query('limit') limit?: string) {
    const parsed = Number.parseInt(limit ?? '5', 10);
    return this.knowledge.search(
      q,
      Number.isNaN(parsed) ? 5 : Math.min(Math.max(parsed, 1), 20),
    );
  }

  @Get()
  findAll(
    @CurrentUser('role') role: Role,
    @Query('includeDraft') includeDraft?: string,
  ) {
    const isAdmin = role === Role.ADMIN || role === Role.AGENT;
    return this.knowledge.findAll(isAdmin && includeDraft === 'true');
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string, @CurrentUser('role') role: Role) {
    const isAdmin = role === Role.ADMIN || role === Role.AGENT;
    return this.knowledge.findOne(slug, isAdmin);
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateArticleDto, @CurrentUser('sub') userId: string) {
    return this.knowledge.create(dto, userId);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateArticleDto) {
    return this.knowledge.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.knowledge.remove(id);
  }

  /** Re-embed seluruh artikel published (mis. setelah ganti embedding provider) */
  @Post('embed-all')
  @Roles(Role.ADMIN)
  embedAll() {
    return this.knowledge.embedAll();
  }
}
