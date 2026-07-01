import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import AppShell from '@/components/AppShell';
import { Spinner } from '@/components/ui';
import { useAreas } from '@/shared/state/areas';
import { useProjects } from '@/shared/state/projects';
import { isOnboarded, useSession } from '@/shared/state/session';
import OnboardingKey from '@/screens/OnboardingKey';
import OnboardingZone from '@/screens/OnboardingZone';
import Areas from '@/screens/Areas';
import AreaDetail from '@/screens/AreaDetail';
import AreaEdit from '@/screens/AreaEdit';
import Capture from '@/screens/Capture';
import ProjectDetail from '@/screens/ProjectDetail';
import ProjectEdit from '@/screens/ProjectEdit';
import Settings from '@/screens/Settings';

function FullScreenSpinner() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <Spinner className="size-7" />
    </div>
  );
}

function RequireOnboarded({ children }: { children: React.ReactNode }) {
  const session = useSession();
  if (!session.hydrated) return <FullScreenSpinner />;
  if (!session.openaiApiKey) return <Navigate to="/onboarding/key" replace />;
  if (!session.zone) return <Navigate to="/onboarding/zone" replace />;
  return <>{children}</>;
}

export default function App() {
  const hydrateSession = useSession((s) => s.hydrate);
  const hydrateProjects = useProjects((s) => s.hydrate);
  const hydrateAreas = useAreas((s) => s.hydrate);
  const hydrated = useSession((s) => s.hydrated);
  const session = useSession();
  const location = useLocation();

  useEffect(() => {
    hydrateSession();
    hydrateProjects();
    hydrateAreas();
  }, [hydrateSession, hydrateProjects, hydrateAreas]);

  if (!hydrated) return <FullScreenSpinner />;

  return (
    <Routes>
      <Route
        path="/onboarding/key"
        element={<OnboardingKey firstRun={!isOnboarded(session)} />}
      />
      <Route path="/onboarding/zone" element={<OnboardingZone />} />

      <Route
        element={
          <RequireOnboarded>
            <AppShell />
          </RequireOnboarded>
        }
      >
        <Route path="/" element={<Areas />} />
        <Route path="/area/new" element={<AreaEdit />} />
        <Route path="/area/:id" element={<AreaDetail />} />
        <Route path="/area/:id/edit" element={<AreaEdit />} />
        <Route path="/capture" element={<Capture />} />
        <Route path="/project/:id" element={<ProjectDetail />} />
        <Route path="/project/:id/edit" element={<ProjectEdit />} />
        <Route path="/settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace state={{ from: location.pathname }} />} />
    </Routes>
  );
}
