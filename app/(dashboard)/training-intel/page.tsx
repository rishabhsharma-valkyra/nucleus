'use client';

import { useState } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { HoverTooltip } from '@/components/ui/MetricCard';

// 🛡️ IMPORTS FOR THE PERSONALIZED VOICE TOUR
import { useSession } from 'next-auth/react';
import VoiceTour, { TourStep } from '@/components/VoiceTour';

// --- MOCK INTELLIGENCE DATA ---
const VULNERABILITIES = [
  { id: 'V-772', region: 'North Unit', issue: 'Tourniquet Placement Delay', severity: 'High', adherence: 64, trend: 'down' },
  { id: 'V-819', region: 'East Wing', issue: 'Burn Protocol Deviation', severity: 'Medium', adherence: 78, trend: 'stable' },
  { id: 'V-901', region: 'South Unit', issue: 'Airway Management', severity: 'Critical', adherence: 42, trend: 'down' },
];

const RECOMMENDED_DRILLS = [
  { id: 'D-101', name: 'Rapid Hemorrhage Control', focus: 'Tourniquet Speed', match: 'V-772', duration: '45m' },
  { id: 'D-205', name: 'Advanced Thermal Trauma', focus: 'Burn Protocol', match: 'V-819', duration: '60m' },
  { id: 'D-312', name: 'Tactical Airway Securement', focus: 'Airway Mgmt', match: 'V-901', duration: '90m' },
];

const SCHEDULED_DRILLS = [
  { id: 'SD-1', unit: 'Squad Alpha (North)', drill: 'Rapid Hemorrhage Control', date: 'Today, 14:00', status: 'Pending' },
  { id: 'SD-2', unit: 'Squad Bravo (South)', drill: 'Tactical Airway Securement', date: 'Tomorrow, 09:00', status: 'Scheduled' },
  { id: 'SD-3', unit: 'Squad Charlie (East)', drill: 'Advanced Thermal Trauma', date: '18 Jul, 10:00', status: 'Scheduled' },
];

// --- ANIMATION VARIANTS ---
const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const cardVariant: Variants= {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } }
};

