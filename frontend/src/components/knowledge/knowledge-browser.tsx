'use client';

import * as React from 'react';
import {
  BookOpen,
  ChevronLeft,
  FileText,
  RefreshCw,
  Sparkles,
  ThumbsUp,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  EmptyState,
  ErrorState,
  NoResultsState,
  SkeletonRows,
} from '@/components/ui/states';
import { toUserMessage } from '@/lib/api-error';
import { useAuth } from '@/components/providers/auth-provider';
import * as knowledgeService from '@/lib/services/knowledge.service';
import { KnowledgeArticleManager } from '@/components/knowledge/knowledge-admin';
import type {
  KnowledgeArticle,
  KnowledgeArticleDetail,
  KnowledgeSearchHit,
} from '@/lib/types';

/**
 * Basis pengetahuan (F-4).
 *
 * Dua mode pencarian:
 * - **Semantik** (default) — memakai embedding + pgvector, jadi "printer
 *   tidak kebaca" tetap menemukan artikel "Menginstal driver printer".
 * - **Judul/kategori** — filter daftar sederhana untuk pengguna biasa.
 */

type View =
  | { mode: 'list' }
  | { mode: 'detail'; slug: string }
  | { mode: 'search' };

export function KnowledgeBrowser() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const canSeeDrafts = user?.role === 'ADMIN' || user?.role === 'AGENT';

  const [view, setView] = React.useState<View>({ mode: 'list' });
  const [query, setQuery] = React.useState('');
  // Admin selalu melihat draf; agen cukup menyalakan bila perlu.
  const [includeDraft, setIncludeDraft] = React.useState(isAdmin);

  const [articles, setArticles] = React.useState<KnowledgeArticle[]>([]);
  const [hits, setHits] = React.useState<KnowledgeSearchHit[]>([]);
  const [detail, setDetail] = React.useState<KnowledgeArticleDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadList = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await knowledgeService.listArticles(includeDraft && canSeeDrafts);
      setArticles(data);
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setLoading(false);
    }
  }, [includeDraft, canSeeDrafts]);

  const loadDetail = React.useCallback(async (slug: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await knowledgeService.getArticle(slug);
      setDetail(data);
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadList();
  }, [loadList]);

  // Pencarian semantik: tunggu pengguna berhenti mengetik dulu.
  React.useEffect(() => {
    const text = query.trim();
    if (!text) {
      setHits([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const result = await knowledgeService.searchArticles(text, 8);
        if (!cancelled) {
          setHits(result);
          setView({ mode: 'search' });
        }
      } catch (err) {
        if (!cancelled) setError(toUserMessage(err));
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const openDetail = (slug: string) => {
    setView({ mode: 'detail', slug });
    void loadDetail(slug);
  };

  const clearSearch = () => {
    setQuery('');
    setHits([]);
    setView({ mode: 'list' });
  };

  return (
    <>
      <PageHeader
        title="Basis Pengetahuan"
        description="Panduan dan solusi masalah yang disusun tim IT. Jawaban asisten AI juga diambil dari sini."
        actions={
          <>
            {canSeeDrafts ? (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={includeDraft}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    setIncludeDraft(event.target.checked)
                  }
                  className="size-3.5 rounded border-input"
                />
                Tampilkan artikel draf
              </label>
            ) : null}
            <Button
              variant="outline"
              size="icon"
              onClick={() =>
                view.mode === 'detail' ? clearSearch() : void loadList()
              }
              disabled={loading}
              aria-label="Muat ulang"
              title="Muat ulang"
            >
              <RefreshCw className={loading ? 'animate-spin' : undefined} aria-hidden />
            </Button>
          </>
        }
      />

      <div className="border-b border-border px-4 py-3 sm:px-6">
        <div className="relative w-full max-w-2xl">
          <Sparkles
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={query}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              setQuery(event.target.value)
            }
            placeholder="Cari solusi — coba: printer tidak terdeteksi"
            aria-label="Cari di basis pengetahuan"
            className="pl-8"
          />
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Pencarian memakai makna kalimat, bukan hanya kata kunci. Contohnya
          &ldquo;tidak bisa masuk&rdquo; akan menemukan &ldquo;reset kata sandi&rdquo;.
        </p>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={() => void loadList()} />
      ) : view.mode === 'detail' ? (
        <div className="mx-auto w-full max-w-3xl p-4 sm:p-6">
          <Button
            variant="ghost"
            size="sm"
            className="mb-3"
            onClick={clearSearch}
          >
            <ChevronLeft aria-hidden />
            Kembali ke daftar
          </Button>

          {loading ? (
            <SkeletonRows rows={6} columns={1} />
          ) : !detail ? (
            <EmptyState
              title="Artikel tidak ditemukan"
              description="Artikel mungkin sudah dihapus atau masih draf."
              icon={<FileText className="size-5" aria-hidden />}
            />
          ) : (
            <article className="space-y-3">
              <header className="space-y-1.5">
                <h2 className="text-base font-semibold text-foreground">
                  {detail.title}
                </h2>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>Oleh {detail.author.name}</span>
                  {detail.category ? (
                    <>
                      <span aria-hidden>&middot;</span>
                      <span>{detail.category.name}</span>
                    </>
                  ) : null}
                  <span aria-hidden>&middot;</span>
                  <time dateTime={detail.updatedAt}>
                    Diperbarui{' '}
                    {new Date(detail.updatedAt).toLocaleDateString('id-ID', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </time>
                  {!detail.published ? (
                    <Badge variant="outline" className="border-warning/50 text-warning">
                      Draf
                    </Badge>
                  ) : null}
                  {!detail.embeddedAt ? (
                    <Badge variant="outline" title="Belum punya vektor sehingga tidak bisa dicari AI">
                      Belum di-index
                    </Badge>
                  ) : null}
                </div>
              </header>

              <Card>
                <CardContent className="p-4">
                  <div className="space-y-3 text-sm leading-relaxed text-foreground">
                    {detail.content.split(/\n{2,}/).map((paragraph, index) => (
                      <p
                        key={index}
                        className={
                          paragraph.startsWith('- ')
                            ? 'pl-4 text-muted-foreground'
                            : undefined
                        }
                      >
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </article>
          )}
        </div>
      ) : (
        <>
          {query.trim() ? (
            <div className="divide-y divide-border">
              {hits.length === 0 ? (
                <NoResultsState query={query} onReset={clearSearch} />
              ) : (
                hits.map((hit) => (
                  <button
                    key={hit.id}
                    type="button"
                    onClick={() => openDetail(hit.slug)}
                    className="block w-full px-4 py-3 text-left transition-colors hover:bg-muted/50 sm:px-6"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-sm font-medium text-foreground">
                        {hit.title}
                      </span>
                      <Badge variant="outline" className="shrink-0">
                        <ThumbsUp className="size-3" aria-hidden />
                        {(hit.similarity * 100).toFixed(0)}% cocok
                      </Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {hit.content}
                    </p>
                  </button>
                ))
              )}
            </div>
          ) : loading ? (
            <SkeletonRows rows={5} columns={2} />
          ) : articles.length === 0 ? (
            <EmptyState
              title="Belum ada artikel"
              description="Artikel yang ditambahkan administrator akan muncul di sini."
              icon={<BookOpen className="size-5" aria-hidden />}
            />
          ) : (
            <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
              {articles.map((article) => (
                <button
                  key={article.id}
                  type="button"
                  onClick={() => openDetail(article.slug)}
                  className="flex h-full flex-col rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-muted/40"
                >
                  <span className="text-sm font-medium text-foreground">
                    {article.title}
                  </span>
                  {article.category ? (
                    <span className="mt-1 text-xs text-muted-foreground">
                      {article.category.name}
                    </span>
                  ) : null}
                  <span className="mt-auto pt-3">
                    {!article.published ? (
                      <Badge variant="outline" className="border-warning/50 text-warning">
                        Draf
                      </Badge>
                    ) : !article.embeddedAt ? (
                      <Badge variant="outline">Belum di-index</Badge>
                    ) : (
                      <Badge variant="outline">Terbit</Badge>
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {isAdmin ? (
        <KnowledgeArticleManager articles={articles} onChanged={loadList} />
      ) : null}
    </>
  );
}