'use client';
import { useState, useEffect } from 'react';
import { useAllSessions } from '@/hooks';
import { motion, AnimatePresence } from 'framer-motion';
import { pwatColor } from '@/lib/utils';
import { sessionStatus } from '@/lib/sessionsAsIncidents';
import { useNucleusStore } from '@/store/useNucleusStore';
import { HoverTooltip } from '@/components/ui/MetricCard';

// 🛡️ IMPORTS FOR THE PERSONALIZED VOICE TOUR
import { useSession } from 'next-auth/react';
import VoiceTour, { TourStep } from '@/components/VoiceTour';

// --- Live Mission Clock Component ---
function MissionClock({ startTime }: { startTime: string }) {
  const [elapsed, setElapsed] = useState('00:00:00');

  useEffect(() => {
    const start = new Date(startTime).getTime();

    const update = () => {
      const diff = Math.floor((Date.now() - start) / 1000);
      const h = Math.floor(diff / 3600).toString().padStart(2, '0');
      const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
      const s = (diff % 60).toString().padStart(2, '0');
      setElapsed(`${h}:${m}:${s}`);
    };
    
    update();
    const int = setInterval(update, 1000);
    return () => clearInterval(int);
  }, [startTime]);

  return <span className="font-mono text-[11px] tracking-widest">{elapsed}</span>;
}

export default function IncidentsPage() {
  const { data: sessionsData } = useAllSessions();
  const setActivePatientId = useNucleusStore((s) => s.setActivePatientId);
  const sessions = sessionsData?.sessions ?? [];

  // "Incidents" here are recent sessions (last hour) treated as active field
  // operations — there's no dedicated incidents feed yet. See lib/sessionsAsIncidents.ts.
  const activeIncidents = sessions
    .filter((s: any) => sessionStatus(s.created_at) === 'Active')
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // 🛡️ EXTRACT USER NAME FOR PERSONALIZED GREETING
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(' ')[0] || 'Commander';

  // 🛡️ DYNAMIC SIMULATION STEPS
  const PAGE_STEPS: TourStep[] = [
    {
      targetId: 'spotlight-incidents-header',
      tag: 'LIVE OVERSIGHT',
      title: 'Active Deployments',
      script: `Welcome to Live Incidents, ${firstName}. This command center provides real-time oversight of all ongoing field operations.`
    },
    {
      targetId: 'spotlight-incident-card-0',
      tag: 'MISSION TELEMETRY',
      title: 'Tactical Operation Status',
      script: 'Each active mission tracks the deployed hardware, responder status, and a live T-MINUS mission clock. Commanders can coordinate or resolve operations directly from this console. Briefing complete.'
    }
  ];

  return (
    <div className="p-6 max-w-[1400px] mx-auto min-h-screen">
      
      {/* 🛡️ TARGET 1: Header */}
      <div id="spotlight-incidents-header" className="flex justify-between items-end mb-8">
        <div>
          <p className="text-[11px] font-mono tracking-widest text-slate-400 uppercase">
            Active field operations requiring immediate oversight
          </p>
        </div>
        <HoverTooltip tooltip="Sessions recorded in the last 24 hours, treated as active field incidents until a dedicated incidents feed exists.">
          <div className="text-right">
            <div className="text-3xl font-bold font-mono text-white">{activeIncidents.length}</div>
            <div className="text-[10px] font-mono tracking-widest text-slate-500 uppercase">Active Units</div>
          </div>
        </HoverTooltip>
      </div>

      {/* Active Grid */}
      {activeIncidents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border border-white/5 border-dashed rounded-xl bg-white/[0.01]">
          <div className="w-3 h-3 rounded-full bg-slate-600 mb-4" />
          <div className="text-sm font-mono text-slate-400">NO ACTIVE DEPLOYMENTS</div>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {activeIncidents.map((inc: any, idx: number) => {
              const isCritical = inc.triage_category === 'Red';

              return (
                <motion.div
                  key={inc.session_id}
                  id={idx === 0 ? 'spotlight-incident-card-0' : undefined} /* 🛡️ TARGET 2: Highlights the very first card */
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`bg-white/[0.02] border ${isCritical ? 'border-red-500/30 bg-red-500/[0.02]' : 'border-white/10'} rounded-lg p-5 flex flex-col md:flex-row items-center gap-6 backdrop-blur-xl transition-all hover:bg-white/[0.05]`}
                >
                  {/* Status Indicator & Timer */}
                  <div className="relative flex flex-col items-center justify-center w-24 border-r border-white/10 pr-6 overflow-hidden">
                    {isCritical && (
                      <motion.div
                        className="absolute w-32 h-32 rounded-full pointer-events-none"
                        style={{ background: 'conic-gradient(from 0deg, transparent 75%, rgba(248,113,113,0.12) 100%)' }}
                        animate={{ rotate: 360 }}
                        transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                      />
                    )}
                    <div className="relative text-[9px] font-mono text-slate-500 tracking-widest uppercase mb-2">T-MINUS</div>
                    <div className={`relative ${isCritical ? 'text-red-400' : 'text-cyan-400'} font-bold`}>
                      <MissionClock startTime={inc.created_at} />
                    </div>
                  </div>

                  {/* Core Info */}
                  <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-[9px] font-mono text-slate-500 tracking-widest uppercase mb-1">SESSION ID</div>
                      <div className="text-xs font-mono text-white font-bold truncate" title={inc.session_id}>{inc.session_id}</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-mono text-slate-500 tracking-widest uppercase mb-1">TRIAGE</div>
                      <span className={`triage-badge triage-${inc.triage_category} uppercase`}>{inc.triage_category}</span>
                    </div>
                    <HoverTooltip tooltip="Photographic Wound Assessment Tool score (0-20) — a severity rating derived from the AI's analysis of the wound image. 0-4 Minor · 4-8 Delayed · 8-12 Urgent · 12-20 Critical.">
                      <div>
                        <div className="text-[9px] font-mono text-slate-500 tracking-widest uppercase mb-1">PWAT SCORE</div>
                        <div className="text-xs font-mono font-bold" style={{ color: pwatColor(inc.pwat_score) }}>{Number(inc.pwat_score).toFixed(1)}</div>
                      </div>
                    </HoverTooltip>
                    <div>
                      <div className="text-[9px] font-mono text-slate-500 tracking-widest uppercase mb-1">DEPTH</div>
                      <div className="text-xs font-mono text-slate-300">{inc.wound_metrics?.depth_severity ?? '—'}</div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 pl-6 border-l border-white/10">
                    <button
                      onClick={() => setActivePatientId(inc.session_id)}
                      className="px-4 py-2 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[10px] font-mono rounded hover:bg-cyan-500/20 transition-colors"
                    >
                      VIEW DETAILS
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* 🛡️ INJECT THE TOUR ENGINE */}
      <VoiceTour storageKey="valkyra-tour-incidents-live" steps={PAGE_STEPS} />

    </div>
  );
}