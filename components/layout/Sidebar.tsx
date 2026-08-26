'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useSummary, usePermission, useRole } from '@/hooks';
import { ROLE_LABELS, PERMISSIONS } from '@/lib/rbac';
import { DEV_ROLE_SWITCH_ENABLED, readDevRoleCookie, clearDevRoleCookie } from '@/lib/devRole';
import { DEVICES } from '@/config/fleet';
import { getDeviceAlerts } from '@/lib/deviceAlerts';
import SidebarBotPresence from '@/components/SidebarBotPresence';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: boolean;
}

interface NavGroup {
  section: string;
  items: NavItem[];
}

const PATIENT_NAV: NavGroup[] = [
  {
    section: 'My Care',
    items: [
      { href: '/my-sessions', label: 'My Sessions', icon: <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="12" height="12" rx="2"/><path d="M5 7h6M5 10h4"/></svg> },
    ],
  },
  {
    section: 'System',
    items: [
      { href: '/settings', label: 'Settings', icon: <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="2"/><path d="M8 2v2M8 12v2M2 8h2M12 8h2M3.8 3.8l1.4 1.4M10.8 10.8l1.4 1.4M3.8 12.2l1.4-1.4M10.8 5.2l1.4-1.4"/></svg> },
    ],
  },
];

const NAV: NavGroup[] = [
  {
    section: 'Command',
    items: [
      { href: '/overview',   label: 'Overview',        icon: <svg className="nav-icon" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="1" width="6" height="6" rx="1.5"/><rect x="9" y="1" width="6" height="6" rx="1.5"/><rect x="1" y="9" width="6" height="6" rx="1.5"/><rect x="9" y="9" width="6" height="6" rx="1.5"/></svg> },
      { href: '/incidents',  label: 'Live Incidents',  icon: <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="6"/><path d="M8 5v3l2 2"/></svg>, badge: false },
      { href: '/analytics',  label: 'Analytics',       icon: <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 13L5 9l3 2.5 3-4.5 3-3"/></svg> },
    ],
  },
  {
    section: 'Operations',
    items: [
      { href: '/reports',    label: 'Incident Reports', icon: <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="12" height="12" rx="2"/><path d="M5 7h6M5 10h4"/></svg> },
      { href: '/responders', label: 'Responders',       icon: <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="5" r="2.5"/><path d="M2.5 14c0-3 2.5-5 5.5-5s5.5 2 5.5 5"/></svg> },
      { href: '/devices',    label: 'AR Devices',       icon: <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="4" width="10" height="8" rx="1.5"/><path d="M11 7l4 2-4 2V7z"/></svg>, badge: true },
    ],
  },
  {
    section: 'Intelligence',
    items: [
      { href: '/training-intel',    label: 'Training Intelligence',       icon: (
              <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/>
              </svg>
            ) },
      { href: '/ai-performance', label: 'AI Performance',      icon: <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="5.5"/><path d="M8 5.5v3l1.5 1.5"/></svg> },
      { href: '/escalations',    label: 'Escalation Frequency', icon: <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 2L14.5 13.5H1.5L8 2Z"/><path d="M8 6.5v3M8 11.5h.01"/></svg> },
      { href: '/mortality',      label: 'Mortality Rate',       icon: <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 13.5S2 9.7 2 5.9A2.6 2.6 0 0 1 6.9 4.3 2.6 2.6 0 0 1 8 5.3 2.6 2.6 0 0 1 9.1 4.3 2.6 2.6 0 0 1 14 5.9C14 9.7 8 13.5 8 13.5Z"/><path d="M4 8h2l1-2 2 4 1-2h2"/></svg> },
      { href: '/heatmaps',       label: 'Heatmaps',            icon: <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 11l3-4 3 3 2.5-4L14 2"/><path d="M2 14h12"/></svg> },
    ],
  },
  {
    section: 'System',
    items: [
      { href: '/settings', label: 'Settings', icon: <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="2"/><path d="M8 2v2M8 12v2M2 8h2M12 8h2M3.8 3.8l1.4 1.4M10.8 10.8l1.4 1.4M3.8 12.2l1.4-1.4M10.8 5.2l1.4-1.4"/></svg> },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = useRole();
  const canViewOperations = usePermission(PERMISSIONS.OPERATIONS_VIEW);
  const canViewAiPerformance = usePermission(PERMISSIONS.AI_PERFORMANCE_VIEW);
  const canViewAnalytics = usePermission(PERMISSIONS.ANALYTICS_VIEW);
  const canViewResponders = usePermission(PERMISSIONS.RESPONDERS_VIEW);
  const canViewDevices = usePermission(PERMISSIONS.DEVICES_VIEW);
  const isTestOverride = DEV_ROLE_SWITCH_ENABLED && !!readDevRoleCookie();
  const { data: summary } = useSummary(canViewOperations);
  const redCount = summary?.triage_distribution?.Red?.count ?? 0;
  const deviceAlertCount = getDeviceAlerts(DEVICES).length;
  const badgeCounts: Record<string, number> = { '/incidents': redCount, '/devices': deviceAlertCount };
  const restrictedRoutes: Record<string, boolean> = {
    '/ai-performance': canViewAiPerformance,
    '/analytics': canViewAnalytics,
    '/responders': canViewResponders,
    '/devices': canViewDevices,
  };
  const nav = (canViewOperations ? NAV : PATIENT_NAV)
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => restrictedRoutes[item.href] ?? true),
    }))
    .filter((group) => group.items.length > 0);

  const initials = session?.user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() ?? 'US';

  return (
    <aside className="sidebar">
      <div className="logo-area">
        <div className="logo">
          <div className="logo-mark">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
              <path d="M8 2L13 5.5V10.5L8 14L3 10.5V5.5L8 2Z" fill="rgba(255,255,255,0.35)" />
              <path d="M8 5L11 7V9L8 11L5 9V7L8 5Z" fill="#fff" />
            </svg>
          </div>
          <span className="logo-text">Valkyra</span>
        </div>
        <div className="logo-sub">Nucleus</div>
      </div>

      <nav className="nav">
        {nav.map((group) => (
          <div key={group.section}>
            <div className="nav-section">{group.section}</div>
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item${pathname === item.href ? ' active' : ''}`}
              >
                {item.icon}
                {item.label}
                {item.badge && (badgeCounts[item.href] ?? 0) > 0 && (
                  <span className="nav-badge">{badgeCounts[item.href]}</span>
                )}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      {canViewOperations && <SidebarBotPresence alert={redCount > 0} />}

      <div className="sidebar-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, padding: '0 2px' }}>
          <div className="api-dot api-ok" />
          <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>API Connected</span>
        </div>
        <div className="user-chip" onClick={() => signOut({ callbackUrl: '/auth/signin' })}>
          <div className="avatar">{initials}</div>
          <div>
            <div className="user-name">{session?.user?.name ?? 'User'}</div>
            <div className="user-role">
              {role ? ROLE_LABELS[role] : ''}{isTestOverride ? ' (TEST)' : ''} · Click to sign out
            </div>
          </div>
        </div>
        {isTestOverride && (
          <div
            onClick={(e) => { e.stopPropagation(); clearDevRoleCookie(); window.location.reload(); }}
            style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--mono)', textAlign: 'center', marginTop: 6, cursor: 'pointer', textDecoration: 'underline' }}
          >
            Clear test role
          </div>
        )}
      </div>
    </aside>
  );
}
