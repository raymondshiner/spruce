import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ulid } from 'ulid';

import { Button, Screen, Textarea } from '@/components/ui';
import { generatePlan, SpruceApiError } from '@/shared/api/client';
import { PlanSchema } from '@/shared/schema/plan';
import { preparePhoto, type PreparedPhoto } from '@/shared/lib/image';
import { useProjects } from '@/shared/state/projects';
import { useSession } from '@/shared/state/session';
import type { Project } from '@/shared/types/project';

export default function Capture() {
  const navigate = useNavigate();
  const session = useSession();
  const saveProject = useProjects((s) => s.save);
  const cameraInput = useRef<HTMLInputElement>(null);
  const libraryInput = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null);
  const [goal, setGoal] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      setPhoto(await preparePhoto(file));
    } catch {
      setError('Could not read that image. Try another.');
    }
  };

  const onGenerate = async () => {
    if (!photo) return setError('Add a photo first.');
    if (!goal.trim()) return setError('Tell Spruce what you want to change — even one sentence helps.');
    if (!session.openaiApiKey) return setError('No API key. Set it in Settings.');
    if (!session.zone) return setError('Set your zone first.');

    setBusy(true);
    setError(null);
    try {
      const device = await session.ensureDeviceRegistered();
      const raw = await generatePlan(device, {
        mode: 'yard',
        zone: session.zone,
        goal: goal.trim(),
        photoBase64: photo.base64,
        openaiApiKey: session.openaiApiKey,
      });
      const parsed = PlanSchema.safeParse(raw);
      if (!parsed.success) {
        throw new SpruceApiError({ error: 'schema_parse_fail', message: parsed.error.message });
      }

      const id = ulid();
      const now = Date.now();
      const project: Project = {
        id,
        createdAt: now,
        updatedAt: now,
        mode: 'yard',
        thumbnailUri: photo.dataUrl,
        photoSha256: photo.sha256,
        zone: session.zone,
        goal: goal.trim(),
        visionSummary: parsed.data.visionSummary,
        plan: parsed.data,
        turns: [],
      };
      await saveProject(project);
      navigate(`/project/${id}`, { replace: true });
    } catch (e) {
      const err = e instanceof SpruceApiError ? e : null;
      setError(err?.message ?? 'Could not generate a plan. Try again?');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="New project" onBack={() => navigate(-1)}>
      <div className="flex flex-1 flex-col gap-4 p-5">
        {photo ? (
          <img
            src={photo.dataUrl}
            alt="Selected space"
            className="aspect-[4/3] w-full rounded-2xl bg-surface object-cover"
          />
        ) : (
          <div className="flex aspect-[4/3] w-full items-center justify-center rounded-2xl border border-dashed border-border bg-surface text-ink-subtle">
            Add a photo of the space
          </div>
        )}

        <input
          ref={cameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <input
          ref={libraryInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => cameraInput.current?.click()}>
            Camera
          </Button>
          <Button variant="secondary" className="flex-1" onClick={() => libraryInput.current?.click()}>
            Photo library
          </Button>
        </div>

        <label className="mt-1 font-semibold" htmlFor="goal">
          What do you want to change?
        </label>
        <Textarea
          id="goal"
          rows={4}
          placeholder="e.g. a low-maintenance native garden bed where the patchy lawn is"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
        />

        {error && <p className="text-sm text-danger">{error}</p>}

        <Button onClick={onGenerate} disabled={!photo || !goal.trim()} busy={busy}>
          Generate plan
        </Button>
        <p className="text-center text-xs text-ink-subtle">
          This sends the photo and goal to OpenAI on your account — usually under $0.05.
        </p>
      </div>
    </Screen>
  );
}
