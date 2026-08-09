import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Role } from '@hosni/shared';
import {
  LayoutDashboard,
  Car,
  CalendarClock,
  FileText,
  Users as UsersIcon,
  Receipt,
  Wrench,
  Banknote,
  BarChart3,
  Settings,
  UserCog,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../lib/cn';

interface NavItem {
  to: string;
  labelKey: string;
  icon: LucideIcon;
  roles?: Role[];
}

const items: NavItem[] = [
  { to: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { to: '/fleet', labelKey: 'nav.fleet', icon: Car },
  { to: '/reservations', labelKey: 'nav.reservations', icon: CalendarClock },
  { to: '/rentals', labelKey: 'nav.rentals', icon: FileText },
  { to: '/customers', labelKey: 'nav.customers', icon: UsersIcon },
  { to: '/invoices', labelKey: 'nav.invoices', icon: Receipt },
  { to: '/maintenance', labelKey: 'nav.maintenance', icon: Wrench },
  { to: '/expenses', labelKey: 'nav.expenses', icon: Banknote },
  { to: '/reports', labelKey: 'nav.reports', icon: BarChart3, roles: ['OWNER', 'MANAGER'] },
  { to: '/users', labelKey: 'nav.users', icon: UserCog, roles: ['OWNER', 'MANAGER'] },
  { to: '/settings', labelKey: 'nav.settings', icon: Settings, roles: ['OWNER'] },
];

export function Sidebar({ role }: { role: Role }) {
  const { t } = useTranslation();
  const visible = items.filter((i) => !i.roles || i.roles.includes(role));

  return (
    <nav
      aria-label={t('app.name')}
      className="flex h-full w-sidebar flex-col gap-1 bg-primary px-3 py-4"
    >
      <div className="mb-4 px-2 text-lg font-bold text-white">{t('app.name')}</div>
      {visible.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex min-h-[44px] items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors duration-150',
                isActive
                  ? 'bg-white/10 text-white'
                  : 'text-white/70 hover:bg-white/5 hover:text-white',
              )
            }
          >
            <Icon size={18} aria-hidden />
            <span>{t(item.labelKey)}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
