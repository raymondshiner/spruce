import { Button } from '@/components/ui';
import type { GeneratedImageKind } from '@/shared/types/project';

export const VISUALIZE_COST_USD: Record<GeneratedImageKind, number> = {
  render: 0.08,
  layout: 0.06,
};

const COPY: Record<GeneratedImageKind, { title: string; body: string }> = {
  render: {
    title: 'Photorealistic render',
    body: 'Generates an inspirational before/after render of your space with the plan applied. It captures the vibe, not the exact structure.',
  },
  layout: {
    title: 'Top-down layout',
    body: 'Generates an overhead diagram sketching where the key pieces go.',
  },
};

export default function CostModal({
  kind,
  busy,
  onCancel,
  onConfirm,
}: {
  kind: GeneratedImageKind | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!kind) return null;
  const { title, body } = COPY[kind];
  const cost = VISUALIZE_COST_USD[kind];

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-3xl bg-surface p-5">
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="mt-2 leading-relaxed text-ink-muted">{body}</p>
        <p className="mt-3 text-[13px] text-ink-subtle">
          This runs on your OpenAI account — about ${cost.toFixed(2)} per image.
        </p>
        <div className="mt-5 flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={onConfirm} busy={busy}>
            Generate
          </Button>
        </div>
      </div>
    </div>
  );
}
