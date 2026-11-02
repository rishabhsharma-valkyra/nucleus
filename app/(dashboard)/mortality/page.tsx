'use client';
// Mortality. There is no outcome data (discharge / death) and no validated
// prediction model yet, so this page never shows a risk percentage or an
// outcome: it used to, from a formula over PWAT plus a per-session hash, and
// in a clinical tool an invented number is worse than none. It shows what is
// actually measured (severity of current scans) and what's needed before a
// mortality view can exist.
import { useAllSessions } from '@/hooks';
import { formatDate } from '@/lib/utils';
import { sessionStatus } from '@/lib/sessionsAsIncidents';
import { HoverTooltip } from '@/components/ui/MetricCard';
import { useSession } from 'next-auth/react';
import VoiceTour, { TourStep } from '@/components/VoiceTour';

// PWAT bands (0-20, higher = more severe)
const PWAT_BANDS = [
  { label: 'Critical', min: 12, color: 'var(--red)' },
  { label: 'Urgent', min: 8, color: 'var(--amber)' },
  { label: 'Delayed', min: 4, color: 'var(--yellow, #facc15)' },
  { label: 'Minor', min: 0, color: 'var(--green)' },
];
const bandOf = (pwat: number) => PWAT_BANDS.find((b) => pwat >= b.min) ?? PWAT_BANDS[PWAT_BANDS.length - 1];

export default function MortalityPage() {
  const { data: sessionsData, isLoading } = useAllSessions();
  const sessions = sessionsData?.sessions ?? [];

  const active = sessions
    .filter((s: any) => sessionStatus(s.created_at) === 'Active')
    .sort((a: any, b: any) => (Number(b.pwat_score) || 0) - (Number(a.pwat_score) || 0));
  const counts = PWAT_BANDS.map((b) => ({ ...b, n: active.filter((s: any) => bandOf(Number(s.pwat_score) || 0).label === b.label).length }));

  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(' ')[0] || 'there';
  const PAGE_STEPS: TourStep[] = [
    {
      targetId: 'spotlight-mortality-metrics',
      tag: 'STATUS',
      title: 'Not available yet',
      script: `${firstName}, mortality prediction is not available yet. Nucleus does not record patient outcomes, and no validated prediction model exists, so this page shows no risk percentages.`,
    },
    {
      targetId: 'spotlight-mortality-active',
      tag: 'MEASURED SEVERITY',
      title: 'Current scans by severity',
      script: 'What you see here is measured: the wound severity score of every scan in the last 24 hours, most severe first.',
    },
  ];

  return (
    <div className="pb-10">
      <div id="spotlight-mortality-metrics" className="card" style={{ padding: '16px 18px', marginBottom: 20, borderLeft: '3px solid var(--amber)' }}>
        <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Mortality prediction is not available yet</div>
        <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>
          Nucleus does not record patient outcomes yet, and there is no validated mortality model, so this page shows no predicted
          risk or mortality rate. Before it can, it needs: (1) outcomes recorded by the receiving hospital (admitted, discharged,
          deceased), (2) a model trained and validated on those outcomes, and (3) clinical sign-off. Until then, use triage and the
          measured wound severity below.
        </div>
      </div>

      <div className="metrics-grid" style={{ marginBottom: 20 }}>
        <HoverTooltip tooltip="Scans recorded in the last 24 hours.">
          <div className="metric-card">
            <div className="metric-label">Active scans (24 h)</div>
            <div className="metric-value" style={{ color: 'var(--text)' }}>{isLoading ? '—' : active.length}</div>
          </div>
        </HoverTooltip>
        {counts.map((b) => (
          <HoverTooltip key={b.label} tooltip={`Active scans with a PWAT wound-severity score in the ${b.label} band.`}>
            <div className="metric-card">
              <div className="metric-label">PWAT {b.label}</div>
              <div className="metric-value" style={{ color: b.color }}>{isLoading ? '—' : b.n}</div>
            </div>
          </HoverTooltip>
        ))}
      </div>

      <div className="section-hd"><div className="section-title">Active scans · measured wound severity</div><span className="badge badge-live">LIVE</span></div>
      <div id="spotlight-mortality-active" className="card">
        {isLoading ? (
          <div style={{ padding: '20px 18px' }}>{[...Array(2)].map((_, i) => <div key={i} className="skeleton" style={{ height: 14, marginBottom: 10 }} />)}</div>
        ) : active.length === 0 ? (
          <div style={{ padding: '20px 18px', textAlign: 'center', color: 'var(--text3)', fontFamily: 'var(--mono)', fontSize: 12 }}>No scans in the last 24 hours.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Patient</th><th>Triage</th><th>PWAT</th><th>Severity band</th><th>Depth</th><th>Recorded</th></tr></thead>
              <tbody>
                {active.map((s: any) => {
                  const band = bandOf(Number(s.pwat_score) || 0);
                  return (
                    <tr key={s.session_id}>
                      <td style={{ color: 'var(--text)', fontWeight: 600 }}>{s.patient_name || s.patient_id || 'Unidentified'}</td>
                      <td><span className={`triage-badge triage-${s.triage_category} uppercase`}>{s.triage_category}</span></td>
                      <td style={{ fontFamily: 'var(--mono)', color: 'var(--text)' }}>{Number(s.pwat_score).toFixed(1)}</td>
                      <td style={{ fontFamily: 'var(--mono)', color: band.color }}>{band.label}</td>
                      <td style={{ color: 'var(--text2)' }}>{s.wound_metrics?.depth_severity ?? '—'}</td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{formatDate(s.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <VoiceTour storageKey="valkyra-tour-mortality-v2" steps={PAGE_STEPS} />
    </div>
  );
}
