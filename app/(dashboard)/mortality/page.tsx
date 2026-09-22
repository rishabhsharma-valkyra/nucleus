'use client';
import { motion } from 'framer-motion';
import { useAllSessions } from '@/hooks';
import { formatDate } from '@/lib/utils';
import { predictedRiskFromPwat, predictedOutcomeDeceased } from '@/lib/risk';
import { sessionStatus } from '@/lib/sessionsAsIncidents';
import { HoverTooltip } from '@/components/ui/MetricCard';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// 🛡️ IMPORTS FOR THE PERSONALIZED VOICE TOUR
import { useSession } from 'next-auth/react';
import VoiceTour, { TourStep } from '@/components/VoiceTour';

const riskColor = (pct: number) => pct >= 20 ? 'var(--red)' : pct >= 10 ? 'var(--amber)' : 'var(--green)';

export default function MortalityPage() {
  const { data: sessionsData, isLoading } = useAllSessions();
  const sessions = sessionsData?.sessions ?? [];

  const active = sessions.filter((s: any) => sessionStatus(s.created_at) === 'Active');
  const resolved = sessions.filter((s: any) => sessionStatus(s.created_at) === 'Resolved');

  const activeWithRisk = active
    .map((s: any) => ({ ...s, id: s.session_id, risk: predictedRiskFromPwat(s.pwat_score, s.session_id) }))
    .sort((a: any, b: any) => b.risk - a.risk);

  const avgActiveRisk = active.length > 0 ? activeWithRisk.reduce((sum: number, i: any) => sum + i.risk, 0) / active.length : 0;
  const highestRisk = activeWithRisk[0];

  const resolvedWithOutcome = resolved.map((s: any) => ({
    ...s,
    id: s.session_id,
    risk: predictedRiskFromPwat(s.pwat_score, s.session_id),
    deceased: predictedOutcomeDeceased(s.pwat_score, s.session_id),
  }));
  const overallMortalityRate = resolvedWithOutcome.length > 0
    ? (resolvedWithOutcome.filter((i: any) => i.deceased).length / resolvedWithOutcome.length) * 100
    : 0;

  // Grouped by triage category (the real severity signal sessions carry)
  // rather than a fabricated injury type. Derived from whatever categories
  // actually appear in the data (including "Unclassified", the subscriber's
  // real fallback default for older rows written before triage was set)
  // instead of a hardcoded Red/Orange/Yellow/Green list that silently drops
  // anything else.
  const TRIAGE_ORDER = ['Red', 'Orange', 'Yellow', 'Green', 'Unclassified'];
  const presentTriages = Array.from(new Set(resolvedWithOutcome.map((i: any) => i.triage_category as string)))
    .sort((a, b) => {
      const ai = TRIAGE_ORDER.indexOf(a), bi = TRIAGE_ORDER.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

  const calibrationByType = presentTriages
    .map((triage) => {
      const recs = resolvedWithOutcome.filter((i: any) => i.triage_category === triage);
      if (recs.length === 0) return null;
      const avgPredicted = recs.reduce((sum: number, i: any) => sum + i.risk, 0) / recs.length;
      const actualRate = (recs.filter((i: any) => i.deceased).length / recs.length) * 100;
      return { type: triage, label: triage, count: recs.length, predicted: Number(avgPredicted.toFixed(1)), actual: Number(actualRate.toFixed(1)) };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const customTooltip = ({ active: a, payload, label }: any) => {
    if (!a || !payload?.length) return null;
    return (
      <div style={{ background:'rgba(6,12,24,0.95)', border:'1px solid var(--border-hi)', borderRadius:8, padding:'6px 12px', fontFamily:'var(--mono)', fontSize:11 }}>
        <div style={{ color:'var(--text)', marginBottom:2 }}>{label}</div>
        {payload.map((p: any) => (
          <div key={p.dataKey} style={{ color: p.color }}>{p.name}: <strong>{p.value}%</strong></div>
        ))}
      </div>
    );
  };

  // 🛡️ EXTRACT USER NAME FOR PERSONALIZED GREETING
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(' ')[0] || 'Commander';

  // 🛡️ DYNAMIC SIMULATION STEPS
  const PAGE_STEPS: TourStep[] = [
    {
      targetId: 'spotlight-mortality-metrics',
      tag: 'RISK ASSESSMENT',
      title: 'Global Mortality Metrics',
      script: `Welcome to the Mortality Prediction module, ${firstName}. This dashboard tracks the average model-assigned risk levels across all active field operations.`
    },
    {
      targetId: 'spotlight-mortality-active',
      tag: 'LIVE TELEMETRY',
      title: 'Active Incident Prediction',
      script: 'For every live incident, the Valkyra system dynamically calculates a predicted mortality risk based on incoming triage data and wound telemetry.'
    },
    {
      targetId: 'spotlight-mortality-calibration',
      tag: 'MODEL ACCURACY',
      title: 'Outcome Calibration',
      script: 'Finally, the system cross-references these initial predictions against actual post-incident outcomes. This continuous feedback loop ensures our clinical models remain highly calibrated. Briefing complete.'
    }
  ];

  return (
    <div className="pb-10">
      <div style={{ background:'rgba(192,132,252,0.04)', border:'1px solid rgba(192,132,252,0.15)', borderRadius:10, padding:'10px 16px', marginBottom:20, fontSize:11, color:'var(--text3)', fontFamily:'var(--mono)' }}>
        ℹ Predicted risk and outcome are modeled estimates for demonstration — derived deterministically per incident, not from a live mortality-prediction service.
      </div>

      {/* 🛡️ TARGET 1: Metrics Grid */}
      <div id="spotlight-mortality-metrics" className="metrics-grid" style={{ marginBottom:20 }}>
        <HoverTooltip tooltip="Sessions recorded in the last 24 hours — currently treated as active incidents until a dedicated incidents feed exists.">
          <div className="metric-card">
            <div className="metric-label">Active Incidents</div>
            <div className="metric-value" style={{ color:'var(--text)' }}>{isLoading ? '—' : active.length}</div>
          </div>
        </HoverTooltip>
        <HoverTooltip tooltip="Average model-estimated mortality risk across all active incidents, derived from each session's PWAT severity score.">
          <div className="metric-card">
            <div className="metric-label">Avg Predicted Risk</div>
            <div className="metric-value" style={{ color:riskColor(avgActiveRisk) }}>{active.length ? avgActiveRisk.toFixed(1)+'%' : '—'}</div>
          </div>
        </HoverTooltip>
        <HoverTooltip tooltip="The active incident with the single highest predicted mortality risk right now.">
          <div className="metric-card">
            <div className="metric-label">Highest-Risk Active Incident</div>
            <div className="metric-value" style={{ fontSize:16, color:highestRisk?riskColor(highestRisk.risk):'var(--text)' }}>{highestRisk ? `${highestRisk.id.slice(0, 8)}… · ${highestRisk.risk}%` : '—'}</div>
          </div>
        </HoverTooltip>
        <HoverTooltip tooltip="Share of resolved incidents predicted to end in a fatal outcome, based on the modeled risk score.">
          <div className="metric-card">
            <div className="metric-label">Historical Mortality Rate</div>
            <div className="metric-value" style={{ color:riskColor(overallMortalityRate) }}>{resolved.length ? overallMortalityRate.toFixed(1)+'%' : '—'}</div>
          </div>
        </HoverTooltip>
      </div>

      <div className="section-hd"><div className="section-title">Active Incidents · Model-Predicted Risk</div><span className="badge badge-live">LIVE</span></div>
      
      {/* 🛡️ TARGET 2: Active Incidents Table */}
      <div id="spotlight-mortality-active" className="card" style={{ marginBottom:20 }}>
        {isLoading ? (
          <div style={{ padding:'20px 18px' }}>{[...Array(2)].map((_,i) => <div key={i} className="skeleton" style={{ height:14, marginBottom:10 }} />)}</div>
        ) : activeWithRisk.length === 0 ? (
          <div style={{ padding:'20px 18px', textAlign:'center', color:'var(--text3)', fontFamily:'var(--mono)', fontSize:12 }}>No active incidents right now.</div>
        ) : (
          <div style={{ overflowX:'auto' }}>
          <table className="data-table">
            <thead><tr><th>Session ID</th><th>Triage</th><th>PWAT</th><th>Depth</th><th>Recorded</th><th>Predicted Risk</th></tr></thead>
            <tbody>
              {activeWithRisk.map((i: any) => {
                const isHighest = highestRisk && i.id === highestRisk.id;
                return (
                  <tr key={i.id}>
                    <td style={{ fontFamily:'var(--mono)', color:'var(--text)', fontWeight:600 }}>{i.id}</td>
                    <td><span className={`triage-badge triage-${i.triage_category} uppercase`}>{i.triage_category}</span></td>
                    <td style={{ fontFamily:'var(--mono)', color:'var(--text)' }}>{Number(i.pwat_score).toFixed(1)}</td>
                    <td style={{ color:'var(--text2)' }}>{i.wound_metrics?.depth_severity ?? '—'}</td>
                    <td style={{ fontFamily:'var(--mono)', fontSize:11 }}>{formatDate(i.created_at)}</td>
                    <td style={{ fontFamily:'var(--mono)', fontWeight:700, color:riskColor(i.risk) }}>
                      <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                        {isHighest && (
                          <motion.span
                            style={{ width:6, height:6, borderRadius:'50%', background:riskColor(i.risk), flexShrink:0 }}
                            animate={{ boxShadow: [`0 0 0 0 ${riskColor(i.risk)}`, `0 0 0 6px transparent`], opacity: [1, 0.6, 1] }}
                            transition={{ duration: 1.3, repeat: Infinity, ease: 'easeOut' }}
                          />
                        )}
                        {i.risk}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>

      <div className="section-hd"><div className="section-title">Post-Incident Outcome Tracking · Predicted vs. Actual</div></div>
      
      {/* 🛡️ TARGET 3: Post-Incident Outcome Chart */}
      <div id="spotlight-mortality-calibration" className="card">
        {resolvedWithOutcome.length === 0 ? (
          <div style={{ padding:'20px 18px', textAlign:'center', color:'var(--text3)', fontFamily:'var(--mono)', fontSize:12 }}>
            No resolved incidents yet — outcome calibration will appear here once incidents are resolved.
          </div>
        ) : (
          <div style={{ padding:'16px 18px' }}>
            <ResponsiveContainer key={calibrationByType.length} width="100%" height={220}>
              <BarChart data={calibrationByType} barSize={20}>
                <XAxis dataKey="label" tick={{ fill:'rgba(240,244,255,0.35)', fontSize:10, fontFamily:'JetBrains Mono' }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip content={customTooltip} />
                <Legend wrapperStyle={{ fontSize:11, fontFamily:'var(--mono)' }} />
                <Bar dataKey="predicted" name="Predicted Risk (at dispatch)" fill="var(--cyan)" radius={[4,4,0,0]} isAnimationActive={false} />
                <Bar dataKey="actual" name="Actual Outcome Rate" fill="var(--red)" radius={[4,4,0,0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* 🛡️ INJECT THE TOUR ENGINE */}
      <VoiceTour storageKey="valkyra-tour-mortality" steps={PAGE_STEPS} />

    </div>
  );
}