'use client';

import * as React from 'react';
import { Pencil, Plus, RefreshCcw, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { FormAlert } from '@/components/ui/form-alert';
import { EmptyState } from '@/components/ui/states';
import { toUserMessage } from '@/lib/api-error';
import * as knowledgeService from '@/lib/services/knowledge.service';
import * as categoriesService from '@/lib/services/categories.service';
import type { Category, KnowledgeArticle } from '@/lib/types';

/**
 * Panel administration artikel (hanya ADMIN).
 *
 * Disisipkan di halaman basis pengetahuan supaya administrator menambah
 * artikel tepat di tempat ia dicari, bukan lewat menu terpisah.
 */
export function KnowledgeArticleManager({
  articles,
  onChanged,
}: {
  articles: KnowledgeArticle[];
  onChanged: () => Promise<void> | void;
}) {
  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [categories, setCategories] = React.useState<Category[]>([]);

  const [title, setTitle] = React.useState('');
  const [content, setContent] = React.useState('');
  const [categoryId, setCategoryId] = React.useState('');
  const [published, setPublished] = React.useState(true);

  const [saving, setSaving] = React.useState(false);
  const [embedding, setEmbedding] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<KnowledgeArticle | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => {
    categoriesService
      .listCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setContent('');
    setCategoryId('');
    setPublished(true);
    setError(null);
  };

  const startCreate = () => {
    resetForm();
    setOpen(true);
  };

  const startEdit = async (article: KnowledgeArticle) => {
    setError(null);
    setEditingId(article.id);
    try {
      const detail = await knowledgeService.getArticle(article.slug);
      setTitle(detail.title);
      setContent(detail.content);
      setCategoryId(detail.categoryId ?? '');
      setPublished(detail.published);
      setOpen(true);
    } catch (err) {
      setEditingId(null);
      setError(toUserMessage(err));
    }
  };

  const save = async () => {
    if (title.trim().length < 3) {
      setError('Judul minimal 3 karakter.');
      return;
    }
    if (content.trim().length < 10) {
      setError('Isi artikel minimal 10 karakter.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await knowledgeService.updateArticle(editingId, {
          title: title.trim(),
          content: content.trim(),
          categoryId: categoryId || undefined,
          published,
        });
        setNotice('Artikel diperbarui dan embedding dibuat ulang.');
      } else {
        await knowledgeService.createArticle({
          title: title.trim(),
          content: content.trim(),
          categoryId: categoryId || undefined,
          published,
        });
        setNotice('Artikel disimpan dan langsung bisa dicari asisten AI.');
      }
      setOpen(false);
      resetForm();
      await onChanged();
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await knowledgeService.deleteArticle(deleteTarget.id);
      setNotice(`Artikel "${deleteTarget.title}" dihapus.`);
      setDeleteTarget(null);
      await onChanged();
    } catch (err) {
      setError(toUserMessage(err));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const embedAll = async () => {
    setEmbedding(true);
    setError(null);
    try {
      const result = await knowledgeService.embedAllArticles();
      setNotice(`${result.updated} artikel berhasil dibuat ulang embedding-nya.`);
      await onChanged();
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setEmbedding(false);
    }
  };

  return (
    <section className="border-t border-border bg-muted/30 px-4 py-4 sm:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">Administrasi artikel</h2>
        <Button size="sm" onClick={startCreate}>
          <Plus aria-hidden />
          Artikel baru
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void embedAll()}
          loading={embedding}
          title="Berguna setelah mengganti provider embedding"
        >
          {!embedding ? <RefreshCcw aria-hidden /> : null}
          Buat ulang embedding
        </Button>
      </div>

      <p role="status" aria-live="polite" className="mt-1 min-h-4 text-xs text-muted-foreground">
        {notice ?? ''}
      </p>

      <FormAlert message={error} />

      {articles.length === 0 ? (
        <EmptyState
          className="py-6"
          title="Belum ada artikel"
          description="Tambahkan panduan pertama agar asisten AI punya bahan jawaban."
        />
      ) : (
        <ul className="mt-1 divide-y divide-border rounded-md border border-border bg-background">
          {articles.map((article) => (
            <li
              key={article.id}
              className="flex flex-wrap items-center gap-2 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground">{article.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {article.category?.name ?? 'Tanpa kategori'}
                  {article.embeddedAt ? '' : ' · belum di-index'}
                </p>
              </div>

              {!article.published ? (
                <Badge variant="outline" className="border-warning/50 text-warning">
                  Draf
                </Badge>
              ) : null}

              <Button
                size="sm"
                variant="outline"
                onClick={() => void startEdit(article)}
                aria-label={`Ubah artikel ${article.title}`}
              >
                <Pencil aria-hidden />
                Ubah
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => setDeleteTarget(article)}
                aria-label={`Hapus artikel ${article.title}`}
              >
                <Trash2 aria-hidden />
                Hapus
              </Button>
            </li>
          ))}
        </ul>
      )}

      {open ? (
        <Card className="mt-3">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">
                {editingId ? 'Ubah artikel' : 'Artikel baru'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  resetForm();
                }}
                aria-label="Tutup formulir"
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="kb-title" required>
                Judul
              </Label>
              <Input
                id="kb-title"
                value={title}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  setTitle(event.target.value)
                }
                placeholder="Contoh: Mengatur ulang kata sandi email kantor"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="kb-category">Kategori</Label>
                <Select
                  id="kb-category"
                  value={categoryId}
                  onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                    setCategoryId(event.target.value)
                  }
                >
                  <option value="">Tanpa kategori</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={published}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                      setPublished(event.target.checked)
                    }
                    className="size-4 rounded border-input"
                  />
                  Terbitkan
                </label>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="kb-content" required>
                Isi artikel
              </Label>
              <Textarea
                id="kb-content"
                rows={8}
                value={content}
                onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setContent(event.target.value)
                }
                placeholder="Tulis langkah demi langkah. Pisahkan paragraf dengan satu baris kosong."
              />
              <p className="text-xs text-muted-foreground">
                Isi artikel dipecah menjadi vektor saat disimpan — itulah yang
                membuat asisten AI bisa menemukannya.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <Button onClick={() => void save()} loading={saving}>
                {editingId ? 'Simpan perubahan' : 'Simpan artikel'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  resetForm();
                }}
                disabled={saving}
              >
                Batal
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Hapus artikel?"
        description={
          <>
            Artikel &ldquo;{deleteTarget?.title}&rdquo; akan dihapus permanen dan
            tidak bisa dipakai lagi oleh asisten AI. Tindakan ini tidak bisa
            dibatalkan.
          </>
        }
        confirmLabel="Hapus"
        variant="destructive"
        loading={deleting}
        onConfirm={() => void confirmDelete()}
        onClose={() => setDeleteTarget(null)}
      />
    </section>
  );
}