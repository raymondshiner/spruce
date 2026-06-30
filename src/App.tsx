import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { Spinner } from '@/components/ui';
import { useProjects } from '@/shared/state/projects';
import { isOnboarded, useSession } from '@/shared/state/session';
import OnboardingKey from '@/screens/OnboardingKey';
import OnboardingZone from '@/screens/OnboardingZone';
import ProjectList from '@/screens/ProjectList';
import Capture from '@/screens/Capture';
import ProjectDetail from '@/screens/ProjectDetail';
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
  const hydrated = useSession((s) => s.hydrated);
  const session = useSession();
  const location = useLocation();

  useEffect(() => {
    hydrateSession();
    hydrateProjects();
  }, [hydrateSession, hydrateProjects]);

  if (!hydrated) return <FullScreenSpinner />;

  return (
    <Routes>
      <Route
        path="/onboarding/key"
        element={<OnboardingKey firstRun={!isOnboarded(session)} />}
      />
      <Route path="/onboarding/zone" element={<OnboardingZone />} />
      <Route
        path="/"
        element={
          <RequireOnboarded>
            <ProjectList />
          </RequireOnboarded>
        }
      />
      <Route
        path="/capture"
        element={
          <RequireOnboarded>
            <Capture />
          </RequireOnboarded>
        }
      />
      <Route
        path="/project/:id"
        element={
          <RequireOnboarded>
            <ProjectDetail />
          </RequireOnboarded>
        }
      />
      <Route
        path="/settings"
        element={
          <RequireOnboarded>
            <Settings />
          </RequireOnboarded>
        }
      />
      <Route path="*" element={<Navigate to="/" replace state={{ from: location.pathname }} />} />
    </Routes>
  );
}
