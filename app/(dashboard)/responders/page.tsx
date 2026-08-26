'use client';
import { motion, Variants } from 'framer-motion';
import { RESPONDERS } from '@/config/fleet';
import { useNucleusStore } from '@/store/useNucleusStore';
import { getDeviceForResponder } from '@/lib/deviceAssignments';
import { AnimatedNumber, HoverTooltip } from '@/components/ui/MetricCard';

// 🛡️ IMPORTS FOR THE PERSONALIZED VOICE TOUR
import { useSession } from 'next-auth/react';
import VoiceTour, { TourStep } from '@/components/VoiceTour';

const STATUS_CONFIG: Record<string, { cls: string; dot: string; label: string }> = {
  LIVE:    { cls: 'status-live',    dot: 'd-online',  label: 'LIVE' },
  ONLINE:  { cls: 'status-online',  dot: 'd-online',  label: 'ONLINE' },
  IDLE:    { cls: 'status-idle',    dot: 'd-idle',    label: 'IDLE' },
  OFFLINE: { cls: 'status-offline', dot: 'd-offline', label: 'OFFLINE' },
};

const statStagger: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const statItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};
const cardStagger: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const cardItem: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

const usageColor = (pct: number) => pct >= 75 ? 'var(--green)' : pct >= 50 ? 'var(--amber)' : 'var(--red)';

