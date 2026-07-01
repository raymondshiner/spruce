import { useEffect, useState } from 'react';

// Minimal typing for the non-standard beforeinstallprompt event (Chromium/Android).
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

// Captures the deferred A2HS prompt so we can surface our own "Install" affordance.
export function useInstallPrompt(): { canInstall: boolean; promptInstall: () => Promise<void> } {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDeferred(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  };

  return { canInstall: deferred !== null, promptInstall };
}
