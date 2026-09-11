import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { StatusBadge } from '../components/StatusBadge';

export function WorkerHome() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { data } = useQuery({ queryKey: ['me', 1], queryFn: () => api.myRecords(1) });

  const today = new Date().toDateString();
  const todays = (data?.data ?? []).filter(
    (r) => new Date(r.serverTimestamp).toDateString() === today,
  );

  return (
    <div className="stack page">
      <header className="row-between">
        <div>
          <h1>Hello, {user?.name}</h1>
          <p className="muted">{user?.employeeCode}</p>
        </div>
        <button className="link" onClick={logout}>
          Sign out
        </button>
      </header>

      <div className="row gap">
        <button className="big primary" onClick={() => navigate('/capture?type=check_in')}>
          Check In
        </button>
        <button className="big" onClick={() => navigate('/capture?type=check_out')}>
          Check Out
        </button>
      </div>

      <section className="stack">
        <h2>Today</h2>
        {todays.length === 0 && <p className="muted">No marks yet today.</p>}
        {todays.map((r) => (
          <div key={r.id} className="card row-between">
            <div>
              <strong>{r.markType === 'check_in' ? 'Check In' : 'Check Out'}</strong>
              <div className="muted">
                {new Date(r.serverTimestamp).toLocaleTimeString()} · {r.address ?? 'address pending'}
              </div>
            </div>
            <StatusBadge status={r.status} />
          </div>
        ))}
        <Link to="/history" className="link">
          View full history →
        </Link>
      </section>
    </div>
  );
}
