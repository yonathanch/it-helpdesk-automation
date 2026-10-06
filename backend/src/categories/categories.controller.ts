import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryDto } from '../common/dto/api.dto';

@ApiTags('Categories')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({
  description: 'Token tidak ditemukan atau tidak valid',
})
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @ApiOperation({
    summary: 'Daftar kategori',
    description:
      'Tersedia untuk semua pengguna yang login (dipakai form pembuatan tiket).',
  })
  @ApiOkResponse({ type: [CategoryDto] })
  findAll() {
    return this.categories.findAll();
  }

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Buat kategori baru',
    description:
      'Slug dibuat otomatis dari nama bila tidak diberikan. Nama dan slug harus unik.',
  })
  @ApiCreatedResponse({ type: CategoryDto })
  @ApiForbiddenResponse({ description: 'Hanya ADMIN' })
  @ApiConflictResponse({ description: 'Nama atau slug kategori sudah dipakai' })
  create(@Body() dto: CreateCategoryDto) {
    return this.categories.create(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Ubah kategori' })
  @ApiOkResponse({ type: CategoryDto })
  @ApiForbiddenResponse({ description: 'Hanya ADMIN' })
  @ApiConflictResponse({
    description: 'Nama atau slug bentrok dengan kategori lain',
  })
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categories.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Hapus kategori',
    description:
      'Kategori yang masih memiliki tiket atau artikel tidak bisa dihapus.',
  })
  @ApiOkResponse({
    description: 'Kategori dihapus',
    schema: { type: 'object', properties: { deleted: { type: 'boolean' } } },
  })
  @ApiForbiddenResponse({ description: 'Hanya ADMIN' })
  @ApiBadRequestResponse({
    description: 'Kategori masih digunakan oleh tiket atau artikel',
  })
  remove(@Param('id') id: string) {
    return this.categories.remove(id);
  }
}
