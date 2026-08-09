import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RequireAuth, RequireRole } from './RequireAuth';

const LoginPage = lazy(() => import('../features/auth/LoginPage'));
const DashboardPage = lazy(() => import('../features/dashboard/DashboardPage'));
const UsersPage = lazy(() => import('../features/users/UsersPage'));
const FleetListPage = lazy(() => import('../features/fleet/FleetListPage'));
const VehicleFormPage = lazy(() => import('../features/fleet/VehicleFormPage'));
const VehicleDetailPage = lazy(() => import('../features/fleet/VehicleDetailPage'));
const CustomerListPage = lazy(() => import('../features/customers/CustomerListPage'));
const CustomerFormPage = lazy(() => import('../features/customers/CustomerFormPage'));
const CustomerDetailPage = lazy(() => import('../features/customers/CustomerDetailPage'));
const RateCardsPage = lazy(() => import('../features/settings/RateCardsPage'));
const ReservationListPage = lazy(() => import('../features/reservations/ReservationListPage'));
const NewReservationPage = lazy(() => import('../features/reservations/NewReservationPage'));
const ReservationDetailPage = lazy(() => import('../features/reservations/ReservationDetailPage'));
const CalendarPage = lazy(() => import('../features/reservations/CalendarPage'));
const PlaceholderPage = lazy(() => import('../routes/PlaceholderPage'));

function Lazy({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div className="p-6 text-sm text-muted">…</div>}>{children}</Suspense>;
}

const placeholder = (titleKey: string) => (
  <Lazy>
    <PlaceholderPage titleKey={titleKey} />
  </Lazy>
);

export const router = createBrowserRouter([
  { path: '/login', element: <Lazy><LoginPage /></Lazy> },
  {
    path: '/',
    element: <RequireAuth />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <Lazy><DashboardPage /></Lazy> },
      { path: 'fleet', element: <Lazy><FleetListPage /></Lazy> },
      { path: 'fleet/new', element: <Lazy><VehicleFormPage /></Lazy> },
      { path: 'fleet/:id', element: <Lazy><VehicleDetailPage /></Lazy> },
      { path: 'fleet/:id/edit', element: <Lazy><VehicleFormPage /></Lazy> },
      { path: 'reservations', element: <Lazy><ReservationListPage /></Lazy> },
      { path: 'reservations/new', element: <Lazy><NewReservationPage /></Lazy> },
      { path: 'reservations/calendar', element: <Lazy><CalendarPage /></Lazy> },
      { path: 'reservations/:id', element: <Lazy><ReservationDetailPage /></Lazy> },
      { path: 'rentals', element: placeholder('nav.rentals') },
      { path: 'customers', element: <Lazy><CustomerListPage /></Lazy> },
      { path: 'customers/new', element: <Lazy><CustomerFormPage /></Lazy> },
      { path: 'customers/:id', element: <Lazy><CustomerDetailPage /></Lazy> },
      { path: 'customers/:id/edit', element: <Lazy><CustomerFormPage /></Lazy> },
      { path: 'invoices', element: placeholder('nav.invoices') },
      { path: 'maintenance', element: placeholder('nav.maintenance') },
      { path: 'expenses', element: placeholder('nav.expenses') },
      {
        path: 'reports',
        element: (
          <RequireRole allow={['OWNER', 'MANAGER']}>{placeholder('nav.reports')}</RequireRole>
        ),
      },
      {
        path: 'users',
        element: (
          <RequireRole allow={['OWNER', 'MANAGER']}>
            <Lazy>
              <UsersPage />
            </Lazy>
          </RequireRole>
        ),
      },
      {
        path: 'settings',
        element: (
          <RequireRole allow={['OWNER']}>
            <Lazy>
              <RateCardsPage />
            </Lazy>
          </RequireRole>
        ),
      },
    ],
  },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
]);
