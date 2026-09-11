import { Navigate } from 'react-router-dom';
import type { Role } from '@ams/shared';
import { useAuth } from './AuthContext';

function homeFor(role: Role): string {
  return role === 'worker' ? '/' : '/admin';
}

export function ProtectedRoute({
  roles,
  children,
}: {
  roles?: Role[];
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={homeFor(user.role)} replace />;
  }
  return <>{children}</>;
}