export default function TrainingIntelPage() {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'ROSTER'>('OVERVIEW');
  const [selectedVulnerability, setSelectedVulnerability] = useState<string | null>('V-772');

  // 🛡️ EXTRACT USER NAME FOR PERSONALIZED GREETING
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(' ')[0] || 'Commander';

  // 🛡️ DYNAMIC SIMULATION STEPS
  const PAGE_STEPS: TourStep[] = [
    {
      targetId: 'spotlight-training-metrics',
      tag: 'NETWORK ADHERENCE',
      title: 'Global Protocol Metrics',
      script: `Welcome to Training Intelligence, ${firstName}. This module aggregates fleet-wide procedural adherence and drill certification rates.`
    },
    {
      targetId: 'spotlight-vulnerabilities',
      tag: 'GAP ANALYSIS',
      title: 'Identified Vulnerabilities',
      script: 'The system continuously audits field telemetry to automatically flag procedural deviations and critical skill gaps.'
    },
    {
      targetId: 'spotlight-recommendations',
      tag: 'AI GENERATION',
      title: 'Dynamic Drill Protocols',
      script: 'Based on the identified vulnerabilities, Valkyra AI instantly generates targeted remedial drills to ensure peak operational readiness. Briefing complete.'
    }
  ];

  return (
    <div className="pb-10">

      {/* TABS */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {['OVERVIEW', 'ROSTER'].map(tab => (
          <button
            key={tab}
            className="btn"
            style={{ 
              fontSize: 11, 
              padding: '6px 20px', 
              ...(activeTab === tab ? { borderColor: 'rgba(34,211,238,0.5)', color: '#22d3ee', background: 'rgba(34,211,238,0.05)', boxShadow: '0 0 10px rgba(34,211,238,0.1)' } : {}) 
            }}
            onClick={() => setActiveTab(tab as any)}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'OVERVIEW' && (
        <motion.div variants={staggerContainer} initial="hidden" animate="show">
          
          {/* 🛡️ TARGET 1: TOP STATS GRID */}
          <div id="spotlight-training-metrics" className="metrics-grid" style={{ marginBottom: 24 }}>
            {/* Adherence Card */}
            <HoverTooltip tooltip="Percentage of field procedures performed in line with clinical protocol, averaged across all monitored units.">
              <motion.div variants={cardVariant} className="metric-card mc-cyan relative overflow-hidden transition-all hover:-translate-y-1">
                <div className="metric-label relative z-10">Global Protocol Adherence</div>
                <div className="metric-value cv-cyan relative z-10">88.4%</div>
                <div className="metric-delta relative z-10 text-green-400">↑ 2.1% vs last month</div>
                {/* Progress Bar */}
                <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, marginTop: 12, overflow: 'hidden' }}>
                  <motion.div initial={{ width: 0 }} animate={{ width: '88.4%' }} transition={{ duration: 1 }} style={{ height: '100%', background: 'var(--cyan)', boxShadow: '0 0 8px var(--cyan)' }} />
                </div>
              </motion.div>
            </HoverTooltip>

            {/* Vulnerabilities Card */}
            <HoverTooltip tooltip="Number of procedural gaps flagged as high-risk by continuous AI audit of field telemetry.">
              <motion.div variants={cardVariant} className="metric-card mc-red relative overflow-hidden transition-all hover:-translate-y-1">
                <div className="metric-label relative z-10">Critical Vulnerabilities</div>
                <div className="metric-value cv-red relative z-10">3</div>
                <div className="metric-delta relative z-10 flex items-center gap-2" style={{ color: 'var(--amber)' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
                  Immediate drills recommended
                </div>
              </motion.div>
            </HoverTooltip>

            {/* Completion Card */}
            <HoverTooltip tooltip="Share of assigned remedial drills completed by field units in the last 30 days.">
              <motion.div variants={cardVariant} className="metric-card mc-blue relative overflow-hidden transition-all hover:-translate-y-1">
                <div className="metric-label relative z-10">Drill Completion Rate</div>
                <div className="relative z-10" style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 4 }}>
                  <svg width={56} height={56} viewBox="0 0 56 56" style={{ flexShrink: 0 }}>
                    <circle cx={28} cy={28} r={22} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={6} />
                    <motion.circle
                      cx={28} cy={28} r={22} fill="none" stroke="var(--cyan)" strokeWidth={6}
                      strokeLinecap="round" transform="rotate(-90 28 28)"
                      style={{ filter: 'drop-shadow(0 0 5px var(--cyan))' }}
                      strokeDasharray={2 * Math.PI * 22}
                      initial={{ strokeDashoffset: 2 * Math.PI * 22 }}
                      animate={{ strokeDashoffset: 2 * Math.PI * 22 * (1 - 0.94) }}
                      transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
                    />
                  </svg>
                  <div>
                    <div className="metric-value cv-blue" style={{ marginBottom: 0 }}>94%</div>
                    <div className="metric-delta" style={{ color: 'var(--text3)' }}>12/14 Units Certified</div>
                  </div>
                </div>
                <div className="metric-delta relative z-10" style={{ color: 'var(--text3)', marginTop: 8 }}>Trailing 30 Days</div>
              </motion.div>
            </HoverTooltip>
          </div>

          {/* SPLIT WORKSPACE */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* 🛡️ TARGET 2: LEFT - Identified Gaps */}
            <motion.div id="spotlight-vulnerabilities" variants={cardVariant} className="card relative overflow-hidden">
              <div className="card-header">
                <span className="card-title text-white flex items-center gap-2">
                  <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  Identified Vulnerabilities
                </span>
                <span className="badge badge-ai">3 DETECTED</span>
              </div>
              
              <div className="p-4 space-y-3">
                {VULNERABILITIES.map((vuln) => {
                  const isSelected = selectedVulnerability === vuln.id;
                  const severityClass = vuln.severity === 'Critical' ? 'triage-Red' : vuln.severity === 'High' ? 'triage-Orange' : 'triage-Yellow';
                  const trackColor = vuln.adherence < 50 ? 'var(--red)' : 'var(--amber)';
                  
                  return (
                    <div
                      key={vuln.id}
                      onClick={() => setSelectedVulnerability(vuln.id)}
                      className={`group p-4 rounded-lg cursor-pointer transition-all border ${isSelected ? 'bg-white/[0.05] border-cyan-500/50 shadow-[0_0_15px_rgba(34,211,238,0.1)]' : 'bg-white/[0.01] border-white/5 hover:border-white/20 hover:bg-white/[0.03]'}`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 4 }}>
                            {vuln.region} · {vuln.id}
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 'bold', color: 'var(--text)' }}>{vuln.issue}</div>
                        </div>
                        <span className={`triage-badge ${severityClass} uppercase`}>{vuln.severity}</span>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                          <motion.div initial={{ width: 0 }} animate={{ width: `${vuln.adherence}%` }} transition={{ duration: 1 }} style={{ height: '100%', background: trackColor, boxShadow: `0 0 8px ${trackColor}` }} />
                        </div>
                        <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: trackColor, fontWeight: 'bold', width: '40px', textAlign: 'right' }}>
                          {vuln.adherence}%
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>

            {/* 🛡️ TARGET 3: RIGHT - AI Recommendations */}
            <motion.div id="spotlight-recommendations" variants={cardVariant} className="card relative overflow-hidden">
              <div className="absolute inset-0 pointer-events-none rounded-lg overflow-hidden opacity-20">
                <motion.div className="w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent shadow-[0_0_8px_rgba(34,211,238,0.8)]" animate={{ y: ["-100%", "800%"] }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }} />
              </div>
              
              <div className="card-header relative z-10">
                <span className="card-title text-cyan-400 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  AI Drill Recommendations
                </span>
              </div>

              <div className="p-4 space-y-3 relative z-10">
                <AnimatePresence mode="popLayout">
                  {RECOMMENDED_DRILLS.filter(d => d.match === selectedVulnerability).map((drill) => (
                    <motion.div
                      key={drill.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="p-5 rounded-lg border border-cyan-500/30 bg-gradient-to-r from-cyan-950/20 to-transparent"
                    >
                      <div className="flex flex-col md:flex-row justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" style={{ fontSize: 9, fontFamily: 'var(--mono)', letterSpacing: 1 }}>{drill.id}</span>
                            <span style={{ fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--text3)', textTransform: 'uppercase' }}>RESOLVES {drill.match}</span>
                          </div>
                          <div style={{ fontSize: 16, fontWeight: 'bold', color: 'white', marginBottom: 6 }}>{drill.name}</div>
                          <div className="flex items-center gap-4" style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text2)' }}>
                            <span className="flex items-center gap-1"><svg className="w-3.5 h-3.5 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> {drill.duration} Session</span>
                            <span className="flex items-center gap-1"><svg className="w-3.5 h-3.5 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg> Focus: {drill.focus}</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center">
                          <button className="btn" style={{ background: 'rgba(34,211,238,0.1)', borderColor: 'rgba(34,211,238,0.4)', color: '#22d3ee', fontSize: 11, padding: '8px 16px', letterSpacing: 1 }}>
                            SCHEDULE DRILL
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                
                {RECOMMENDED_DRILLS.filter(d => d.match === selectedVulnerability).length === 0 && (
                  <div className="p-8 text-center" style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text3)' }}>
                    No specific drills recommended for this vulnerability.
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}

      {/* ROSTER TAB */}
      {activeTab === 'ROSTER' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card">
          <div className="card-header">
            <span className="card-title">Scheduled Unit Drills</span>
            <span className="badge badge-live">LIVE ROSTER</span>
          </div>
          
          <table className="data-table">
            <thead>
              <tr>
                <th>Dispatch ID</th>
                <th>Target Unit</th>
                <th>Assigned Drill</th>
                <th>Time / Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {SCHEDULED_DRILLS.map((drill) => (
                <tr key={drill.id} className="cursor-pointer hover:bg-white/[0.02]">
                  <td style={{ fontFamily: 'var(--mono)', color: 'var(--cyan)', fontWeight: 600 }}>{drill.id}</td>
                  <td style={{ color: 'var(--text)' }}>{drill.unit}</td>
                  <td style={{ color: 'var(--text2)' }}>{drill.drill}</td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>{drill.date}</td>
                  <td>
                    <span className={`triage-badge ${drill.status === 'Pending' ? 'triage-Orange' : 'triage-Blue'} uppercase`}>
                      {drill.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      )}

      {/* 🛡️ INJECT THE TOUR ENGINE */}
      <VoiceTour storageKey="valkyra-tour-training" steps={PAGE_STEPS} />

    </div>
  );
}