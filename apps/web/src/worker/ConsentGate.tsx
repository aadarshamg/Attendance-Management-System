import { useState } from 'react';
import { CONSENT_NOTICE } from '@ams/shared';
import { useAuth } from '../auth/AuthContext';

/** DPDP Act 2023 (§11.1): capture plain-language consent before the first mark. */
export function ConsentGate({ children }: { children: React.ReactNode }) {
  const { user, consent, logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user || user.role !== 'worker' || user.consentedAt) {
    return <>{children}</>;
  }

  async function agree() {
    setBusy(true);
    setError(null);
    try {
      await consent();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card center-screen stack">
      <h1>Before you start</h1>
      <p>{CONSENT_NOTICE}</p>
      {error && <p className="error">{error}</p>}
      <button className="primary" onClick={agree} disabled={busy}>
        {busy ? 'Saving…' : 'I understand and agree'}
      </button>
      <button className="link" onClick={logout}>
        Not now — sign out
      </button>
    </div>
  );
}
