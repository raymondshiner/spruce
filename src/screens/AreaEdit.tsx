import { useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ulid } from 'ulid';

import { Button, Input, Label, Screen, Textarea } from '@/components/ui';
import { deleteAreaPhotoBlob, putAreaPhotoBlob } from '@/shared/db/areas';
import { dataUrlToBlob, makeThumbnail, preparePhoto } from '@/shared/lib/image';
import { useAreas } from '@/shared/state/areas';
import type { Area, AreaPhotoRef } from '@/shared/types/area';
import { canBeParent } from '@/shared/types/area';

export default function AreaEdit() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const existing = useAreas((s) => (id ? s.byId[id] : undefined));
  const parentCandidate = useAreas((s) => {
    const pid = params.get('parent');
    return pid ? s.byId[pid] : undefined;
  });
  const save = useAreas((s) => s.save);

  const parentId = useMemo(() => {
    if (existing) return existing.parentId;
    if (parentCandidate && canBeParent(parentCandidate)) return parentCandidate.id;
    return null;
  }, [existing, parentCandidate]);

  const [name, setName] = useState(existing?.name ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [photos, setPhotos] = useState<AreaPhotoRef[]>(existing?.photos ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
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
      setPhotos((prev) => [...prev, ...added]);
    } catch {
      setError('Could not read one of those images.');
    }
  };

  const removePhoto = async (photoId: string) => {
    await deleteAreaPhotoBlob(photoId);
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
  };

  const onSave = async () => {
    if (!name.trim()) return setError('Give the area a name.');
    setBusy(true);
    const now = Date.now();
    const area: Area = existing
      ? { ...existing, name: name.trim(), notes: notes.trim(), photos, updatedAt: now }
      : { id: ulid(), parentId, name: name.trim(), notes: notes.trim(), photos, createdAt: now, updatedAt: now };
    await save(area);
    setBusy(false);
    navigate(existing ? `/area/${existing.id}` : parentId ? `/area/${parentId}` : '/', { replace: true });
  };

  const heading = existing
    ? 'Edit area'
    : parentId
      ? `New sub-area${parentCandidate ? ` of ${parentCandidate.name}` : ''}`
      : 'New area';

  return (
    <Screen title={heading} onBack={() => navigate(-1)}>
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex flex-col gap-2">
          <Label>Name</Label>
          <Input
            placeholder="e.g. Backyard, Front beds, Patio"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label>Notes</Label>
          <Textarea
            rows={4}
            placeholder="Anything the AI should know about this area — sun, soil, style you're going for, constraints…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label>Photos</Label>
          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((p) => (
                <div key={p.id} className="relative">
                  <img src={p.thumbnailUri} alt="" className="aspect-square w-full rounded-xl object-cover" />
                  <button
                    onClick={() => removePhoto(p.id)}
                    className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-black/60 text-xs text-white"
                    aria-label="Remove photo"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            hidden
            onChange={(e) => onFiles(e.target.files)}
          />
          <Button variant="secondary" onClick={() => fileInput.current?.click()}>
            Add photos
          </Button>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <Button onClick={onSave} disabled={!name.trim()} busy={busy}>
          {existing ? 'Save changes' : 'Create area'}
        </Button>
      </div>
    </Screen>
  );
}
