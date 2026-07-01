import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { cn } from '@/lib/cn';

function TabIcon({ name }: { name: 'areas' | 'new' | 'settings' }) {
  const common = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (name === 'areas') {
    return (
      <svg {...common} aria-hidden>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    );
  }
  if (name === 'settings') {
    return (
      <svg {...common} aria-hidden>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    );
  }
  return (
    <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function showTabBarFor(pathname: string): boolean {
  if (pathname === '/' || pathname === '/settings') return true;
  return /^\/area\/[^/]+$/.test(pathname); // area detail, but not /new or /edit
}

export default function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const showTabBar = showTabBarFor(location.pathname);
  const areasActive = location.pathname === '/' || location.pathname.startsWith('/area');
  const settingsActive = location.pathname === '/settings';

  return (
    <div className="relative">
      <div key={location.pathname} className="animate-[fadeIn_180ms_ease-out]">
        <Outlet />
      </div>

      {showTabBar && (
        <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-md border-t border-border/60 bg-bg/95 backdrop-blur">
          <div className="flex items-stretch justify-around px-2 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1.5">
            <Link
              to="/"
              className={cn(
                'flex min-h-14 min-w-16 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium',
                areasActive ? 'text-accent' : 'text-ink-subtle',
              )}
            >
              <TabIcon name="areas" />
              Areas
            </Link>
            <button
              onClick={() => navigate('/capture')}
              aria-label="New project"
              className="flex min-h-14 min-w-16 flex-col items-center justify-center gap-1 text-[11px] font-medium text-ink-subtle"
            >
              <span className="flex size-11 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-black/40">
                <TabIcon name="new" />
              </span>
            </button>
            <Link
              to="/settings"
              className={cn(
                'flex min-h-14 min-w-16 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium',
                settingsActive ? 'text-accent' : 'text-ink-subtle',
              )}
            >
              <TabIcon name="settings" />
              Settings
            </Link>
          </div>
        </nav>
      )}
    </div>
  );
}
