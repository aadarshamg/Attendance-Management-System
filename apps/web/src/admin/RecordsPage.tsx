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

export function RecordsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const params = useMemo(() => toParams(filters), [filters]);

  const sites = useQuery({ queryKey: ['sites'], queryFn: api.sites });
  const users = useQuery({ queryKey: ['users'], queryFn: api.users, enabled: isAdmin });
  const records = useQuery({
    queryKey: ['admin-records', params.toString()],
    queryFn: () => api.adminRecords(params),
  });

  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, page: 1, ...patch }));
  const totalPages = records.data
    ? Math.max(1, Math.ceil(records.data.total / records.data.limit))
    : 1;

  return (
    <div className="stack">
      <h1>Attendance records</h1>

      <div className="filters card">
        {isAdmin && (
          <label>
            Worker
            <select value={filters.workerId} onChange={(e) => set({ workerId: e.target.value })}>
              <option value="">All</option>
              {(users.data ?? [])
                .filter((u) => u.role === 'worker')
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.employeeCode})
                  </option>
                ))}
            </select>
          </label>
        )}
        {isAdmin && (
          <label>
            Site
            <select value={filters.siteId} onChange={(e) => set({ siteId: e.target.value })}>
              <option value="">All</option>
              {(sites.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Status
          <select
            value={filters.status}
            onChange={(e) => set({ status: e.target.value as Filters['status'] })}
          >
            <option value="">All</option>
            <option value="ok">OK</option>
            <option value="flagged">Flagged</option>
          </select>
        </label>
        <label>
          From
          <input type="date" value={filters.dateFrom} onChange={(e) => set({ dateFrom: e.target.value })} />
        </label>
        <label>
          To
          <input type="date" value={filters.dateTo} onChange={(e) => set({ dateTo: e.target.value })} />
        </label>
        <div className="row gap">
          <button onClick={() => setFilters(EMPTY)}>Reset</button>
          <button
            onClick={() =>
              api.download(api.exportUrl(params, 'csv'), 'attendance.csv').catch((e) => alert(e.message))
            }
          >
            Export CSV
          </button>
          <button
            onClick={() =>
              api
                .download(api.exportUrl(params, 'xlsx'), 'attendance.xls')
                .catch((e) => alert(e.message))
            }
          >
            Export Excel
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>When (server)</th>
              <th>Worker</th>
              <th>Site</th>
              <th>Type</th>
              <th>Geofence</th>
              <th>Accuracy</th>
              <th>Status</th>
              <th>Image</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(records.data?.data ?? []).map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.serverTimestamp).toLocaleString()}</td>
                <td>
                  {r.workerName}
                  <div className="muted">{r.employeeCode}</div>
                </td>
                <td>{r.siteName ?? '—'}</td>
                <td>{r.markType === 'check_in' ? 'In' : 'Out'}</td>
                <td>{r.withinGeofence ? 'inside' : 'outside'}</td>
                <td>±{Math.round(r.gpsAccuracyM)} m</td>
                <td>
                  <StatusBadge status={r.status} reviewed={Boolean(r.reviewedAt)} />
                </td>
                <td>{r.imageStatus}</td>
                <td>
                  <Link to={`/admin/records/${r.id}`} className="link">
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {records.data && records.data.data.length === 0 && (
          <p className="muted pad">No records match.</p>
        )}
      </div>

      <div className="row gap center">
        <button
          disabled={filters.page <= 1}
          onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
        >
          Prev
        </button>
        <span className="muted">
          Page {filters.page} / {totalPages} · {records.data?.total ?? 0} records
        </span>
        <button
          disabled={filters.page >= totalPages}
          onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
        >
          Next
        </button>
      </div>
    </div>
  );
}
