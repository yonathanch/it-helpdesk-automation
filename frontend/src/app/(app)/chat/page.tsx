import { RequireAuth, RequireRole } from '@/components/auth/require-auth';
import { ChatAssistant } from '@/components/chat/chat-assistant';

/** Virtual assistant (A-4 / F-3). */
export default function ChatPage() {
  return (
    <RequireAuth>
      <RequireRole roles={['END_USER', 'AGENT', 'ADMIN']}>
        <ChatAssistant />
      </RequireRole>
    </RequireAuth>
  );
}