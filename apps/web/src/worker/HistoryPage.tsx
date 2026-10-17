import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { LanguageToggle, useI18n } from '../lib/i18n';
import { StatusIcon } from '../components/StatusBadge';
import { Icon } from '../components/Icon';

export function HistoryPage() {
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const { data, isLoading } = useQuery({ queryKey: ['me', 1], queryFn: () => api.myRecords(1) });

  return (
    <div className="worker-page">
      <header className="worker-topbar">
        <button className="back-button" onClick={() => navigate('/')}>
          <Icon name="arrowLeft" size={18} /> {t('history.back')}
        </button>
        <LanguageToggle />
      </header>
      <h1>{t('history.title')}</h1>
      {isLoading && <p className="muted">{t('history.loading')}</p>}
      {(data?.data ?? []).map((r) => {
        const isIn = r.markType === 'check_in';
        const when = new Date(r.serverTimestamp);
        return (
          <div key={r.id} className="history-row">
            <span className={`today-icon ${isIn ? 'is-in' : 'is-out'}`}>
              <Icon name={isIn ? 'hardhat' : 'home'} size={22} />
            </span>
            <div className="history-main">
              <strong>{isIn ? t('home.startWork') : t('home.endWork')}</strong>
              <span className="muted">
                {when.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })}
                {' · '}
                {when.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })}
              </span>
            </div>
            <StatusIcon />
          </div>
        );
      })}
      {data && data.data.length === 0 && <p className="muted">{t('history.empty')}</p>}
    </div>
  );
}
