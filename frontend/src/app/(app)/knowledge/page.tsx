import { RequireAuth } from '@/components/auth/require-auth';
import { KnowledgeBrowser } from '@/components/knowledge/knowledge-browser';

/** Basis pengetahuan — pencarian semantik & artikel (F-4). */
export default function KnowledgePage() {
  return (
    <RequireAuth>
      <KnowledgeBrowser />
    </RequireAuth>
  );
}