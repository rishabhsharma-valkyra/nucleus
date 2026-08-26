'use client';
import { useSummary, useAllSessions } from '@/hooks';
import { useNucleusStore } from '@/store/useNucleusStore';
import { pwatColor, triageClass, formatTime } from '@/lib/utils';
import { motion, Variants } from 'framer-motion';
import VoiceTour, { TourStep } from '@/components/VoiceTour';
import { DEVICES, RESPONDERS } from '@/config/fleet';
import { AnimatedNumber, ScannerSweep, MetricCard } from '@/components/ui/MetricCard';

// 🛡️ ENFORCED "PHOTOGRAPHIC WOUND ASSESSMENT TOOL"
import { useSession } from 'next-auth/react';

const staggerReveal: Variants = {
  hidden: { opacity: 0, y: 15 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.4, ease: "easeOut" },
  }),
};

export default function OverviewPage() {
  const { data: summary, isLoading: sumLoading } = useSummary();
  const { data: sessionsData, isLoading: sessLoading } = useAllSessions();
  const setActivePatientId = useNucleusStore((s) => s.setActivePatientId);

  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(' ')[0] || 'Doctor';

  const OVERVIEW_STEPS: TourStep[] = [
    {
      targetId: 'spotlight-triage',
      tag: 'NETWORK COMMAND',
      title: 'Live Triage Analytics',
      script: `Welcome to the Nucleus Command Center, ${firstName}. Triage Distribution provides a real-time, network-wide view of all critical patient alerts.`
    },
    {
      targetId: 'spotlight-pwat',
      tag: 'CLINICAL TELEMETRY',
      title: 'Photographic Wound Assessment Tool',
      script: 'This module tracks dynamic healing scales, instantly flagging clinical stagnation across your wards.'
    },
    {
      targetId: 'spotlight-bot',
      tag: 'VOICE INTELLIGENCE',
      title: 'Valkyra AI Assistant',
      script: 'I am Valkyra AI. You can speak to me at any time to analyze telemetry or pull records. Briefing complete.'
    }
  ];

  const sessions = sessionsData?.sessions ?? [];
  const critical = sessions.filter((s: any) => s.triage_category === 'Red' || s.triage_category === 'Orange');

  const triage = summary?.triage_distribution ?? {} as any;
  const totalCases = summary?.total_cases ?? 0;
  const avgPwat = summary?.pwat_stats?.average ?? summary?.avg_pwat ?? 0;
  const minPwat = summary?.pwat_stats?.minimum ?? 0;
  const maxPwat = summary?.pwat_stats?.maximum ?? 0;
  const redCount = triage.Red?.count ?? 0;

  let animationIndex = 0;

  return (
    <div className="pb-10">
      {redCount > 0 && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="notif-banner error flex items-center gap-3" 
          style={{ marginBottom: 20 }}
        >
          <motion.div 
            className="w-2.5 h-2.5 rounded-full" 
            style={{ background: 'var(--red)' }}
            animate={{ 
              boxShadow: [
                "0 0 0px 0px rgba(248, 113, 113, 0.8)", 
                "0 0 15px 5px rgba(248, 113, 113, 0)", 
                "0 0 0px 0px rgba(248, 113, 113, 0)"
              ] 
            }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="notif-text"><strong>{redCount} critical case{redCount > 1 ? 's' : ''}</strong> requiring immediate attention</div>
        </motion.div>
      )}

      <div className="section-hd">
        <div className="section-title">Live Wound Intelligence · Hospital API</div>
        <span className="see-all">Live ›</span>
      </div>

      <div className="metrics-grid">
        <motion.div custom={++animationIndex} initial="hidden" animate="show" variants={staggerReveal}>
          <MetricCard tooltip="Total number of active and historical cases tracked." label="Total Cases" value={sumLoading ? '—' : totalCases} sub='<span style="color:var(--text3)">All sessions recorded</span>' color="cv-blue" bg="mc-blue" />
        </motion.div>
        <motion.div custom={++animationIndex} initial="hidden" animate="show" variants={staggerReveal}>
          <MetricCard tooltip="Average Photographic Wound Assessment Tool score across all patients." label="Avg PWAT Score" value={sumLoading ? '—' : avgPwat} decimals={2} sub={`<span style="color:var(--text3)">Min ${minPwat} · Max ${maxPwat}</span>`} color="cv-amber" bg="mc-amber" />
        </motion.div>
        <motion.div custom={++animationIndex} initial="hidden" animate="show" variants={staggerReveal}>
          <MetricCard tooltip="Number of severe cases currently flagged for immediate medical intervention." label="Critical (Red)" value={sumLoading ? '—' : redCount} sub={redCount > 0 ? '<span class="delta-down">⚠ Immediate attention required</span>' : '<span class="delta-up">No critical cases</span>'} color="cv-red" bg="mc-red" />
        </motion.div>
        <motion.div custom={++animationIndex} initial="hidden" animate="show" variants={staggerReveal}>
          <MetricCard tooltip="The single highest recorded severity score in the active network." label="Max PWAT Score" value={sumLoading ? '—' : maxPwat} sub='<span style="color:var(--text3)">Highest severity recorded</span>' color="cv-cyan" bg="mc-cyan" />
        </motion.div>
      </div>

      <div className="mid-grid">
        <motion.div custom={++animationIndex} initial="hidden" animate="show" variants={staggerReveal} className="card relative overflow-hidden" id="spotlight-triage">
          <ScannerSweep />
          <div className="card-header relative z-10">
            <span className="card-title">Triage Distribution · All Cases</span>
            <span className="badge badge-live"><AnimatedNumber value={totalCases} /> CASES</span>
          </div>
          <div className="chart-area relative z-10">
            {sumLoading ? (
              <>
                <div className="skeleton" style={{ height: 12, width: '100%', marginBottom: 10 }} />
                <div className="skeleton" style={{ height: 12, width: '85%' }} />
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(['Red','Orange','Yellow','Green'] as const).map(key => {
                  const item = triage[key];
                  if (!item?.count) return null;
                  const colors: Record<string,string> = { Red:'var(--red)', Orange:'var(--amber)', Yellow:'#fde047', Green:'var(--green)' };
                  return (
                    <motion.div key={key} initial={{ opacity: 0, width: "80%" }} animate={{ opacity: 1, width: "100%" }} transition={{ duration: 0.5 }} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ fontSize: 10, color: 'var(--text2)', width: 80, fontFamily: 'var(--mono)' }}>{key}</div>
                      <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${item.pct}%`, background: colors[key], borderRadius: 2, position: 'relative', overflow: 'hidden' }}>
                          <motion.div 
                            className="absolute top-0 bottom-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                            animate={{ x: ["-100%", "300%"] }}
                            transition={{ duration: 2, repeat: Infinity, ease: "linear", delay: Math.random() }}
                          />
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: colors[key], width: 32, textAlign: 'right' }}><AnimatedNumber value={item.count} /></div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', width: 36 }}>{item.pct}%</div>
                    </motion.div>
                  );
                })}
              </div>
            )}
            {!sumLoading && summary && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="improvement-banner" style={{ marginTop: 14 }}>
                <div>
                  <div className="imp-main">
                    {Object.entries(triage).sort(([,a]: any,[,b]: any) => b.count - a.count)[0]?.[0]} is most frequent
                  </div>
                  <div className="imp-sub">PWAT range analysis</div>
                </div>
                <div className="imp-right">
                  {(Object.values(triage) as any[]).sort((a,b) => b.count - a.count)[0]?.pct ?? 0}%
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>

        <motion.div custom={++animationIndex} initial="hidden" animate="show" variants={staggerReveal} className="card relative overflow-hidden" id="spotlight-pwat">
          <ScannerSweep />
          <div className="card-header relative z-10">
            <span className="card-title">Photographic Wound Assessment Tool (PWAT) Breakdown</span>
            <span className="badge badge-ai">AI SCORED</span>
          </div>
          <div className="injury-list relative z-10">
            {sessLoading ? (
              <div className="skeleton" style={{ height: 12, width: '100%' }} />
            ) : sessions.filter((s: any) => s.pwat_score > 0).slice(0, 6).map((s: any, idx: number) => {
              const pct = Math.round((s.pwat_score / 20) * 100);
              const col = pwatColor(s.pwat_score);
              const shortId = s.session_id.length > 18 ? s.session_id.slice(0,18)+'…' : s.session_id;
              return (
                <motion.div 
                  key={s.session_id} 
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.1 }}
                  className="injury-row hover:bg-white/5 transition-colors pr-4" // 🛡️ Added pr-4 to prevent overlap
                  style={{ cursor: 'pointer' }} onClick={() => setActivePatientId(s.session_id)}
                >
                  <div className="inj-type" title={s.session_id}>{shortId}</div>
                  <div className="inj-track">
                    <div className="inj-fill" style={{ width: `${pct}%`, background: col, boxShadow: `0 0 8px ${col}`, position: 'relative', overflow: 'hidden' }}>
                       <motion.div className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/30 to-transparent" animate={{ x: ["-100%", "300%"] }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear", delay: idx * 0.2 }} />
                    </div>
                  </div>
                  {/* 🛡️ THE FIX: Formatted the long score to a single decimal place */}
                  <div className="inj-count w-10 text-right shrink-0" style={{ color: col }}>
                    {Number(s.pwat_score).toFixed(1)}
                  </div>
                </motion.div>
              );
            })}
            <div className="training-callout">
              <div className="training-label">PWAT Scale</div>
              <div className="training-text">0–4 Minor · 4–8 Delayed · 8–12 Urgent · 12–20 Critical</div>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="section-hd mt-6">
        <div className="section-title">Active Systems</div>
      </div>
      <div className="bottom-grid">
        <motion.div custom={++animationIndex} initial="hidden" animate="show" variants={staggerReveal} className="card relative overflow-hidden">
          <ScannerSweep />
          <div className="card-header relative z-10">
            <span className="card-title">AR Device Fleet</span>
            <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>
              {DEVICES.filter(d => d.status === 'LIVE' || d.status === 'ONLINE').length} / {DEVICES.length} ONLINE
            </span>
          </div>
          <div className="relative z-10">
            {DEVICES.map((d, i) => {
              const responder = RESPONDERS.find(r => r.device_id === d.id);
              const dotClass = d.status === 'LIVE' || d.status === 'ONLINE' ? 'd-online' : d.status === 'IDLE' ? 'd-idle' : 'd-offline';
              const isLive = d.status === 'LIVE';
              return (
                <motion.div key={d.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 + (i * 0.1) }} className="device-row hover:bg-white/5 transition-colors">
                  <div className={`d-status ${dotClass}`} />
                  <div className="d-info">
                    <div className="d-name">{d.model} · {d.serial}</div>
                    <div className="d-user">{responder ? `${responder.name} · ${responder.unit}` : `Unassigned · ${d.unit}`}</div>
                  </div>
                  <div className={`d-time${isLive ? ' live' : ''}`} style={d.status === 'IDLE' ? { color: 'var(--amber)' } : {}}>
                    {d.status === 'IDLE' ? 'IDLE' : d.status === 'OFFLINE' ? 'OFFLINE' : d.status === 'LIVE' ? 'LIVE' : d.last_sync}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        <motion.div custom={++animationIndex} initial="hidden" animate="show" variants={staggerReveal} className="card relative overflow-hidden">
          <ScannerSweep />
          <div className="card-header relative z-10">
            <span className="card-title">Critical Cases Feed</span>
            <span className="badge badge-red">RED TRIAGE</span>
          </div>
          <div className="relative z-10">
            {critical.length === 0 ? (
              <div style={{ padding: '14px 18px', fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>No critical cases.</div>
            ) : critical.slice(0, 5).map((s: any, i: number) => (
              <motion.div 
                key={s.session_id} 
                initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + (i * 0.1) }}
                className="feed-item hover:bg-white/5 transition-colors cursor-pointer pr-4" 
                onClick={() => setActivePatientId(s.session_id)}
              >
                <div className="feed-meta">
                  <span className={`feed-type ${triageClass(s.triage_category)}`}>{s.triage_category}</span>
                  <span className="feed-time">{formatTime(s.created_at)}</span>
                </div>
                {/* 🛡️ THE FIX: Formatted the score here as well */}
                <div className="feed-desc truncate">PWAT {Number(s.pwat_score).toFixed(1)} · {s.source_image || 'Unknown source'}</div>
                <div className="feed-outcome flex items-center gap-2">
                  <motion.div 
                    className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"
                    animate={{ boxShadow: ["0 0 0px 0px rgba(248,113,113,0.8)", "0 0 10px 3px rgba(248,113,113,0)", "0 0 0px 0px rgba(248,113,113,0)"] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  /> 
                  Requires immediate attention
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div custom={++animationIndex} initial="hidden" animate="show" variants={staggerReveal} className="card relative overflow-hidden">
          <ScannerSweep />
          <div className="card-header relative z-10">
            <span className="card-title">AI Recommendation Accuracy</span>
            <span className="badge badge-ai">MODEL v3.1</span>
          </div>
          <div className="acc-area relative z-10">
            <div className="big-num"><AnimatedNumber value={94.7} decimals={1} />%</div>
            <div className="acc-sub">Validated by licensed MDs this month</div>
            <div className="acc-rows">
              {[['GSW',97,'#93c5fd'],['Stab',95,'#93c5fd'],['Blunt',93,'var(--amber)'],['Burn',91,'var(--amber)']].map(([l,v,c], i) => (
                <motion.div key={l as string} initial={{ opacity: 0, width: "80%" }} animate={{ opacity: 1, width: "100%" }} transition={{ delay: 0.3 + (i * 0.1) }} className="acc-row pr-4">
                  <div className="acc-label">{l}</div>
                  <div className="acc-track">
                    <div className="acc-fill" style={{ width: `${v}%`, background: c as string, position: 'relative', overflow: 'hidden' }}>
                      <motion.div className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/30 to-transparent" animate={{ x: ["-100%", "300%"] }} transition={{ duration: 1.8, repeat: Infinity, ease: "linear", delay: i * 0.3 }} />
                    </div>
                  </div>
                  <div className="acc-pct w-10 text-right shrink-0"><AnimatedNumber value={v} />%</div>
                </motion.div>
              ))}
            </div>
            <div className="esc-row">
              <div><div className="esc-label">Escalation Rate</div><div className="esc-val"><AnimatedNumber value={12.3} decimals={1} />% <span>of cases</span></div></div>
              <div style={{ textAlign: 'right' }}><div className="esc-label">Doctor Calls</div><div className="esc-val" style={{ color: '#93c5fd' }}><AnimatedNumber value={18} /> <span>this month</span></div></div>
            </div>
          </div>
        </motion.div>
      </div>
      
      <VoiceTour storageKey="valkyra-tour-overview" steps={OVERVIEW_STEPS} />
    </div>
  );
}