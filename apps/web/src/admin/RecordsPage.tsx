import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { AttendanceRecord, UserSummary } from '@ams/shared';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { Icon } from '../components/Icon';

type Show = 'all' | 'on_site' | 'checked_out' | 'absent';

/** One worker's day: first check-in and last check-out. */
interface DayRow {
  workerId: string;
  name: string;
  code: string;
  siteName: string | null;
  checkIn: AttendanceRecord | null;
  checkOut: AttendanceRecord | null;
}

const PAGE_LIMIT = 200;

/** yyyy-mm-dd in the viewer's local time zone (what <input type="date"> uses). */
function localDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function shiftDay(day: string, by: number): string {
  const d = new Date(`${day}T00:00:00`);
  d.setDate(d.getDate() + by);
  return localDay(d);
}

function dayParams(day: string, siteId: string): URLSearchParams {
  const p = new URLSearchParams();
  p.set('dateFrom', new Date(`${day}T00:00:00`).toISOString());
  p.set('dateTo', new Date(`${day}T23:59:59.999`).toISOString());
  if (siteId) p.set('siteId', siteId);
  return p;
}

/** The register needs the whole day, not one page, so read every page for it. */
async function fetchWholeDay(base: URLSearchParams): Promise<AttendanceRecord[]> {
  const all: AttendanceRecord[] = [];
  for (let page = 1; ; page++) {
    const p = new URLSearchParams(base);
    p.set('page', String(page));
    p.set('limit', String(PAGE_LIMIT));
    const res = await api.adminRecords(p);
    all.push(...res.data);
    if (all.length >= res.total || res.data.length === 0) return all;
  }
}

function groupByWorker(records: AttendanceRecord[]): DayRow[] {
  const rows = new Map<string, DayRow>();
  for (const r of records) {
    const row =
      rows.get(r.workerId) ??
      { workerId: r.workerId, name: r.workerName, code: r.employeeCode, siteName: r.siteName, checkIn: null, checkOut: null };
    const t = new Date(r.serverTimestamp).getTime();
    if (r.markType === 'check_in' && (!row.checkIn || t < new Date(row.checkIn.serverTimestamp).getTime())) {
      row.checkIn = r;
    }
    if (r.markType === 'check_out' && (!row.checkOut || t > new Date(row.checkOut.serverTimestamp).getTime())) {
      row.checkOut = r;
    }
    rows.set(r.workerId, row);
  }
  return [...rows.values()];
}

