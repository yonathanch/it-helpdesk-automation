import { api } from '@/lib/api';
import type {
  KnowledgeArticle,
  KnowledgeArticleDetail,
  KnowledgeSearchHit,
} from '@/lib/types';

/** Service knowledge base — KnowledgeController (backend/src/knowledge). */

export type ArticleInput = {
  title: string;
  content: string;
  slug?: string;
  categoryId?: string;
  published?: boolean;
};

/** GET /knowledge — Published saja, kecuali includeDraft=true (AGENT/ADMIN). */
export function listArticles(includeDraft = false) {
  return api.get<KnowledgeArticle[]>('/knowledge', {
    query: includeDraft ? { includeDraft: 'true' } : undefined,
  });
}

/**
 * GET /knowledge/search?q=&limit= — pencarian semantik (pgvector).
 * Backend membatasi limit ke 1..20 dan menolak query kosong (400).
 */
export function searchArticles(query: string, limit = 5) {
  return api.get<KnowledgeSearchHit[]>('/knowledge/search', {
    query: { q: query, limit },
  });
}

/** GET /knowledge/:slug — endpoint detail memakai SLUG, bukan id. */
export function getArticle(slug: string) {
  return api.get<KnowledgeArticleDetail>(`/knowledge/${encodeURIComponent(slug)}`);
}

/** POST /knowledge — ADMIN */
export function createArticle(input: ArticleInput) {
  const body: Record<string, string | boolean> = {
    title: input.title,
    content: input.content,
  };
  if (input.slug?.trim()) body.slug = input.slug.trim();
  if (input.categoryId) body.categoryId = input.categoryId;
  if (input.published !== undefined) body.published = input.published;
  return api.post<KnowledgeArticleDetail>('/knowledge', body);
}

/** PATCH /knowledge/:id — ADMIN (pakai id, bukan slug) */
export function updateArticle(id: string, input: Partial<ArticleInput>) {
  const body: Record<string, string | boolean> = {};
  if (input.title !== undefined) body.title = input.title;
  if (input.content !== undefined) body.content = input.content;
  if (input.slug !== undefined) body.slug = input.slug;
  if (input.categoryId !== undefined) body.categoryId = input.categoryId;
  if (input.published !== undefined) body.published = input.published;
  return api.patch<KnowledgeArticleDetail>(`/knowledge/${id}`, body);
}

/** DELETE /knowledge/:id — ADMIN */
export function deleteArticle(id: string) {
  return api.delete<{ deleted: boolean }>(`/knowledge/${id}`);
}

/** POST /knowledge/embed-all — ADMIN, buat ulang vektor semua artikel published. */
export function embedAllArticles() {
  return api.post<{ updated: number }>('/knowledge/embed-all');
}
