import { useState } from 'react';

import { useInstallPrompt } from '@/shared/lib/install-prompt';

export default function InstallBanner() {
  const { canInstall, promptInstall } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(false);
  if (!canInstall || dismissed) return null;

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-accent/30 bg-surface p-3">
      <span className="text-2xl">📲</span>
      <div className="flex-1">
        <p className="text-sm font-semibold">Install Spruce</p>
        <p className="text-[13px] text-ink-subtle">Add it to your home screen for a full-screen app.</p>
      </div>
      <button
        onClick={promptInstall}
        className="shrink-0 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary-hover"
      >
        Install
      </button>
      <button onClick={() => setDismissed(true)} className="shrink-0 px-1 text-ink-subtle" aria-label="Dismiss">
        ✕
      </button>
    </div>
  );
}
