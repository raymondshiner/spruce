import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button, Input, Screen } from '@/components/ui';
import { useSession } from '@/shared/state/session';

export default function OnboardingKey({ firstRun }: { firstRun: boolean }) {
  const navigate = useNavigate();
  const setOpenAiKey = useSession((s) => s.setOpenAiKey);
  const zone = useSession((s) => s.zone);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onContinue = async () => {
    const trimmed = key.trim();
    if (!trimmed.startsWith('sk-')) {
      setError('OpenAI API keys start with "sk-".');
      return;
    }
    setBusy(true);
    try {
      await setOpenAiKey(trimmed);
      navigate(firstRun || !zone ? '/onboarding/zone' : '/settings', { replace: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title={firstRun ? undefined : 'Update key'} onBack={firstRun ? undefined : () => navigate(-1)}>
      <div className="flex flex-1 flex-col gap-4 p-6">
        <h1 className="text-3xl font-bold">Connect your OpenAI account</h1>
        <p className="leading-relaxed text-ink-muted">
          Spruce uses your own OpenAI API key — you pay OpenAI directly, and your key is encrypted on
          this device, only sent to make requests on your behalf.
        </p>
        <p className="leading-relaxed text-ink-muted">
          Set a hard monthly limit on your OpenAI account so a surprise can&rsquo;t happen.
        </p>

        <Input
          type="password"
          placeholder="sk-..."
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={key}
          onChange={(e) => {
            setKey(e.target.value);
            setError(null);
          }}
        />
        {error && <p className="text-sm text-danger">{error}</p>}

        <Button onClick={onContinue} disabled={!key} busy={busy}>
          Continue
        </Button>

        <a
          className="text-sm text-accent"
          href="https://platform.openai.com/api-keys"
          target="_blank"
          rel="noreferrer"
        >
          How do I get a key?
        </a>
        <a
          className="text-sm text-accent"
          href="https://platform.openai.com/account/limits"
          target="_blank"
          rel="noreferrer"
        >
          Set a spending limit on OpenAI →
        </a>
      </div>
    </Screen>
  );
}