const formatTime = (r: AttendanceRecord | null) =>
  r ? new Date(r.serverTimestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : null;

function hoursWorked(row: DayRow): string | null {
  if (!row.checkIn || !row.checkOut) return null;
  const mins = Math.round(
    (new Date(row.checkOut.serverTimestamp).getTime() - new Date(row.checkIn.serverTimestamp).getTime()) / 60000,
  );
  if (mins <= 0) return null;
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;
}

function rowState(row: DayRow): Exclude<Show, 'all'> {
  if (!row.checkIn && !row.checkOut) return 'absent';
  return row.checkOut ? 'checked_out' : 'on_site';
}

const STATE_LABEL: Record<Exclude<Show, 'all'>, string> = {
  on_site: 'On site',
  checked_out: 'Checked out',
  absent: 'Absent',
};

export function RecordsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const today = localDay(new Date());
  const [day, setDay] = useState(today);
  const [siteId, setSiteId] = useState('');
  const [search, setSearch] = useState('');
  const [show, setShow] = useState<Show>('all');
  const params = useMemo(() => dayParams(day, siteId), [day, siteId]);

  const sites = useQuery({ queryKey: ['sites'], queryFn: api.sites, enabled: isAdmin });
  const users = useQuery({ queryKey: ['users'], queryFn: api.users, enabled: isAdmin });
  const records = useQuery({
    queryKey: ['admin-records', 'day', params.toString()],
    queryFn: () => fetchWholeDay(params),
    refetchInterval: day === today ? 60_000 : false,
  });

  const rows = useMemo(() => {
    const present = groupByWorker(records.data ?? []);
    // Admins also see who has not marked attendance at all that day.
    const seen = new Set(present.map((r) => r.workerId));
    const siteName = (sites.data ?? []).find((s) => s.id === siteId)?.name ?? null;
    const absent: DayRow[] = (users.data ?? [])
      .filter((u: UserSummary) => u.role === 'worker' && u.isActive && !seen.has(u.id))
      .filter((u) => !siteId || u.assignedSiteId === siteId)
      .map((u) => ({
        workerId: u.id,
        name: u.name,
        code: u.employeeCode,
        siteName: u.assignedSiteName ?? siteName,
        checkIn: null,
        checkOut: null,
      }));
    return [...present, ...absent].sort((a, b) => a.name.localeCompare(b.name));
  }, [records.data, users.data, sites.data, siteId]);

  const counts = useMemo(() => {
    const c = { on_site: 0, checked_out: 0, absent: 0 };
    for (const r of rows) c[rowState(r)]++;
    return c;
  }, [rows]);

  const q = search.trim().toLowerCase();
  const visible = rows.filter(
    (r) =>
      (show === 'all' || rowState(r) === show) &&
      (!q || r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q)),
  );

  const download = (format: 'csv' | 'xlsx') => {
    const file = `attendance-${day}.${format === 'csv' ? 'csv' : 'xls'}`;
    api.download(api.exportUrl(params, format), file).catch((error) => alert(error.message));
  };

  const present = counts.on_site + counts.checked_out;
  const dayLabel = new Date(`${day}T00:00:00`).toLocaleDateString([], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="dashboard-page">
      <section className="page-heading">
        <div>
          <h1>Attendance</h1>
          <p>{day === today ? `Today, ${dayLabel}` : dayLabel}</p>
        </div>
        <div className="heading-actions">
          <div className="day-picker">
            <button aria-label="Previous day" onClick={() => setDay((d) => shiftDay(d, -1))}>
              <Icon name="arrowLeft" size={16} />
            </button>
            <input
              type="date"
              value={day}
              max={today}
              onChange={(e) => e.target.value && setDay(e.target.value)}
              aria-label="Date"
            />
            <button
              aria-label="Next day"
              disabled={day >= today}
              onClick={() => setDay((d) => shiftDay(d, 1))}
            >
              <Icon name="arrowRight" size={16} />
            </button>
          </div>
          {day !== today && (
            <button className="secondary-button" onClick={() => setDay(today)}>
              Today
            </button>
          )}
          <button className="primary action-button" onClick={() => download('xlsx')}>
            <span className="download-glyph" aria-hidden="true" /> Export Excel
          </button>
        </div>
      </section>

      <section className="metric-grid" aria-label="Attendance summary">
        <SummaryCard label="Present" value={present} hint="Marked attendance" tone="ok" onClick={() => setShow('all')} active={show === 'all'} />
        <SummaryCard label="On site now" value={counts.on_site} hint="Checked in, not out yet" tone="primary" onClick={() => setShow('on_site')} active={show === 'on_site'} />
        <SummaryCard label="Checked out" value={counts.checked_out} hint="Finished for the day" tone="neutral" onClick={() => setShow('checked_out')} active={show === 'checked_out'} />
        {isAdmin && (
          <SummaryCard label="Absent" value={counts.absent} hint="No attendance marked" tone="warn" onClick={() => setShow('absent')} active={show === 'absent'} />
        )}
      </section>

      <section className="records-panel">
        <div className="register-toolbar">
          <label className="search-box">
            <Icon name="user" size={18} />
            <input
              type="search"
              placeholder="Search by name or employee code"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          {isAdmin && (
            <select value={siteId} onChange={(e) => setSiteId(e.target.value)} aria-label="Site">
              <option value="">All sites</option>
              {(sites.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
          <div className="show-tabs" role="tablist">
            {(['all', 'on_site', 'checked_out', ...(isAdmin ? (['absent'] as const) : [])] as Show[]).map((s) => (
              <button key={s} role="tab" aria-selected={show === s} className={show === s ? 'active' : ''} onClick={() => setShow(s)}>
                {s === 'all' ? 'Everyone' : STATE_LABEL[s]}
              </button>
            ))}
          </div>
          <button className="secondary-button" onClick={() => download('csv')}>
            Download CSV
          </button>
        </div>

        <div className="table-wrap records-table-wrap">
          <table className="records-table register-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Site</th>
                <th>In</th>
                <th>Out</th>
                <th>Hours</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const state = rowState(row);
                return (
                  <tr key={row.workerId}>
                    <td>
                      <div className="employee-cell">
                        <span className="employee-avatar">{row.name.slice(0, 1).toUpperCase()}</span>
                        <span>
                          <strong>{row.name}</strong>
                          <small>{row.code}</small>
                        </span>
                      </div>
                    </td>
                    <td className="cell-primary">{row.siteName ?? '-'}</td>
                    <td><TimeCell record={row.checkIn} /></td>
                    <td><TimeCell record={row.checkOut} /></td>
                    <td className="cell-primary">{hoursWorked(row) ?? '-'}</td>
                    <td><span className={`day-state ${state}`}>{STATE_LABEL[state]}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {records.isLoading && <div className="table-message">Loading attendance…</div>}
          {records.isError && <div className="table-message error">Could not load attendance.</div>}
          {!records.isLoading && !records.isError && visible.length === 0 && (
            <div className="empty-state">
              <span className="empty-icon" />
              <h3>{q ? 'No one matches your search' : 'No attendance for this day'}</h3>
              <p>{q ? 'Check the spelling or clear the search.' : 'Pick another date or site.'}</p>
            </div>
          )}
        </div>

        <div className="pagination-bar">
          <span>
            Showing <strong>{visible.length}</strong> of <strong>{rows.length}</strong> people
          </span>
        </div>
      </section>
    </div>
  );
}

/** Time of a mark, linking to its photo, map and details. */
function TimeCell({ record }: { record: AttendanceRecord | null }) {
  if (!record) return <span className="muted">-</span>;
  return (
    <Link to={`/admin/records/${record.id}`} className="time-link" title="Open photo and location">
      {formatTime(record)}
      <Icon name="camera" size={15} />
    </Link>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  tone,
  onClick,
  active,
}: {
  label: string;
  value: number;
  hint: string;
  tone: 'ok' | 'primary' | 'neutral' | 'warn';
  onClick: () => void;
  active: boolean;
}) {
  return (
    <button type="button" className={`summary-card tone-${tone} ${active ? 'active' : ''}`} onClick={onClick}>
      <span className="summary-label">{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </button>
  );
}
