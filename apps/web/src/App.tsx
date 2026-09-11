import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { LoginPage } from './auth/LoginPage';
import { ConsentGate } from './worker/ConsentGate';
import { WorkerHome } from './worker/WorkerHome';
import { CapturePage } from './worker/CapturePage';
import { ConfirmationPage } from './worker/ConfirmationPage';
import { HistoryPage } from './worker/HistoryPage';

const AdminLayout = lazy(() => import('./admin/AdminLayout').then((m) => ({ default: m.AdminLayout })));
const RecordsPage = lazy(() => import('./admin/RecordsPage').then((m) => ({ default: m.RecordsPage })));
const RecordDetailPage = lazy(() =>
  import('./admin/RecordDetailPage').then((m) => ({ default: m.RecordDetailPage })),
);
const UsersPage = lazy(() => import('./admin/UsersPage').then((m) => ({ default: m.UsersPage })));
const SitesPage = lazy(() => import('./admin/SitesPage').then((m) => ({ default: m.SitesPage })));
const AuditPage = lazy(() => import('./admin/AuditPage').then((m) => ({ default: m.AuditPage })));

const STAFF = ['admin', 'supervisor'] as const;

function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return user.role === 'worker' ? <WorkerHome /> : <Navigate to="/admin" replace />;
}

function Worker({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute roles={['worker']}>
      <ConsentGate>{children}</ConsentGate>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<p className="muted page">Loading…</p>}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/capture" element={<Worker><CapturePage /></Worker>} />
            <Route path="/confirmation" element={<Worker><ConfirmationPage /></Worker>} />
            <Route path="/history" element={<Worker><HistoryPage /></Worker>} />

            <Route
              path="/admin"
              element={
                <ProtectedRoute roles={[...STAFF]}>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<RecordsPage />} />
              <Route path="records/:id" element={<RecordDetailPage />} />
              <Route
                path="users"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <UsersPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="sites"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <SitesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="audit"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <AuditPage />
                  </ProtectedRoute>
                }
              />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
