import { api } from '@/lib/api';
import type { Category } from '@/lib/types';

/** Service kategori — CategoriesController (backend/src/categories). */

export type CreateCategoryInput = {
  name: string;
  description?: string;
  slug?: string;
};

export type UpdateCategoryInput = {
  name?: string;
  description?: string;
  slug?: string;
};

/** GET /categories — tersedia untuk semua user yang login */
export function listCategories() {
  return api.get<Category[]>('/categories');
}

/** POST /categories — ADMIN */
export function createCategory(input: CreateCategoryInput) {
  const body: Record<string, string> = { name: input.name };
  if (input.description?.trim()) body.description = input.description.trim();
  if (input.slug?.trim()) body.slug = input.slug.trim();
  return api.post<Category>('/categories', body);
}

/** PATCH /categories/:id — ADMIN */
export function updateCategory(id: string, input: UpdateCategoryInput) {
  const body: Record<string, string> = {};
  if (input.name !== undefined) body.name = input.name;
  if (input.description !== undefined) body.description = input.description;
  if (input.slug !== undefined) body.slug = input.slug;
  return api.patch<Category>(`/categories/${id}`, body);
}

/** DELETE /categories/:id — ADMIN (backend menolak jika kategori masih dipakai tiket) */
export function deleteCategory(id: string) {
  return api.delete<{ deleted: boolean }>(`/categories/${id}`);
}
