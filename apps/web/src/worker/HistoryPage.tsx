import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { FlagReasons, StatusBadge } from '../components/StatusBadge';

export function HistoryPage() {
  const { data, isLoading } = useQuery({ queryKey: ['me', 1], queryFn: () => api.myRecords(1) });

  return (
    <div className="stack page">
      <header className="row-between">
        <h1>My attendance</h1>
        <Link to="/" className="link">
          ← Home
        </Link>
      </header>
      {isLoading && <p className="muted">Loading…</p>}
      {(data?.data ?? []).map((r) => (
        <div key={r.id} className="card stack">
          <div className="row-between">
            <strong>{r.markType === 'check_in' ? 'Check In' : 'Check Out'}</strong>
            <StatusBadge status={r.status} />
          </div>
          <div>{new Date(r.serverTimestamp).toLocaleString()}</div>
          <div className="muted">{r.address ?? '—'}</div>
          <FlagReasons reasons={r.flagReasons} />
        </div>
      ))}
      {data && data.data.length === 0 && <p className="muted">No records yet.</p>}
    </div>
  );
}
