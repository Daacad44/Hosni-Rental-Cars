export interface DashboardKpis {
  vehiclesOut: number;
  available: number;
  inMaintenance: number;
  overdue: number;
  todayPickups: number;
  todayReturns: number;
  revenueMtd: string;
  outstanding: string;
}

export interface ScheduleItem {
  kind: 'PICKUP' | 'RETURN';
  id: string;
  label: string;
  at: string;
}

export interface Dashboard {
  kpis: DashboardKpis;
  todaySchedule: ScheduleItem[];
}

export interface RevenuePoint {
  period: string;
  revenue: string;
}

export interface RevenueReport {
  total: string;
  points: RevenuePoint[];
}

export interface ProfitabilityRow {
  vehicleId: string;
  plateNumber: string;
  revenue: string;
  expenses: string;
  maintenance: string;
  profit: string;
}

export interface OutstandingRow {
  invoiceId: string;
  invoiceNumber: number;
  customerName: string;
  balance: string;
  ageDays: number;
  bucket: '0-30' | '31-60' | '61-90' | '90+';
}

export interface UtilizationRow {
  vehicleId: string;
  plateNumber: string;
  rentedDays: number;
  availableDays: number;
  utilizationPct: number;
}

export interface OverdueRow {
  agreementId: string;
  agreementNumber: number;
  customerName: string;
  vehiclePlate: string;
  dueAt: string;
  overdueDays: number;
}
