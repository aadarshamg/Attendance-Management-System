import { Link, Navigate, useLocation } from 'react-router-dom';
import type { MarkResponse } from '@ams/shared';
import { useI18n } from '../lib/i18n';
import { Icon } from '../components/Icon';

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
      <div className="done-badge is-ok" aria-hidden="true">
        <Icon name="check" size={72} />
      </div>
      <h1>{isIn ? t('done.in') : t('done.out')}</h1>
      <p className="done-time">
        <Icon name="clock" size={22} /> {t('done.savedAt', { time })}
      </p>
      <Link to="/" replace className="confirm-button done-ok">
        {t('done.home')}
      </Link>
    </div>
  );
}
