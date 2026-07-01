import type { ChatTurn } from '@/shared/types/project';

const KEEP_RECENT = 12;
const SUMMARY_MAX_CHARS = 800;

// The whole thread is re-sent to the model each follow-up. To keep long threads fast and
// cheap without an extra API round-trip, keep the last KEEP_RECENT turns verbatim and fold
// everything older into one synthetic rolling-summary turn. Pure string work.
export function trimTurnsForContext(turns: ChatTurn[]): ChatTurn[] {
  if (turns.length <= KEEP_RECENT) return turns;

  const older = turns.slice(0, turns.length - KEEP_RECENT);
  const recent = turns.slice(turns.length - KEEP_RECENT);

  let summary = older
    .filter((t) => t.role === 'user')
    .map((t) => t.content.trim())
    .filter(Boolean)
    .join(' · ');
  if (summary.length > SUMMARY_MAX_CHARS) summary = `${summary.slice(0, SUMMARY_MAX_CHARS)}…`;

  const rollup: ChatTurn = {
    role: 'assistant',
    content: `Earlier in this conversation, you and Spruce discussed: ${summary}`,
    createdAt: older[0]?.createdAt ?? Date.now(),
  };
  return [rollup, ...recent];
}
