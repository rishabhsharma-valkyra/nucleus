'use client';
import { useState } from 'react';
import { useMySessions } from '@/hooks';
import { useNucleusStore } from '@/store/useNucleusStore';
import { pwatColor, triageClass, formatDate, depthSeverityColor } from '@/lib/utils';
import { MetricInfo, METRIC_DESCRIPTIONS as info } from '@/components/ui/MetricInfo';

// 🛡️ IMPORTS FOR THE PERSONALIZED VOICE TOUR
import { useSession } from 'next-auth/react';
import VoiceTour, { TourStep } from '@/components/VoiceTour';

// Patient-facing view — shows only sessions belonging to the signed-in
// user (enforced server-side in app/api/my-sessions/route.ts, not just
// filtered here).
export default function MySessionsPage() {
  const { data, isLoading } = useMySessions(50, 0);
  const setActivePatientId = useNucleusStore((s) => s.setActivePatientId);
  const [search, setSearch] = useState('');

  const sessions = data?.sessions ?? [];
  const filtered = sessions.filter(
    s => !search || s.session_id.toLowerCase().includes(search.toLowerCase())
  );

  // 🛡️ EXTRACT USER NAME AND GRAB THE FIRST AVAILABLE SESSION
  const { data: sessionData } = useSession();
  const firstName = sessionData?.user?.name?.split(' ')[0] || 'Officer';
  const firstSessionId = filtered.length > 0 ? filtered[0].session_id : null;

  // 🛡️ DYNAMIC SIMULATION STEPS
  const PAGE_STEPS: TourStep[] = [
    {
      targetId: 'spotlight-my-search',
      tag: 'PERSONAL LOGS',
      title: 'My Sessions',
      script: `Welcome to your personal logs, ${firstName}. You can use this module to quickly retrieve specific cases you've managed.`
    },
    {
      targetId: 'spotlight-my-table',
      tag: 'CLINICAL TELEMETRY',
      title: 'Wound Metrics',
      script: 'This table tracks the recovery trajectories of your patients, logging Triage severity and Photographic Wound Assessment Tool scores.'
    },
    {
      targetId: 'spotlight-modal-container', // Highlights the entire modal box
      tag: 'CASE DETAILS',
      title: 'Telemetry & Export',
      script: 'Opening an incident reveals the full telemetry file. From here, you can review the clinical analysis or export a PDF brief. Briefing complete.',
      action: () => {
        // Automatically open the modal right before the Sentinel speaks!
        if (firstSessionId) setActivePatientId(firstSessionId);
      }
    }
  ];

  return (
    <>
      <div className="section-hd">
        <div className="section-title">My Wound Sessions</div>
      </div>

      {/* 🛡️ TARGET 1: Search Bar */}
      <div id="spotlight-my-search" style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <input
          className="form-input"
          placeholder="Search session ID..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: 220, padding: '6px 12px', fontSize: 12 }}
        />
      </div>

      {/* 🛡️ TARGET 2: The Main Table */}
      <div id="spotlight-my-table" className="card">
        <div className="card-header">
          <span className="card-title">Sessions</span>
          <span className="badge badge-live">{filtered.length} RESULTS</span>
        </div>
        {isLoading ? (
          <div style={{ padding: '20px 18px' }}>
            {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 14, marginBottom: 10 }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '20px 18px', textAlign: 'center', color: 'var(--text3)', fontFamily: 'var(--mono)', fontSize: 12 }}>
            No sessions found for your account yet.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Session ID</th>
                <th><MetricInfo label="Triage" description={info.triage} /></th>
                <th><MetricInfo label="PWAT" description={info.pwat} /></th>
                <th><MetricInfo label="Depth" description={info.depthSeverity} /></th>
                <th><MetricInfo label="Area %" description={info.woundArea} /></th>
                <th>Recorded</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const wm = s.wound_metrics ?? {} as any;

                // Format PWAT to 1 decimal to prevent clipping
                const rawPwat = s.pwat_score;
                const displayPwat = (rawPwat != null && !isNaN(Number(rawPwat))) 
                  ? Number(rawPwat).toFixed(1) 
                  : '—';

                return (
                  <tr key={s.session_id} style={{ cursor: 'pointer' }} onClick={() => setActivePatientId(s.session_id)}>
                    <td style={{ fontFamily: 'var(--mono)', color: 'var(--text)', fontWeight: 600, fontSize: 11 }}>{s.session_id}</td>
                    <td><span className={`feed-type ${triageClass(s.triage_category)}`}>{s.triage_category}</span></td>
                    <td style={{ color: pwatColor(Number(displayPwat)), fontWeight: 700, fontFamily: 'var(--mono)' }}>{displayPwat}</td>
                    <td style={{ color: depthSeverityColor(wm.depth_severity), fontFamily: 'var(--mono)', fontSize: 11 }}>{wm.depth_severity ?? '—'}</td>
                    <td style={{ fontFamily: 'var(--mono)' }}>{wm.area_pct != null ? Number(wm.area_pct).toFixed(1) + '%' : '—'}</td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{formatDate(s.created_at)}</td>
                    <td><span style={{ fontSize: 10, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>Open →</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 🛡️ INJECT THE TOUR ENGINE */}
      <VoiceTour 
        storageKey="valkyra-tour-my-sessions" 
        steps={PAGE_STEPS} 
        onTourEnd={() => setActivePatientId(null)} // Automatically closes the modal when the tour ends!
      />
    </>
  );
}