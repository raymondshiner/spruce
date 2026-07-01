import { useNavigate } from 'react-router-dom';

import { Button, Card, Label, Screen } from '@/components/ui';
import { useInstallPrompt } from '@/shared/lib/install-prompt';
import { useSession } from '@/shared/state/session';

function maskKey(key: string | null): string {
  if (!key) return 'Not set';
  if (key.length < 12) return '••••';
  return `${key.slice(0, 5)}…${key.slice(-4)}`;
}

export default function Settings() {
  const navigate = useNavigate();
  const session = useSession();
  const { canInstall, promptInstall } = useInstallPrompt();

  const onReset = async () => {
    if (!window.confirm('Reset Spruce? This clears your API key, zone, and device token. Projects are kept.')) {
      return;
    }
    await session.reset();
    navigate('/', { replace: true });
  };

  return (
    <Screen title="Settings" onBack={() => navigate(-1)} padBottom>
      <div className="flex flex-col gap-4 p-4">
        {canInstall && (
          <Card className="flex items-center justify-between gap-3">
            <div>
              <Label>Install</Label>
              <p className="mt-1 text-[13px] text-ink-subtle">Add Spruce to your home screen.</p>
            </div>
            <Button className="px-4 py-2 text-sm" onClick={promptInstall}>
              Install
            </Button>
          </Card>
        )}

        <Card className="flex flex-col gap-2">
          <Label>OpenAI API key</Label>
          <p className="text-base font-medium">{maskKey(session.openaiApiKey)}</p>
          <button
            className="py-2 text-left text-sm text-accent"
            onClick={() => navigate('/onboarding/key')}
          >
            Update key
          </button>
          <a className="py-2 text-sm text-accent" href="https://platform.openai.com/usage" target="_blank" rel="noreferrer">
            Check usage on OpenAI →
          </a>
          <a
            className="py-2 text-sm text-accent"
            href="https://platform.openai.com/account/limits"
            target="_blank"
            rel="noreferrer"
          >
            Set a spending limit →
          </a>
        </Card>

        <Card className="flex flex-col gap-2">
          <Label>Zone</Label>
          <p className="text-base font-medium">
            {session.zone ? `${session.zip} · USDA ${session.zone}` : 'Not set'}
          </p>
          <button
            className="py-2 text-left text-sm text-accent"
            onClick={() => navigate('/onboarding/zone')}
          >
            Change zip
          </button>
        </Card>

        <Button variant="danger" onClick={onReset}>
          Reset Spruce
        </Button>
      </div>
    </Screen>
  );
}
