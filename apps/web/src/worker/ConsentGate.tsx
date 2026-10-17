import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { LanguageToggle, useI18n } from '../lib/i18n';
import { toFriendlyError, type FriendlyError } from '../lib/friendlyError';
import { ProblemCard } from '../components/ProblemCard';

/**
 * DPDP Act 2023 (§11.1): capture plain-language consent before the first mark.
 * The text is shown in the worker's chosen language (English or Hindi).
 */
export function ConsentGate({ children }: { children: React.ReactNode }) {
  const { user, consent, logout } = useAuth();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<FriendlyError | null>(null);

  if (!user || user.role !== 'worker' || user.consentedAt) {
    return <>{children}</>;
  }

  async function agree() {
    setBusy(true);
    setProblem(null);
    try {
      await consent();
    } catch (e) {
      setProblem(toFriendlyError(e, 'mark'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="worker-page">
      <header className="worker-topbar">
        <img src="/agua-logo-mark.png" alt="" className="worker-logo" />
        <LanguageToggle />
      </header>
      <h1>{t('consent.title')}</h1>
      <div className="consent-icons" aria-hidden="true">📷 📍 🕒</div>
      <p className="consent-text">{t('consent.body')}</p>
      {problem && <ProblemCard problem={problem} />}
      <button className="confirm-button" onClick={agree} disabled={busy}>
        <span aria-hidden="true">✅</span> {busy ? t('consent.saving') : t('consent.agree')}
      </button>
      <button className="worker-link quiet" onClick={logout}>
        {t('consent.later')}
      </button>
    </div>
  );
}
