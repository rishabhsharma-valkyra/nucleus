'use client';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNucleusStore } from '@/store/useNucleusStore';
import { usePermission } from '@/hooks';
import { PERMISSIONS } from '@/lib/rbac';
import AlertBell from '@/components/ui/AlertBell';

const TITLES: Record<string, string> = {
  '/overview':       'Command Overview',
  '/incidents':      'Live Incidents',
  '/analytics':      'Analytics',
  '/reports':        'Incident Reports',
  '/responders':     'Responders',
  '/devices':        'AR Devices',
  '/ai-performance': 'Model Performance',
  '/heatmaps':       'Heatmaps',
  '/escalations':    'Escalation Frequency',
  '/mortality':      'Mortality Rate',
  '/settings':       'Settings',
  '/training-intel': 'Training Intelligence',
  '/my-sessions':    'My Sessions',
};

export default function Topbar() {
  const pathname = usePathname();
  const [clock, setClock] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const qc = useQueryClient();
  const setIncidentModalOpen = useNucleusStore((s) => s.setIncidentModalOpen);
  const canCreateIncident = usePermission(PERMISSIONS.INCIDENTS_CREATE);

  // --- Clock Engine ---
  useEffect(() => {
    const tick = () => {
      const n = new Date();
      const h = n.getHours(), m = n.getMinutes(), s = n.getSeconds();
      const ap = h >= 12 ? 'PM' : 'AM';
      const hh = (h % 12 || 12).toString().padStart(2, '0');
      setClock(`${hh}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')} ${ap}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // --- Auto-Refresh Engine (Simulated WebSocket) ---
  useEffect(() => {
    // Automatically refetch all active queries every 15 seconds
    const autoRefreshId = setInterval(() => {
      qc.invalidateQueries();
    }, 15000);
    return () => clearInterval(autoRefreshId);
  }, [qc]);

  // --- Manual Refresh Handler ---
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await qc.invalidateQueries();
    // Simulate a brief minimum delay so the user sees the spin animation
    setTimeout(() => setIsRefreshing(false), 600);
  };

  return (
    <div className="topbar">
      <div>
        <div className="page-title">{TITLES[pathname] ?? 'Nucleus'}</div>
        <div className="page-sub">
          Valkyra Hospital API · <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)' }}>{clock}</span>
        </div>
      </div>
      <div className="topbar-right">
        <div className="status-pill">
          <div className="pulse-dot" />
          LIVE
        </div>
        <AlertBell />
        <button
          className="btn flex items-center gap-2"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <svg
            className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {isRefreshing ? 'SYNCING...' : 'REFRESH'}
        </button>

        {canCreateIncident && (
          <button className="btn btn-accent" onClick={() => setIncidentModalOpen(true)}>
            + New Incident
          </button>
        )}
      </div>
    </div>
  );
}