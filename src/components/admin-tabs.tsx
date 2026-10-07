'use client';

import {
  Activity,
  CreditCard,
  LayoutDashboard,
  MonitorSmartphone,
  ReceiptText,
  Users,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import styles from '@/app/admin/page.module.css';

type AdminTab = 'overview' | 'users' | 'subscriptions' | 'sessions' | 'payments' | 'analyses';

const tabs: Array<{ id: AdminTab; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'overview', label: 'Visão geral', icon: LayoutDashboard },
  { id: 'users', label: 'Usuários', icon: Users },
  { id: 'subscriptions', label: 'Assinaturas', icon: CreditCard },
  { id: 'sessions', label: 'Sessões', icon: MonitorSmartphone },
  { id: 'payments', label: 'Pagamentos', icon: ReceiptText },
  { id: 'analyses', label: 'Análises', icon: Activity },
];

export function AdminTabs({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<AdminTab>('overview');

  return (
    <>
      <nav className={['tabs', 'tabs-box', styles.adminTabs].join(' ')} role="tablist" aria-label="Áreas administrativas">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              className={active === tab.id ? 'tab tab-active' : 'tab'}
              type="button"
              role="tab"
              aria-selected={active === tab.id}
              key={tab.id}
              onClick={() => setActive(tab.id)}
            >
              <Icon aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
      <div className={styles.adminTabBody} data-active={active}>
        {children}
      </div>
    </>
  );
}
