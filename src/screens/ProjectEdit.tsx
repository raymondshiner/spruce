import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { Button, Input, Label, Screen, Spinner } from '@/components/ui';
import { cn } from '@/lib/cn';
import { selectTopLevelAreas, useAreas } from '@/shared/state/areas';
import { useProjects } from '@/shared/state/projects';
import { UNASSIGNED_AREA_ID } from '@/shared/types/area';

export default function ProjectEdit() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const project = useProjects((s) => s.byId[id]);
  const hydrated = useProjects((s) => s.hydrated);
  const save = useProjects((s) => s.save);
  const remove = useProjects((s) => s.remove);
  const topLevel = useAreas(selectTopLevelAreas);
  const areasById = useAreas((s) => s.byId);

  const [title, setTitle] = useState(project?.title ?? '');
  const [areaId, setAreaId] = useState(project?.areaId ?? UNASSIGNED_AREA_ID);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (hydrated && !project) navigate('/', { replace: true });
  }, [hydrated, project, navigate]);

  // Flattened area options: each top-level area followed by its sub-areas (indented).
  const options = useMemo(() => {
    const rows: { id: string; label: string; depth: number }[] = [];
    for (const a of topLevel) {
      rows.push({ id: a.id, label: a.name || 'Untitled area', depth: 0 });
      for (const sub of Object.values(areasById).filter((s) => s.parentId === a.id)) {
        rows.push({ id: sub.id, label: sub.name || 'Untitled sub-area', depth: 1 });
      }
    }
    return rows;
  }, [topLevel, areasById]);

  if (!project) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner className="size-7" />
      </div>
    );
  }

  const onSave = async () => {
    setBusy(true);
    await save({ ...project, title: title.trim(), areaId, updatedAt: Date.now() });
    setBusy(false);
    navigate(`/project/${project.id}`, { replace: true });
  };

  const onDelete = async () => {
    if (!window.confirm('Delete this project? This cannot be undone.')) return;
    await remove(project.id);
    navigate('/', { replace: true });
  };

  return (
    <Screen title="Edit project" onBack={() => navigate(-1)}>
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex flex-col gap-2">
          <Label>Title</Label>
          <Input
            placeholder={project.goal || 'Project title'}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <p className="text-[13px] text-ink-subtle">Leave blank to use your original goal as the title.</p>
        </div>

        <div className="flex flex-col gap-2">
          <Label>Area</Label>
          <ul className="flex flex-col gap-1.5">
            {options.map((o) => (
              <li key={o.id}>
                <button
                  onClick={() => setAreaId(o.id)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-xl border px-3 py-3 text-left',
                    o.depth === 1 && 'ml-5',
                    areaId === o.id ? 'border-accent bg-surface-2' : 'border-border bg-surface',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-4 items-center justify-center rounded-full border',
                      areaId === o.id ? 'border-accent' : 'border-ink-subtle',
                    )}
                  >
                    {areaId === o.id && <span className="size-2 rounded-full bg-accent" />}
                  </span>
                  <span className="font-medium">{o.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <Button onClick={onSave} busy={busy}>
          Save changes
        </Button>
        <Button variant="danger" onClick={onDelete}>
          Delete project
        </Button>
      </div>
    </Screen>
  );
}
