import { Link, useNavigate } from 'react-router-dom';

import { Screen } from '@/components/ui';
import { selectProjectList, useProjects } from '@/shared/state/projects';

export default function ProjectList() {
  const navigate = useNavigate();
  const projects = useProjects(selectProjectList);

  return (
    <Screen
      title="Spruce"
      right={
        <Link to="/settings" className="text-sm text-ink-subtle hover:text-accent">
          Settings
        </Link>
      }
    >
      <div className="relative flex-1">
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-8 py-24 text-center">
            <p className="text-xl font-bold">No projects yet</p>
            <p className="leading-relaxed text-ink-subtle">
              Tap the + to take a photo of your yard and get a plan.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3 p-4">
            {projects.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => navigate(`/project/${p.id}`)}
                  className="flex w-full overflow-hidden rounded-2xl bg-surface text-left transition-colors hover:bg-surface-2"
                >
                  <img
                    src={p.thumbnailUri}
                    alt=""
                    className="size-24 shrink-0 object-cover"
                    loading="lazy"
                  />
                  <div className="flex flex-1 flex-col justify-center gap-1.5 p-3">
                    <p className="line-clamp-1 font-semibold">{p.goal || 'Untitled plan'}</p>
                    <p className="text-[13px] text-ink-subtle">
                      {new Date(p.updatedAt).toLocaleDateString()} · {p.plan.items.length} items
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}

        <Link
          to="/capture"
          className="fixed bottom-8 left-1/2 flex size-16 -translate-x-1/2 items-center justify-center rounded-full bg-primary text-3xl font-light text-white shadow-lg shadow-black/40 hover:bg-primary-hover sm:left-auto sm:right-8 sm:translate-x-0"
          aria-label="New project"
        >
          +
        </Link>
      </div>
    </Screen>
  );
}
