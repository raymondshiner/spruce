import { Link, useNavigate } from 'react-router-dom';

import InstallBanner from '@/components/InstallBanner';
import { Screen } from '@/components/ui';
import { selectTopLevelAreas, useAreas } from '@/shared/state/areas';
import { useProjects } from '@/shared/state/projects';

export default function Areas() {
  const navigate = useNavigate();
  const areas = useAreas(selectTopLevelAreas);
  const areasById = useAreas((s) => s.byId);
  const projects = useProjects((s) => s.byId);

  const subCount = (areaId: string) =>
    Object.values(areasById).filter((a) => a.parentId === areaId).length;
  const projectCount = (areaId: string) => {
    const subIds = new Set(
      Object.values(areasById).filter((a) => a.parentId === areaId).map((a) => a.id),
    );
    return Object.values(projects).filter((p) => p.areaId === areaId || subIds.has(p.areaId)).length;
  };

  return (
    <Screen
      title="Spruce"
      padBottom
      right={
        <Link to="/area/new" className="text-sm font-medium text-accent">
          New area
        </Link>
      }
    >
      <div className="flex flex-1 flex-col gap-4 p-4">
        <InstallBanner />

        {areas.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-8 py-24 text-center">
            <p className="text-xl font-bold">No areas yet</p>
            <p className="leading-relaxed text-ink-subtle">
              Create an area for a part of your garden — a bed, the patio, the whole backyard —
              then add projects inside it.
            </p>
            <Link
              to="/area/new"
              className="mt-3 rounded-2xl bg-primary px-5 py-3 font-semibold text-white hover:bg-primary-hover"
            >
              Create your first area
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {areas.map((a) => (
              <li key={a.id}>
                <button
                  onClick={() => navigate(`/area/${a.id}`)}
                  className="flex w-full overflow-hidden rounded-2xl bg-surface text-left transition-colors hover:bg-surface-2"
                >
                  {a.photos[0] ? (
                    <img src={a.photos[0].thumbnailUri} alt="" className="size-24 shrink-0 object-cover" loading="lazy" />
                  ) : (
                    <div className="flex size-24 shrink-0 items-center justify-center bg-surface-2 text-2xl text-ink-subtle">
                      🌿
                    </div>
                  )}
                  <div className="flex flex-1 flex-col justify-center gap-1.5 p-3">
                    <p className="line-clamp-1 font-semibold">{a.name || 'Untitled area'}</p>
                    <p className="text-[13px] text-ink-subtle">
                      {subCount(a.id)} sub-areas · {projectCount(a.id)} projects
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Screen>
  );
}
