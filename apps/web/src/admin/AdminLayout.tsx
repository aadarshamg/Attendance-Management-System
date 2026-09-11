import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function AdminLayout() {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'admin';

  return (
    <div className="admin-shell">
      <nav className="admin-nav">
        <div className="brand">Attendance {isAdmin ? 'Admin' : 'Supervisor'}</div>
        <NavLink to="/admin" end>
          Records
        </NavLink>
        {isAdmin && <NavLink to="/admin/users">Workers &amp; staff</NavLink>}
        {isAdmin && <NavLink to="/admin/sites">Sites</NavLink>}
        {isAdmin && <NavLink to="/admin/audit">Audit log</NavLink>}
        <div className="spacer" />
        <span className="muted">{user?.name}</span>
        <button className="link" onClick={logout}>
          Sign out
        </button>
      </nav>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
