import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

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

  return (
    <div className={`admin-shell ${menuOpen ? 'menu-open' : ''}`}>
      <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />
      <aside className="admin-sidebar">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span><strong>TrackFlow</strong><small>Workforce operations</small></span>
        </div>
        <div className="workspace-switcher">
          <span className="workspace-icon">D</span>
          <span><small>Current workspace</small><strong>Dwarka Region</strong></span>
          <span className="chevron">⌄</span>
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
          <span className="status-dot" />
          <div><strong>All systems online</strong><small>Last sync just now</small></div>
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
          <div className="topbar-location"><span className="eyebrow">Live operations</span><strong>Dwarka Sector 62 Hub</strong></div>
          <div className="topbar-actions">
            <label className="global-search"><span aria-hidden="true" /><input aria-label="Search" placeholder="Search anything…" /><kbd>⌘ K</kbd></label>
            <button className="icon-button notification-button" aria-label="Notifications"><span aria-hidden="true" /><i /></button>
          </div>
        </header>
        <main className="admin-main"><Outlet /></main>
      </div>
    </div>
  );
}
