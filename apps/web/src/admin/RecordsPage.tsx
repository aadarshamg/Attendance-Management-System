import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { RecordStatus } from '@ams/shared';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { StatusBadge } from '../components/StatusBadge';

interface Filters {
  workerId: string;
  siteId: string;
  status: '' | RecordStatus;
  dateFrom: string;
  dateTo: string;
  page: number;
}

const EMPTY: Filters = { workerId: '', siteId: '', status: '', dateFrom: '', dateTo: '', page: 1 };

function toParams(f: Filters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.workerId) p.set('workerId', f.workerId);
  if (f.siteId) p.set('siteId', f.siteId);
  if (f.status) p.set('status', f.status);
  if (f.dateFrom) p.set('dateFrom', new Date(f.dateFrom).toISOString());
  if (f.dateTo) p.set('dateTo', new Date(f.dateTo + 'T23:59:59').toISOString());
  p.set('page', String(f.page));
  p.set('limit', '25');
  return p;
}

const formatTime = (value: string) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const formatDay = (value: string) => new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric' });

export function RecordsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const params = useMemo(() => toParams(filters), [filters]);

  const sites = useQuery({ queryKey: ['sites'], queryFn: api.sites });
  const users = useQuery({ queryKey: ['users'], queryFn: api.users, enabled: isAdmin });
  const records = useQuery({ queryKey: ['admin-records', params.toString()], queryFn: () => api.adminRecords(params) });

  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, page: 1, ...patch }));
  const totalPages = records.data ? Math.max(1, Math.ceil(records.data.total / records.data.limit)) : 1;
  const visibleRecords = records.data?.data ?? [];
  const verified = visibleRecords.filter((record) => record.status === 'ok').length;
  const flagged = visibleRecords.filter((record) => record.status === 'flagged').length;
  const activeSites = sites.data?.filter((site) => site.isActive).length ?? 0;
  const activeFilterCount = [filters.workerId, filters.siteId, filters.status, filters.dateFrom, filters.dateTo].filter(Boolean).length;

  const download = (format: 'csv' | 'xlsx') => {
    const file = format === 'csv' ? 'attendance.csv' : 'attendance.xls';
    api.download(api.exportUrl(params, format), file).catch((error) => alert(error.message));
  };

  return (
    <div className="dashboard-page">
      <section className="page-heading">
        <div>
          <div className="breadcrumb"><span>Operations</span><i />Attendance</div>
          <h1>Attendance overview</h1>
          <p>Monitor workforce presence, site activity, and exceptions in real time.</p>
        </div>
        <div className="heading-actions">
          <div className="date-chip"><span className="calendar-glyph" aria-hidden="true" /><span><small>Reporting date</small><strong>{new Date().toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</strong></span></div>
          <button className="primary action-button" onClick={() => download('xlsx')}><span className="download-glyph" aria-hidden="true" /> Export report</button>
        </div>
      </section>

      <section className="metric-grid" aria-label="Attendance summary">
        <article className="metric-card metric-primary"><div className="metric-top"><span className="metric-icon metric-icon-people" /><span className="trend positive">Live</span></div><p>Total records</p><strong>{records.data?.total ?? '—'}</strong><small>Across all reporting sites</small></article>
        <article className="metric-card"><div className="metric-top"><span className="metric-icon metric-icon-check" /><span className="trend positive">Verified</span></div><p>Clear entries</p><strong>{records.isLoading ? '—' : verified}</strong><small>On this page of results</small></article>
        <article className="metric-card"><div className="metric-top"><span className="metric-icon metric-icon-flag" /><span className={`trend ${flagged ? 'warning' : 'positive'}`}>{flagged ? 'Review' : 'Clear'}</span></div><p>Needs attention</p><strong>{records.isLoading ? '—' : flagged}</strong><small>Flagged attendance entries</small></article>
        <article className="metric-card"><div className="metric-top"><span className="metric-icon metric-icon-site" /><span className="trend neutral">Active</span></div><p>Operational sites</p><strong>{sites.isLoading ? '—' : activeSites}</strong><small>Accepting attendance today</small></article>
      </section>

      <section className="records-panel">
        <div className="panel-header">
          <div><div className="panel-title-row"><h2>Attendance stream</h2><span className="live-pill"><i /> Live sync</span></div><p>Latest check-ins and check-outs from active work sites.</p></div>
          <div className="panel-tools">
            <button className={`filter-toggle ${filtersOpen ? 'active' : ''}`} onClick={() => setFiltersOpen((open) => !open)}><span className="filter-glyph" /> Filters {activeFilterCount > 0 && <b>{activeFilterCount}</b>}</button>
            <button className="secondary-button" onClick={() => download('csv')}>Download CSV</button>
          </div>
        </div>

        {filtersOpen && (
          <div className="filters records-filters">
            {isAdmin && <label>Worker<select value={filters.workerId} onChange={(e) => set({ workerId: e.target.value })}><option value="">All workers</option>{(users.data ?? []).filter((u) => u.role === 'worker').map((u) => <option key={u.id} value={u.id}>{u.name} ({u.employeeCode})</option>)}</select></label>}
            {isAdmin && <label>Site<select value={filters.siteId} onChange={(e) => set({ siteId: e.target.value })}><option value="">All sites</option>{(sites.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
            <label>Status<select value={filters.status} onChange={(e) => set({ status: e.target.value as Filters['status'] })}><option value="">Any status</option><option value="ok">Verified</option><option value="flagged">Flagged</option></select></label>
            <label>From<input type="date" value={filters.dateFrom} onChange={(e) => set({ dateFrom: e.target.value })} /></label>
            <label>To<input type="date" value={filters.dateTo} onChange={(e) => set({ dateTo: e.target.value })} /></label>
            <button className="text-button reset-button" onClick={() => setFilters(EMPTY)}>Clear filters</button>
          </div>
        )}

        <div className="table-wrap records-table-wrap">
          <table className="records-table">
            <thead><tr><th>Employee</th><th>Site & location</th><th>Entry time</th><th>Type</th><th>GPS</th><th>Status</th><th aria-label="Actions" /></tr></thead>
            <tbody>{visibleRecords.map((record) => (
              <tr key={record.id}>
                <td><div className="employee-cell"><span className="employee-avatar">{record.workerName.slice(0, 1).toUpperCase()}</span><span><strong>{record.workerName}</strong><small>{record.employeeCode}</small></span></div></td>
                <td><strong className="cell-primary">{record.siteName ?? 'Unassigned site'}</strong><small>{record.withinGeofence ? 'Inside geofence' : 'Outside geofence'}</small></td>
                <td><strong className="cell-primary">{formatTime(record.serverTimestamp)}</strong><small>{formatDay(record.serverTimestamp)}</small></td>
                <td><span className={`mark-type ${record.markType}`}>{record.markType === 'check_in' ? 'Check in' : 'Check out'}</span></td>
                <td><strong className="cell-primary">±{Math.round(record.gpsAccuracyM)} m</strong><small>{record.imageStatus}</small></td>
                <td><StatusBadge status={record.status} reviewed={Boolean(record.reviewedAt)} /></td>
                <td><Link to={`/admin/records/${record.id}`} className="row-action" aria-label={`Open ${record.workerName}'s record`}>→</Link></td>
              </tr>
            ))}</tbody>
          </table>
          {records.isLoading && <div className="table-message">Loading attendance records…</div>}
          {records.isError && <div className="table-message error">Could not load attendance records.</div>}
          {!records.isLoading && !records.isError && visibleRecords.length === 0 && <div className="empty-state"><span className="empty-icon" /><h3>No records found</h3><p>Try adjusting the filters or selecting a different date range.</p></div>}
        </div>

        <div className="pagination-bar"><span>Showing page <strong>{filters.page}</strong> of <strong>{totalPages}</strong> · {records.data?.total ?? 0} records</span><div><button disabled={filters.page <= 1} onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}>←</button><button disabled={filters.page >= totalPages} onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}>→</button></div></div>
      </section>
    </div>
  );
}