export default function RespondersPage() {
  const assignments = useNucleusStore((s) => s.deviceAssignments);

  const active  = RESPONDERS.filter(r => r.status === 'LIVE' || r.status === 'ONLINE').length;
  const idle    = RESPONDERS.filter(r => r.status === 'IDLE').length;
  const offline = RESPONDERS.filter(r => r.status === 'OFFLINE').length;

  // 🛡️ EXTRACT USER NAME FOR PERSONALIZED GREETING
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(' ')[0] || 'Commander';

  // 🛡️ STREAMLINED 2-STEP BRIEFING
  const PAGE_STEPS: TourStep[] = [
    {
      targetId: 'spotlight-fleet-stats',
      tag: 'FLEET COMMAND',
      title: 'Active Roster Status',
      script: `Welcome to the Responders roster, ${firstName}. This panel monitors the live deployment status of all active, idle, and offline field personnel.`
    },
    {
      targetId: 'spotlight-responder-card-0', // Targets the very first card in the grid
      tag: 'PERSONNEL TELEMETRY',
      title: 'Field Agent Metrics',
      script: 'Each profile tracks the agent\'s assigned hardware, live incident volume, and Valkyra system usage rates to ensure protocol compliance. Briefing complete.'
    }
  ];

  return (
    <>
      {/* 🛡️ TARGET 1: The top stats row */}
      <motion.div id="spotlight-fleet-stats" variants={statStagger} initial="hidden" animate="show" style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {[
          { label:'Active', value:active, color:'var(--green)', tooltip:'Responders whose assigned AR device is currently LIVE or ONLINE.' },
          { label:'Idle', value:idle, color:'var(--amber)', tooltip:'Responders whose device is connected but inactive.' },
          { label:'Offline', value:offline, color:'var(--text3)', tooltip:'Responders whose device is not currently connected.' },
          { label:'Total', value:RESPONDERS.length, color:'var(--text)', tooltip:'Total field responders on roster.' },
        ].map(s => (
          <motion.div key={s.label} variants={statItem} whileHover={{ y: -2, borderColor: 'rgba(255,255,255,0.15)' }} style={{ flex:1 }}>
            <HoverTooltip tooltip={s.tooltip} style={{ background:'var(--glass)', border:'1px solid var(--border)', borderRadius:'var(--r)', padding:'14px 18px', textAlign:'center' }}>
              <div style={{ fontSize:9, color:'var(--text3)', fontFamily:'var(--mono)', letterSpacing:2, textTransform:'uppercase', marginBottom:6 }}>{s.label}</div>
              <div style={{ fontSize:28, fontWeight:800, color:s.color, letterSpacing:-1 }}><AnimatedNumber value={s.value} /></div>
            </HoverTooltip>
          </motion.div>
        ))}
      </motion.div>

      <div style={{ background:'rgba(59,130,246,0.04)', border:'1px solid rgba(59,130,246,0.15)', borderRadius:10, padding:'10px 16px', marginBottom:20, fontSize:11, color:'var(--text3)', fontFamily:'var(--mono)' }}>
        ℹ Rank, unit, Valkyra usage rate, and incidents handled are managed via fleet configuration — illustrative until per-responder attribution exists in the session data.
      </div>

      <div className="section-hd"><div className="section-title">Field Responders · {RESPONDERS.length} Personnel</div></div>
      <motion.div className="responder-grid" variants={cardStagger} initial="hidden" animate="show">
        {RESPONDERS.map((r, index) => {
          const sc = STATUS_CONFIG[r.status];
          const handled = r.incidents_handled;
          const device = getDeviceForResponder(r.id, assignments);
          const isLive = r.status === 'LIVE';
          return (
            <motion.div
              key={r.id}
              id={index === 0 ? 'spotlight-responder-card-0' : undefined} /* 🛡️ TARGET 2: Highlights the first card */
              className="responder-card"
              variants={cardItem}
              whileHover={{ y: -3, borderColor: 'rgba(255,255,255,0.15)', boxShadow: '0 8px 24px rgba(0,0,0,0.35)' }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            >
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:12 }}>
                <div style={{ position:'relative' }}>
                  {isLive && (
                    <motion.div
                      style={{ position:'absolute', inset:-3, borderRadius:'50%', border:'1px solid var(--green)' }}
                      animate={{ boxShadow: ['0 0 0 0 rgba(74,222,128,0.5)', '0 0 0 8px rgba(74,222,128,0)'] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
                    />
                  )}
                  <div className="resp-avatar">{r.initials}</div>
                </div>
                <span className={`badge ${sc.cls}`} style={{ padding:'4px 10px' }}>{sc.label}</span>
              </div>
              <div className="resp-name">{r.name}</div>
              <div className="resp-rank">{r.rank} · {r.unit}</div>

              <div style={{ marginTop:12, paddingTop:12, borderTop:'1px solid var(--border)' }}>
                <div style={{ fontSize:9, color:'var(--text3)', fontFamily:'var(--mono)', letterSpacing:2, marginBottom:6, textTransform:'uppercase' }}>Assigned Device</div>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <div className={`d-status ${sc.dot}`} />
                  <span style={{ fontSize:11, fontFamily:'var(--mono)', color:'var(--text2)' }}>{device ? `${device.model} ${device.serial}` : 'Unassigned'}</span>
                </div>
              </div>

              <div style={{ marginTop:12, paddingTop:12, borderTop:'1px solid var(--border)' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:9, color:'var(--text3)', fontFamily:'var(--mono)', letterSpacing:2, textTransform:'uppercase' }}>Valkyra Usage</span>
                  <span style={{ fontSize:11, fontFamily:'var(--mono)', fontWeight:700, color:usageColor(r.valkyra_usage_pct) }}>{r.valkyra_usage_pct}%</span>
                </div>
                <div className="acc-track">
                  <motion.div
                    className="acc-fill"
                    style={{ background:usageColor(r.valkyra_usage_pct) }}
                    initial={{ width: 0 }}
                    animate={{ width: `${r.valkyra_usage_pct}%` }}
                    transition={{ duration: 1, delay: 0.15 + index * 0.03, ease: 'easeOut' }}
                  />
                </div>
              </div>

              <div style={{ marginTop:12, paddingTop:12, borderTop:'1px solid var(--border)', display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                <div>
                  <div style={{ fontSize:8, color:'var(--text3)', fontFamily:'var(--mono)', letterSpacing:1, textTransform:'uppercase', marginBottom:3 }}>Incidents</div>
                  <div style={{ fontSize:15, fontWeight:700, color:'var(--text)' }}><AnimatedNumber value={handled} /></div>
                </div>
                <div>
                  <div style={{ fontSize:8, color:'var(--text3)', fontFamily:'var(--mono)', letterSpacing:1, textTransform:'uppercase', marginBottom:3 }}>Avg Response</div>
                  <div style={{ fontSize:15, fontWeight:700, color:'var(--text)' }}><AnimatedNumber value={r.avg_response_min} decimals={r.avg_response_min % 1 !== 0 ? 1 : 0} /><span style={{ fontSize:10, color:'var(--text3)', fontWeight:400 }}>m</span></div>
                </div>
                <div>
                  <div style={{ fontSize:8, color:'var(--text3)', fontFamily:'var(--mono)', letterSpacing:1, textTransform:'uppercase', marginBottom:3 }}>Resolved</div>
                  <div style={{ fontSize:15, fontWeight:700, color:'var(--green)' }}><AnimatedNumber value={r.resolution_rate_pct} /><span style={{ fontSize:10, color:'var(--text3)', fontWeight:400 }}>%</span></div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* 🛡️ INJECT THE TOUR ENGINE */}
      <VoiceTour storageKey="valkyra-tour-responders" steps={PAGE_STEPS} />
    </>
  );
}