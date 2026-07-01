import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ulid } from 'ulid';

import ProjectCard from '@/components/ProjectCard';
import { Label, Screen, Spinner } from '@/components/ui';
import { putAreaPhotoBlob } from '@/shared/db/areas';
import { dataUrlToBlob, makeThumbnail, preparePhoto } from '@/shared/lib/image';
import { useAreas } from '@/shared/state/areas';
import { useProjects } from '@/shared/state/projects';
import type { AreaPhotoRef } from '@/shared/types/area';
import { canBeParent } from '@/shared/types/area';

export default function AreaDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const area = useAreas((s) => s.byId[id]);
  const hydrated = useAreas((s) => s.hydrated);
  const areasById = useAreas((s) => s.byId);
  const projectsById = useProjects((s) => s.byId);
  const save = useAreas((s) => s.save);

  const subAreas = useMemo(
    () =>
      Object.values(areasById)
        .filter((a) => a.parentId === id)
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [areasById, id],
  );
  const projects = useMemo(
    () =>
      Object.values(projectsById)
        .filter((p) => p.areaId === id)
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [projectsById, id],
  );
  const fileInput = useRef<HTMLInputElement>(null);
  const [addingPhoto, setAddingPhoto] = useState(false);

  useEffect(() => {
    if (hydrated && !area) navigate('/', { replace: true });
  }, [hydrated, area, navigate]);

  if (!area) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner className="size-7" />
      </div>
    );
  }

  const onAddPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setAddingPhoto(true);
    try {
      const added: AreaPhotoRef[] = [];
      for (const file of Array.from(files)) {
        const prepared = await preparePhoto(file);
        const photoId = ulid();
        await putAreaPhotoBlob(photoId, dataUrlToBlob(prepared.dataUrl));
        added.push({
          id: photoId,
          thumbnailUri: await makeThumbnail(prepared.dataUrl, 400),
          sha256: prepared.sha256,
          createdAt: Date.now(),
        });
      }
      await save({ ...area, photos: [...area.photos, ...added], updatedAt: Date.now() });
    } finally {
      setAddingPhoto(false);
    }
  };

  return (
    <Screen
      title={area.name || 'Area'}
      onBack={() => navigate('/')}
      padBottom
      right={
        <Link to={`/area/${area.id}/edit`} className="text-sm font-medium text-accent">
          Edit
        </Link>
      }
    >
      <div className="flex flex-1 flex-col gap-4 p-4">
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          hidden
          onChange={(e) => onAddPhotos(e.target.files)}
        />
        <div className="flex gap-2 overflow-x-auto pb-1">
          {area.photos.map((p) => (
            <img
              key={p.id}
              src={p.thumbnailUri}
              alt=""
              className="h-40 w-56 shrink-0 rounded-2xl bg-surface object-cover"
            />
          ))}
          <button
            onClick={() => fileInput.current?.click()}
            className="flex h-40 w-40 shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-border bg-surface text-ink-subtle"
          >
            {addingPhoto ? <Spinner /> : <span className="text-3xl">＋</span>}
            <span className="text-xs">Add photo</span>
          </button>
        </div>

        {area.notes && <p className="leading-relaxed text-ink-muted">{area.notes}</p>}

        {area.parentId === null && (
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label>Sub-areas</Label>
              <button
                onClick={() => navigate(`/area/new?parent=${area.id}`)}
                className="text-sm font-medium text-accent"
                disabled={!canBeParent(area)}
              >
                Add sub-area
              </button>
            </div>
            {subAreas.length === 0 ? (
              <p className="text-[13px] text-ink-subtle">No sub-areas yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {subAreas.map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => navigate(`/area/${s.id}`)}
                      className="flex w-full items-center gap-3 rounded-2xl bg-surface p-3 text-left transition-colors hover:bg-surface-2"
                    >
                      {s.photos[0] ? (
                        <img src={s.photos[0].thumbnailUri} alt="" className="size-12 rounded-lg object-cover" />
                      ) : (
                        <span className="flex size-12 items-center justify-center rounded-lg bg-surface-2">🌿</span>
                      )}
                      <span className="font-medium">{s.name || 'Untitled sub-area'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label>Projects here</Label>
            <button
              onClick={() => navigate(`/capture?area=${area.id}`)}
              className="text-sm font-medium text-accent"
            >
              Add project
            </button>
          </div>
          {projects.length === 0 ? (
            <p className="text-[13px] text-ink-subtle">
              No projects yet. Add one to get an opinionated plan for this space.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {projects.map((p) => (
                <li key={p.id}>
                  <ProjectCard project={p} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Screen>
  );
}
