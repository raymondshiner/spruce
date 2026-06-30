import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { Button, Screen, Spinner, Textarea } from '@/components/ui';
import { useChat } from '@/shared/state/chat';
import { useProjects } from '@/shared/state/projects';
import { canAskFollowup, MAX_FOLLOWUP_TURNS, userTurnsUsed } from '@/shared/types/project';

export default function ProjectDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const project = useProjects((s) => s.byId[id]);
  const hydrated = useProjects((s) => s.hydrated);
  const status = useChat((s) => s.statusByProject[id]);
  const send = useChat((s) => s.send);
  const clearError = useChat((s) => s.clearError);
  const [question, setQuestion] = useState('');

  useEffect(() => {
    if (hydrated && !project) navigate('/', { replace: true });
  }, [hydrated, project, navigate]);

  if (!project) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner className="size-7" />
      </div>
    );
  }

  const sending = status?.kind === 'sending';
  const turnsLeft = MAX_FOLLOWUP_TURNS - userTurnsUsed(project);
  const canSend = canAskFollowup(project) && question.trim().length > 0 && !sending;

  const onSend = async () => {
    const q = question.trim();
    if (!q) return;
    setQuestion('');
    await send(id, q);
  };

  return (
    <Screen title="Project" onBack={() => navigate(-1)}>
      <div className="flex flex-1 flex-col">
        <div className="flex flex-col gap-2 p-4 pb-28">
          <img
            src={project.thumbnailUri}
            alt=""
            className="aspect-[4/3] w-full rounded-2xl bg-surface object-cover"
          />
          <h2 className="mt-2 text-lg font-semibold">{project.goal}</h2>

          <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-accent">The vibe</p>
          <p className="leading-relaxed text-ink-muted">{project.plan.vibe}</p>

          <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-accent">
            Key changes
          </p>
          <ul className="flex flex-col gap-1.5">
            {project.plan.keyChanges.map((c, i) => (
              <li key={i} className="flex gap-2 leading-relaxed text-ink-muted">
                <span className="text-accent">•</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>

          <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-accent">
            Items ({project.plan.items.length})
          </p>
          <div className="flex flex-col gap-2">
            {project.plan.items.map((item, i) => (
              <div key={`${item.name}-${i}`} className="rounded-xl bg-surface p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{item.name}</p>
                  <span className="text-[11px] uppercase tracking-wider text-accent">
                    {item.category}
                  </span>
                </div>
                {item.estimatedPriceRange && (
                  <p className="mt-0.5 text-[13px] text-ink-muted">{item.estimatedPriceRange}</p>
                )}
                {item.notes && <p className="mt-1 text-[13px] leading-snug text-ink-subtle">{item.notes}</p>}
              </div>
            ))}
          </div>

          {project.turns.length > 0 && (
            <>
              <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-accent">
                Conversation
              </p>
              <div className="flex flex-col gap-2">
                {project.turns.map((t, i) => (
                  <div
                    key={i}
                    className={t.role === 'user' ? 'rounded-xl bg-surface-2 p-3' : 'rounded-xl bg-surface p-3'}
                  >
                    <p className="mb-1 text-[11px] font-bold text-accent">
                      {t.role === 'user' ? 'You' : 'Spruce'}
                    </p>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{t.content}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          {status?.kind === 'error' && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-danger-surface p-3">
              <p className="text-[13px] text-danger">{status.message ?? status.error}</p>
              <button className="shrink-0 text-[13px] text-accent" onClick={() => clearError(id)}>
                Dismiss
              </button>
            </div>
          )}
        </div>

        <div className="fixed inset-x-0 bottom-0 mx-auto w-full max-w-md border-t border-border/60 bg-bg/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
          {canAskFollowup(project) ? (
            <div className="flex items-end gap-2">
              <Textarea
                rows={1}
                className="max-h-32 flex-1"
                placeholder={`Ask a follow-up (${turnsLeft} left)`}
                value={question}
                disabled={sending}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (canSend) onSend();
                  }
                }}
              />
              <Button className="px-5 py-3" onClick={onSend} disabled={!canSend} busy={sending}>
                Send
              </Button>
            </div>
          ) : (
            <p className="px-2 py-2 text-center text-[13px] leading-snug text-ink-subtle">
              Conversation cap reached. Start a new project from this plan to keep iterating.
            </p>
          )}
        </div>
      </div>
    </Screen>
  );
}
