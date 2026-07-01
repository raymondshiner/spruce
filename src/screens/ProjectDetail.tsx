import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ulid } from 'ulid';

import CostModal, { VISUALIZE_COST_USD } from '@/components/CostModal';
import { Button, Screen, Spinner, Textarea } from '@/components/ui';
import { cn } from '@/lib/cn';
import { visualizePlan, SpruceApiError } from '@/shared/api/client';
import { putChatImageBlob } from '@/shared/db/projects';
import { dataUrlToBlob, makeThumbnail, preparePhoto } from '@/shared/lib/image';
import { useChat, type ChatAttachment } from '@/shared/state/chat';
import { useProjects } from '@/shared/state/projects';
import { useSession } from '@/shared/state/session';
import { projectTitle, type GeneratedImageKind } from '@/shared/types/project';

export default function ProjectDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const project = useProjects((s) => s.byId[id]);
  const hydrated = useProjects((s) => s.hydrated);
  const status = useChat((s) => s.statusByProject[id]);
  const send = useChat((s) => s.send);
  const clearError = useChat((s) => s.clearError);
  const addGeneratedImage = useProjects((s) => s.addGeneratedImage);
  const session = useSession();

  const [question, setQuestion] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [attachRole, setAttachRole] = useState<'reference' | 'detail'>('detail');
  const photoInput = useRef<HTMLInputElement>(null);

  const [vizKind, setVizKind] = useState<GeneratedImageKind | null>(null);
  const [vizBusy, setVizBusy] = useState(false);
  const [vizError, setVizError] = useState<string | null>(null);

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
  const canSend = (question.trim().length > 0 || attachments.length > 0) && !sending;

  const onPickPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    const added: ChatAttachment[] = [];
    for (const file of Array.from(files)) {
      const prepared = await preparePhoto(file);
      const imgId = ulid();
      await putChatImageBlob(imgId, dataUrlToBlob(prepared.dataUrl));
      added.push({
        ref: {
          id: imgId,
          thumbnailUri: await makeThumbnail(prepared.dataUrl, 320),
          sha256: prepared.sha256,
          createdAt: Date.now(),
          role: attachRole,
        },
        base64: prepared.base64,
      });
    }
    setAttachments((prev) => [...prev, ...added]);
  };

  const onSend = async () => {
    if (!canSend) return;
    const q = question.trim();
    const atts = attachments;
    setQuestion('');
    setAttachments([]);
    await send(id, q, atts.length ? atts : undefined);
  };

  const runVisualize = async () => {
    if (!vizKind) return;
    setVizBusy(true);
    setVizError(null);
    try {
      if (!session.openaiApiKey) {
        throw new SpruceApiError({ error: 'invalid_key', message: 'Add your OpenAI API key in Settings.' });
      }
      const device = await session.ensureDeviceRegistered();
      const photoBase64 =
        vizKind === 'render' ? project.thumbnailUri.slice(project.thumbnailUri.indexOf(',') + 1) : undefined;
      const res = await visualizePlan(device, {
        mode: project.mode,
        kind: vizKind,
        plan: project.plan,
        photoBase64,
        openaiApiKey: session.openaiApiKey,
      });
      await addGeneratedImage(project.id, res.imageBase64, {
        kind: vizKind,
        costEstimateUsd: res.costEstimateUsd || VISUALIZE_COST_USD[vizKind],
      });
      setVizKind(null);
    } catch (e) {
      const err = e instanceof SpruceApiError ? e : null;
      setVizError(err?.message ?? 'Could not generate the image. Try again?');
    } finally {
      setVizBusy(false);
    }
  };

  return (
    <Screen
      title={projectTitle(project)}
      onBack={() => navigate(-1)}
      right={
        <Link to={`/project/${project.id}/edit`} className="text-sm font-medium text-accent">
          Edit
        </Link>
      }
    >
      <div className="flex flex-1 flex-col">
        <div className="flex flex-col gap-2 p-4 pb-44">
          <img
            src={project.thumbnailUri}
            alt=""
            className="aspect-[4/3] w-full rounded-2xl bg-surface object-cover"
          />

          <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-accent">The vibe</p>
          <p className="leading-relaxed text-ink-muted">{project.plan.vibe}</p>

          <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-accent">Key changes</p>
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
                  <span className="text-[11px] uppercase tracking-wider text-accent">{item.category}</span>
                </div>
                {item.estimatedPriceRange && (
                  <p className="mt-0.5 text-[13px] text-ink-muted">{item.estimatedPriceRange}</p>
                )}
                {item.notes && <p className="mt-1 text-[13px] leading-snug text-ink-subtle">{item.notes}</p>}
              </div>
            ))}
          </div>

          {/* Visualize */}
          <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-accent">Visualize</p>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1 text-sm" onClick={() => setVizKind('render')}>
              Photorealistic render
            </Button>
            <Button variant="secondary" className="flex-1 text-sm" onClick={() => setVizKind('layout')}>
              Top-down layout
            </Button>
          </div>
          {vizError && <p className="text-[13px] text-danger">{vizError}</p>}
          {project.generatedImages && project.generatedImages.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {project.generatedImages.map((g) => (
                <figure key={g.id} className="overflow-hidden rounded-xl bg-surface">
                  <img src={g.thumbnailUri} alt={g.kind} className="aspect-square w-full object-cover" />
                  <figcaption className="px-2 py-1 text-[11px] uppercase tracking-wider text-ink-subtle">
                    {g.kind === 'render' ? 'Render' : 'Layout'}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}

          {/* Conversation */}
          {project.turns.length > 0 && (
            <>
              <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-accent">Conversation</p>
              <div className="flex flex-col gap-2">
                {project.turns.map((t, i) => (
                  <div
                    key={i}
                    className={t.role === 'user' ? 'rounded-xl bg-surface-2 p-3' : 'rounded-xl bg-surface p-3'}
                  >
                    <p className="mb-1 text-[11px] font-bold text-accent">
                      {t.role === 'user' ? 'You' : 'Spruce'}
                    </p>
                    {t.content && (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{t.content}</p>
                    )}
                    {t.images && t.images.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {t.images.map((img) => (
                          <img
                            key={img.id}
                            src={img.thumbnailUri}
                            alt={img.role}
                            className="size-20 rounded-lg object-cover"
                          />
                        ))}
                      </div>
                    )}
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

        {/* Composer — always available (no turn cap) */}
        <div className="fixed inset-x-0 bottom-0 mx-auto w-full max-w-md border-t border-border/60 bg-bg/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
          {attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {attachments.map((a) => (
                <div key={a.ref.id} className="relative">
                  <img src={a.ref.thumbnailUri} alt="" className="size-14 rounded-lg object-cover" />
                  <button
                    onClick={() => setAttachments((prev) => prev.filter((x) => x.ref.id !== a.ref.id))}
                    className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-black/70 text-[10px] text-white"
                    aria-label="Remove"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mb-2 flex items-center gap-2 text-[12px]">
            <span className="text-ink-subtle">Photo is a:</span>
            {(['detail', 'reference'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setAttachRole(r)}
                className={cn(
                  'rounded-full px-2.5 py-1 font-medium',
                  attachRole === r ? 'bg-surface-2 text-accent' : 'text-ink-subtle',
                )}
              >
                {r === 'detail' ? 'closer detail' : 'reference idea'}
              </button>
            ))}
          </div>

          <input
            ref={photoInput}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            hidden
            onChange={(e) => onPickPhotos(e.target.files)}
          />
          <div className="flex items-end gap-2">
            <button
              onClick={() => photoInput.current?.click()}
              disabled={sending}
              className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border text-accent disabled:opacity-50"
              aria-label="Add photo"
            >
              📷
            </button>
            <Textarea
              rows={1}
              className="max-h-32 flex-1"
              placeholder="Ask a follow-up or add a photo to refine…"
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
        </div>
      </div>

      <CostModal kind={vizKind} busy={vizBusy} onCancel={() => setVizKind(null)} onConfirm={runVisualize} />
    </Screen>
  );
}
