import { useNavigate } from 'react-router-dom';

import type { Project } from '@/shared/types/project';
import { projectTitle } from '@/shared/types/project';

export default function ProjectCard({ project }: { project: Project }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(`/project/${project.id}`)}
      className="flex w-full overflow-hidden rounded-2xl bg-surface text-left transition-colors hover:bg-surface-2"
    >
      <img src={project.thumbnailUri} alt="" className="size-24 shrink-0 object-cover" loading="lazy" />
      <div className="flex flex-1 flex-col justify-center gap-1.5 p-3">
        <p className="line-clamp-1 font-semibold">{projectTitle(project)}</p>
        <p className="text-[13px] text-ink-subtle">
          {new Date(project.updatedAt).toLocaleDateString()} · {project.plan.items.length} items
        </p>
      </div>
    </button>
  );
}
