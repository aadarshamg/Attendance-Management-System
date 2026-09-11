import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

const ACTIONS = [
  '',
  'auth.login',
  'consent.given',
  'attendance.mark',
  'attendance.review',
  'attendance.export',
  'image.purged',
  'user.create',
  'user.update',
  'user.deactivate',
  'site.create',
  'site.update',
  'site.deactivate',
];

export function AuditPage() {
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (action) p.set('action', action);
    p.set('page', String(page));
    p.set('limit', '50');
    return p;
  }, [action, page]);

  const audit = useQuery({
    queryKey: ['audit', params.toString()],
    queryFn: () => api.adminAudit(params),
  });

  const totalPages = audit.data ? Math.max(1, Math.ceil(audit.data.total / audit.data.limit)) : 1;

  return (
    <div className="stack">
      <h1>Audit log</h1>
      <div className="card filters">
        <label>
          Action
          <select
            value={action}
            onChange={(e) => {
              setPage(1);
              setAction(e.target.value);
            }}
          >
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a || 'All'}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Target</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {(audit.data?.data ?? []).map((e) => (
              <tr key={e.id}>
                <td>{new Date(e.createdAt).toLocaleString()}</td>
                <td>{e.actorName ?? e.actorId ?? 'system'}</td>
                <td>{e.action}</td>
                <td>
                  {e.targetType}
                  {e.targetId ? ` · ${e.targetId.slice(0, 8)}` : ''}
                </td>
                <td>
                  <code className="details">
                    {e.detailsJson ? JSON.stringify(e.detailsJson) : '—'}
                  </code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="row gap center">
        <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          Prev
        </button>
        <span className="muted">
          Page {page} / {totalPages} · {audit.data?.total ?? 0} entries
        </span>
        <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}
