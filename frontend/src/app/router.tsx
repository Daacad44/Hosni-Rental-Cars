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
const SettingsPage = lazy(() => import('../features/settings/SettingsPage'));
const ReservationListPage = lazy(() => import('../features/reservations/ReservationListPage'));
const NewReservationPage = lazy(() => import('../features/reservations/NewReservationPage'));
const ReservationDetailPage = lazy(() => import('../features/reservations/ReservationDetailPage'));
const CalendarPage = lazy(() => import('../features/reservations/CalendarPage'));
const AgreementListPage = lazy(() => import('../features/agreements/AgreementListPage'));
const AgreementDetailPage = lazy(() => import('../features/agreements/AgreementDetailPage'));
const CheckoutWizard = lazy(() => import('../features/agreements/CheckoutWizard'));
const CheckinWizard = lazy(() => import('../features/agreements/CheckinWizard'));
const InvoiceListPage = lazy(() => import('../features/invoices/InvoiceListPage'));
const InvoiceDetailPage = lazy(() => import('../features/invoices/InvoiceDetailPage'));
const CashSummaryPage = lazy(() => import('../features/invoices/CashSummaryPage'));
const MaintenancePage = lazy(() => import('../features/maintenance/MaintenancePage'));
const ExpensesPage = lazy(() => import('../features/expenses/ExpensesPage'));
const ReportsPage = lazy(() => import('../features/reports/ReportsPage'));

function Lazy({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div className="p-6 text-sm text-muted">…</div>}>{children}</Suspense>;
}

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
      { path: 'rentals', element: <Lazy><AgreementListPage /></Lazy> },
      { path: 'rentals/checkout', element: <Lazy><CheckoutWizard /></Lazy> },
      { path: 'rentals/:id', element: <Lazy><AgreementDetailPage /></Lazy> },
      { path: 'rentals/:id/checkin', element: <Lazy><CheckinWizard /></Lazy> },
      { path: 'customers', element: <Lazy><CustomerListPage /></Lazy> },
      { path: 'customers/new', element: <Lazy><CustomerFormPage /></Lazy> },
      { path: 'customers/:id', element: <Lazy><CustomerDetailPage /></Lazy> },
      { path: 'customers/:id/edit', element: <Lazy><CustomerFormPage /></Lazy> },
      { path: 'invoices', element: <Lazy><InvoiceListPage /></Lazy> },
      { path: 'invoices/cash-summary', element: <Lazy><CashSummaryPage /></Lazy> },
      { path: 'invoices/:id', element: <Lazy><InvoiceDetailPage /></Lazy> },
      {
        path: 'maintenance',
        element: (
          <RequireRole allow={['OWNER', 'MANAGER', 'MECHANIC']}>
            <Lazy><MaintenancePage /></Lazy>
          </RequireRole>
        ),
      },
      {
        path: 'expenses',
        element: (
          <RequireRole allow={['OWNER', 'MANAGER']}>
            <Lazy><ExpensesPage /></Lazy>
          </RequireRole>
        ),
      },
      {
        path: 'reports',
        element: (
          <RequireRole allow={['OWNER', 'MANAGER']}>
            <Lazy><ReportsPage /></Lazy>
          </RequireRole>
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
              <SettingsPage />
            </Lazy>
          </RequireRole>
        ),
      },
    ],
  },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
]);
