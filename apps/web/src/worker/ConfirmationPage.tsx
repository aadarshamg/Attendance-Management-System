import { Link, Navigate, useLocation } from 'react-router-dom';
import type { MarkResponse } from '@ams/shared';
import { useI18n } from '../lib/i18n';

export function ConfirmationPage() {
  const location = useLocation();
  const { t, locale } = useI18n();
  const mark = location.state as MarkResponse | null;
  if (!mark) return <Navigate to="/" replace />;

  const isIn = mark.markType === 'check_in';
  const time = new Date(mark.serverTimestamp).toLocaleTimeString(locale, {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div className="worker-page done-page">
      <div className={`done-badge ${mark.status === 'ok' ? 'is-ok' : 'is-flagged'}`} aria-hidden="true">
        {mark.status === 'ok' ? '✓' : '!'}
      </div>
      <h1>{isIn ? t('done.in') : t('done.out')}</h1>
      <p className="done-time">
        <span aria-hidden="true">🕒</span> {t('done.savedAt', { time })}
      </p>
      {mark.status === 'flagged' && (
        <p className="worker-note warn">
          <span aria-hidden="true">⚠️</span> {t('done.check')}
        </p>
      )}
      <Link to="/" replace className="confirm-button done-ok">
        {t('done.home')}
      </Link>
    </div>
  );
}
