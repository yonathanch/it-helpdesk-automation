-- Ekstensi pgvector (wajib ada sebelum tipe vector dipakai)
CREATE EXTENSION IF NOT EXISTS vector;

-- AlterTable
ALTER TABLE "knowledge_articles" ADD COLUMN     "embedding" vector(1536);
