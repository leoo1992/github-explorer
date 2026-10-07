'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ChevronDown,
  Gauge,
  History,
  LogOut,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
} from 'lucide-react';
import { BrandIcon } from '@/components/brand-icon';
import styles from './app-navigation.module.css';

export type DashboardView = 'analyze' | 'history' | 'result';

type AppNavigationProps = {
  admin?: boolean;
  presetAccess?: boolean;
  dashboardView?: DashboardView;
  onDashboardViewChange?: (view: 'analyze' | 'history') => void;
};

type NavItem = {
  key: string;
  label: string;
  href: string;
  icon: typeof Gauge;
  dashboardView?: 'analyze' | 'history';
};

export function AppNavigation({
  admin = false,
  presetAccess = false,
  dashboardView,
  onDashboardViewChange,
}: AppNavigationProps) {
  const pathname = usePathname();

  const items: NavItem[] = [
    {
      key: 'analyze',
      label: 'Analisar',
      href: '/dashboard',
      icon: Gauge,
      dashboardView: 'analyze',
    },
    {
      key: 'history',
      label: 'Histórico',
      href: '/dashboard?view=history',
      icon: History,
      dashboardView: 'history',
    },
    ...(presetAccess
      ? [{
          key: 'presets',
          label: 'Presets',
          href: '/presets',
          icon: SlidersHorizontal,
        }]
      : []),
    {
      key: 'account',
      label: 'Conta',
      href: '/account',
      icon: UserRound,
    },
    ...(admin
      ? [{
          key: 'admin',
          label: 'Admin',
          href: '/admin',
          icon: ShieldCheck,
        }]
      : []),
  ];

  function isActive(item: NavItem) {
    if (pathname === '/dashboard' && item.dashboardView) {
      if (item.dashboardView === 'history') return dashboardView === 'history';
      return dashboardView !== 'history';
    }
    return pathname === item.href.split('?')[0];
  }

  function renderItem(item: NavItem, mobile = false) {
    const Icon = item.icon;
    const active = isActive(item);
    const className = [
      mobile ? styles.dockItem : styles.menuItem,
      active ? (mobile ? 'dock-active' : styles.activeItem) : '',
    ].filter(Boolean).join(' ');

    if (pathname === '/dashboard' && item.dashboardView && onDashboardViewChange) {
      return (
        <button
          className={className}
          type="button"
          onClick={() => onDashboardViewChange(item.dashboardView!)}
          aria-current={active ? 'page' : undefined}
        >
          <Icon aria-hidden="true" />
          <span className={mobile ? 'dock-label' : undefined}>{item.label}</span>
        </button>
      );
    }

    return (
      <Link
        className={className}
        href={item.href}
        aria-current={active ? 'page' : undefined}
        prefetch
      >
        <Icon aria-hidden="true" />
        <span className={mobile ? 'dock-label' : undefined}>{item.label}</span>
      </Link>
    );
  }

  return (
    <>
      <header className={['theme-header', styles.header].join(' ')}>
        <Link className={styles.brand} href="/dashboard" prefetch>
          <BrandIcon className={styles.brandIcon} />
          <span>
            <strong>RepoScope</strong>
            <small>Engineering Intelligence</small>
          </span>
        </Link>

        <div className={['dropdown', 'dropdown-end', styles.desktopMenu].join(' ')}>
          <button className="btn btn-ghost btn-sm" tabIndex={0} type="button">
            <Settings2 aria-hidden="true" />
            Navegação
            <ChevronDown aria-hidden="true" />
          </button>
          <ul
            className={['menu', 'dropdown-content', 'bg-base-100', 'rounded-box', 'z-50', 'w-56', 'p-2', 'shadow-lg', styles.dropdownContent].join(' ')}
            tabIndex={0}
          >
            {items.map((item) => <li key={item.key}>{renderItem(item)}</li>)}
            <li className={styles.menuDivider} />
            <li>
              <form action="/auth/signout" method="post">
                <button className={styles.menuItem} type="submit">
                  <LogOut aria-hidden="true" />
                  <span>Sair</span>
                </button>
              </form>
            </li>
          </ul>
        </div>
      </header>

      <nav className={['dock', styles.mobileDock].join(' ')} aria-label="Navegação principal">
        {items.slice(0, 5).map((item) => (
          <div key={item.key}>{renderItem(item, true)}</div>
        ))}
      </nav>
    </>
  );
}
