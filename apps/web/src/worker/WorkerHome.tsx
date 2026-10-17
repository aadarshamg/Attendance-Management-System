import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { AttendanceRecord, MarkType } from '@ams/shared';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { LanguageToggle, useI18n } from '../lib/i18n';
import { StatusIcon } from '../components/StatusBadge';
import { Icon } from '../components/Icon';

/** A check-in older than this is treated as forgotten, so the next tap starts a new day. */
const OPEN_SHIFT_MAX_HOURS = 16;

/** The single button decides for the worker: end work if a shift is open, otherwise start. */
export function nextMarkType(records: AttendanceRecord[], now = Date.now()): MarkType {
  const last = records[0];
  if (!last || last.markType !== 'check_in') return 'check_in';
  const ageHours = (now - new Date(last.serverTimestamp).getTime()) / 3_600_000;
  return ageHours < OPEN_SHIFT_MAX_HOURS ? 'check_out' : 'check_in';
}

function initials(name: string) {
  return name
    .split(/[\s.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

export function WorkerHome() {
  const { user, logout } = useAuth();
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const records = useQuery({ queryKey: ['me', 1], queryFn: () => api.myRecords(1) });
  // Signed photo URLs last 5 minutes; refetch a little before that.
  const photo = useQuery({ queryKey: ['myPhoto'], queryFn: api.myPhoto, staleTime: 4 * 60_000 });

  const all = records.data?.data ?? [];
  const today = new Date().toDateString();
  const todays = all.filter((r) => new Date(r.serverTimestamp).toDateString() === today);
  const firstIn = [...todays].reverse().find((r) => r.markType === 'check_in');
  const lastOut = todays.find((r) => r.markType === 'check_out');
  const next = nextMarkType(all);
  const doneToday = next === 'check_in' && Boolean(firstIn && lastOut);

  const time = (r?: AttendanceRecord) =>
    r
      ? new Date(r.serverTimestamp).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })
      : t('home.notYet');

  function onLogout() {
    if (window.confirm(t('home.logoutConfirm'))) logout();
  }

  if (!user) return null;

  return (
    <div className="worker-page">
      <header className="worker-topbar">
        <img src="/agua-logo-mark.png" alt="" className="worker-logo" />
        <LanguageToggle />
      </header>

      <section className="worker-profile">
        {photo.data?.imageUrl ? (
          <img src={photo.data.imageUrl} alt="" className="worker-avatar" />
        ) : (
          <span className="worker-avatar worker-avatar-initials" aria-hidden="true">
            {initials(user.name)}
          </span>
        )}
        <div>
          <h1>{t('home.hello', { name: user.name })}</h1>
          {user.assignedSiteName && (
            <p className="worker-site">
              <Icon name="pin" size={18} /> {user.assignedSiteName}
            </p>
          )}
        </div>
      </section>

      <button
        className={`mark-button ${next === 'check_in' ? 'mark-in' : 'mark-out'}`}
        onClick={() => navigate(`/capture?type=${next}`)}
        disabled={records.isLoading}
      >
        <span className="mark-icon">
          <Icon name={next === 'check_in' ? 'hardhat' : 'home'} size={56} />
        </span>
        <span className="mark-label">
          {next === 'check_in' ? t('home.startWork') : t('home.endWork')}
        </span>
        <span className="mark-sub">
          <Icon name="camera" size={20} /> {t('home.tapToMark')}
        </span>
      </button>
      {doneToday && (
        <p className="worker-note">
          <Icon name="checkCircle" size={20} /> {t('home.doneToday')}
        </p>
      )}

      <section className="today-card">
        <h2>{t('home.today')}</h2>
        <div className="today-grid">
          <div className={`today-tile ${firstIn ? 'filled' : ''}`}>
            <span className="today-icon is-in"><Icon name="hardhat" size={22} /></span>
            <span className="today-label">{t('home.in')}</span>
            <strong>{time(firstIn)}</strong>
            {firstIn && <StatusIcon />}
          </div>
          <div className={`today-tile ${lastOut ? 'filled' : ''}`}>
            <span className="today-icon is-out"><Icon name="home" size={22} /></span>
            <span className="today-label">{t('home.out')}</span>
            <strong>{time(lastOut)}</strong>
            {lastOut && <StatusIcon />}
          </div>
        </div>
      </section>

      <nav className="worker-links">
        <Link to="/history" className="worker-link">
          <Icon name="list" size={22} /> {t('home.history')}
          <Icon name="arrowRight" size={18} className="worker-link-arrow" />
        </Link>
        <button type="button" className="worker-link quiet" onClick={onLogout}>
          <Icon name="logout" size={20} /> {t('home.logout')}
        </button>
      </nav>
    </div>
  );
}
