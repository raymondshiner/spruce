import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button, Input, Screen } from '@/components/ui';
import { isValidUsZip, zipToZone } from '@/shared/data/zip-to-zone';
import { useSession } from '@/shared/state/session';

export default function OnboardingZone() {
  const navigate = useNavigate();
  const setZipAndZone = useSession((s) => s.setZipAndZone);
  const hasKey = useSession((s) => Boolean(s.openaiApiKey));
  const [zip, setZip] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onContinue = async () => {
    if (!isValidUsZip(zip)) {
      setError('Need a 5-digit US zip. Outside the US? Indoor mode (coming soon) works anywhere.');
      return;
    }
    const zone = zipToZone(zip);
    setBusy(true);
    try {
      await setZipAndZone(zip, zone ?? 'unknown');
      navigate('/', { replace: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title={hasKey ? 'Your area' : undefined} onBack={hasKey ? () => navigate(-1) : undefined}>
      <div className="flex flex-1 flex-col gap-4 p-6">
        <h1 className="text-3xl font-bold">Where are you?</h1>
        <p className="leading-relaxed text-ink-muted">
          Spruce uses your USDA plant hardiness zone to recommend plants that survive your winters.
          We only need your zip — no other location data.
        </p>

        <Input
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={5}
          placeholder="ZIP code"
          className="tracking-[0.3em]"
          value={zip}
          onChange={(e) => {
            setZip(e.target.value.replace(/\D/g, '').slice(0, 5));
            setError(null);
          }}
        />
        {error && <p className="text-sm text-danger">{error}</p>}

        <Button onClick={onContinue} disabled={zip.length < 5} busy={busy}>
          Continue
        </Button>
      </div>
    </Screen>
  );
}
