import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { api } from '../lib/api';

const navItems = [
  { to: '/admin', end: true, label: 'Overview & records', icon: 'overview' },
  { to: '/admin/users', label: 'People', icon: 'people', adminOnly: true },
  { to: '/admin/sites', label: 'Sites & geofences', icon: 'sites', adminOnly: true },
  { to: '/admin/audit', label: 'Audit trail', icon: 'audit', adminOnly: true },
  { to: '/admin/settings', label: 'Settings', icon: 'settings' },
];

function initials(name?: string) {
  return (name ?? 'User').split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

export function AdminLayout() {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [menuOpen, setMenuOpen] = useState(false);

  // Real backend status, not a decorative claim — checked on load and every 30s.
  const health = useQuery({
    queryKey: ['health'],
    queryFn: api.health,
    refetchInterval: 30_000,
    retry: false,
  });
  const isOnline = health.data?.status === 'ok' && health.data.db;
  const statusLabel = health.isLoading ? 'Checking…' : isOnline ? 'All systems online' : 'Connection issue';
  const statusDetail = health.data
    ? `Checked ${new Date(health.data.timestamp).toLocaleTimeString()}`
    : health.isError
      ? 'Could not reach the API'
      : '';

  return (
    <div className={`admin-shell ${menuOpen ? 'menu-open' : ''}`}>
      <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />
      <aside className="admin-sidebar">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span><strong>TrackFlow</strong><small>Workforce operations</small></span>
        </div>
        <nav className="side-nav" aria-label="Primary navigation">
          <p>Workspace</p>
          {navItems.filter((item) => !item.adminOnly || isAdmin).map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setMenuOpen(false)}>
              <span className={`nav-icon nav-icon-${item.icon}`} aria-hidden="true" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className={`status-dot ${isOnline ? '' : 'offline'}`} />
          <div><strong>{statusLabel}</strong><small>{statusDetail}</small></div>
        </div>
        <div className="sidebar-profile">
          <span className="avatar">{initials(user?.name)}</span>
          <span className="profile-copy"><strong>{user?.name}</strong><small>{isAdmin ? 'Administrator' : 'Supervisor'}</small></span>
          <button className="icon-button signout-button" onClick={logout} title="Sign out" aria-label="Sign out">↗</button>
        </div>
      </aside>
      <div className="admin-content">
        <header className="admin-topbar">
          <button className="icon-button menu-button" onClick={() => setMenuOpen((open) => !open)} aria-label="Toggle navigation" aria-expanded={menuOpen}>
            <span /><span /><span />
          </button>
        </header>
        <main className="admin-main"><Outlet /></main>
      </div>
    </div>
  );
}
