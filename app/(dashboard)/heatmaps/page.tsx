'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { HoverTooltip } from '@/components/ui/MetricCard';

// 🛡️ IMPORTS FOR THE PERSONALIZED VOICE TOUR
import { useSession } from 'next-auth/react';
import VoiceTour, { TourStep } from '@/components/VoiceTour';

// --- MOCK GEOGRAPHIC INCIDENT DATA ---
// Seeded (not Math.random()) so the map is stable across reloads/hot-refresh
// instead of reshuffling every time the module re-evaluates.
function seededFraction(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  hash >>>= 0;
  return (hash % 10000) / 10000;
}

const MOCK_INCIDENTS = Array.from({ length: 45 }).map((_, i) => {
  const s = (tag: string) => seededFraction(`heatmap-${i}-${tag}`);
  const isCritical = s('crit') > 0.7;
  const zone = ['NORTH', 'SOUTH', 'EAST', 'WEST'][Math.floor(s('zone') * 4)];
  return {
    id: `TRM-${1000 + i}`,
    x: Math.floor(s('x') * 80) + 10,
    y: Math.floor(s('y') * 80) + 10,
    severity: isCritical ? 'Red' : s('sev') > 0.5 ? 'Orange' : 'Yellow',
    zone: zone,
    timeOffset: s('time') * 72,
  };
});

// --- ANIMATION VARIANTS ---
const panelVariant: Variants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } }
};

export default function HeatmapPage() {
  const [timeRange, setTimeRange] = useState<number>(24);
  const [activeZone, setActiveZone] = useState<string>('ALL');
  const [outcomeFilter, setOutcomeFilter] = useState<'ALL' | 'CRITICAL'>('ALL');

  const visibleIncidents = useMemo(() => {
    return MOCK_INCIDENTS.filter(inc => {
      const matchTime = inc.timeOffset <= timeRange;
      const matchZone = activeZone === 'ALL' || inc.zone === activeZone;
      const matchOutcome = outcomeFilter === 'ALL' || (outcomeFilter === 'CRITICAL' && inc.severity === 'Red');
      return matchTime && matchZone && matchOutcome;
    });
  }, [timeRange, activeZone, outcomeFilter]);

  // 🛡️ EXTRACT USER NAME FOR PERSONALIZED GREETING
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(' ')[0] || 'Commander';

  // 🛡️ DYNAMIC SIMULATION STEPS
  const PAGE_STEPS: TourStep[] = [
    {
      targetId: 'spotlight-heatmap-filters',
      tag: 'DATA CONSOLE',
      title: 'Geographic Filters',
      script: `Welcome to the Geographic Heatmap, ${firstName}. Use this top console to filter incident clusters by deployment zone, historical timeframe, or triage severity.`
    },
    {
      targetId: 'spotlight-heatmap-canvas',
      tag: 'LIVE RADAR',
      title: 'Tactical Deployment Map',
      script: 'This radar canvas visualizes real-time incident concentrations. Red zones indicate critical trauma clusters requiring immediate resource reallocation.'
    },
    {
      targetId: 'spotlight-heatmap-legend',
      tag: 'TELEMETRY LEGEND',
      title: 'Triage Indicators',
      script: 'Use this legend to quickly identify triage statuses across the grid. The system continuously updates live data points as field units report in. Briefing complete.'
    }
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] gap-4 pb-6">

      {/* 🛡️ TARGET 1: HORIZONTAL FILTER DECK */}
      <motion.div 
        id="spotlight-heatmap-filters"
        variants={panelVariant} 
        initial="hidden" 
        animate="show" 
        className="shrink-0" 
        style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center', background: 'var(--bg-card)', padding: '12px 20px', borderRadius: '8px', border: '1px solid var(--border)' }}
      >
        
        {/* Zones */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1 }}>Zone:</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {['ALL', 'NORTH', 'SOUTH', 'EAST', 'WEST'].map(zone => (
              <button
                key={zone}
                onClick={() => setActiveZone(zone)}
                className="btn"
                style={{
                  fontSize: 10,
                  padding: '6px 12px',
                  ...(activeZone === zone ? { borderColor: 'rgba(34,211,238,0.5)', color: '#22d3ee', background: 'rgba(34,211,238,0.05)' } : {})
                }}
              >
                {zone}
              </button>
            ))}
          </div>
        </div>

        <div style={{ width: 1, height: 24, background: 'var(--border)' }} className="hidden lg:block" />

        {/* Time Range */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1 }}>Time:</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {[ { label: '24H', val: 24 }, { label: '7D', val: 168 }, { label: '30D', val: 720 } ].map(tr => (
              <button
                key={tr.label}
                onClick={() => setTimeRange(tr.val)}
                className="btn"
                style={{
                  fontSize: 10,
                  padding: '6px 12px',
                  ...(timeRange === tr.val ? { borderColor: 'rgba(34,211,238,0.5)', color: '#22d3ee', background: 'rgba(34,211,238,0.05)' } : {})
                }}
              >
                {tr.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ width: 1, height: 24, background: 'var(--border)' }} className="hidden xl:block" />

        {/* Outcome Filter */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1 }}>Layer:</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => setOutcomeFilter('ALL')}
              className="btn"
              style={{
                fontSize: 10,
                padding: '6px 16px',
                ...(outcomeFilter === 'ALL' ? { borderColor: 'rgba(34,211,238,0.5)', color: '#22d3ee', background: 'rgba(34,211,238,0.05)' } : {})
              }}
            >
              All Detections
            </button>
            <button
              onClick={() => setOutcomeFilter('CRITICAL')}
              className="btn"
              style={{
                fontSize: 10,
                padding: '6px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                ...(outcomeFilter === 'CRITICAL' ? { borderColor: 'rgba(248,113,113,0.5)', color: 'var(--red)', background: 'rgba(248,113,113,0.05)' } : {})
              }}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${outcomeFilter === 'CRITICAL' ? 'bg-red-400 animate-pulse' : 'bg-slate-500'}`} />
              Critical Only
            </button>
          </div>
        </div>

      </motion.div>

      {/* 🛡️ TARGET 2: DEDICATED MAP CANVAS */}
      <motion.div id="spotlight-heatmap-canvas" variants={panelVariant} initial="hidden" animate="show" className="card relative flex-1 p-0 overflow-hidden" style={{ minHeight: '500px', border: '1px solid var(--border)' }}>
        
        {/* Radar Grid Overlay */}
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage: "linear-gradient(rgba(34,211,238,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.3) 1px, transparent 1px)",
            backgroundSize: "60px 60px"
          }}
        />
        
        {/* Central Radar Sweep */}
        <motion.div
          className="absolute top-1/2 left-1/2 w-[150vw] h-[150vw] -ml-[75vw] -mt-[75vw] rounded-full border pointer-events-none"
          style={{ background: 'conic-gradient(from 0deg, transparent 70%, rgba(34,211,238,0.05) 100%)', borderColor: 'rgba(34,211,238,0.1)' }}
          animate={{ rotate: 360 }}
          transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
        />

        {/* Incident Plotting Engine */}
        <AnimatePresence>
          {visibleIncidents.map((inc) => {
            const isRed = inc.severity === 'Red';
            const color = isRed ? 'var(--red)' : inc.severity === 'Orange' ? 'var(--amber)' : 'var(--cyan)';
            const glow = isRed ? 'rgba(248,113,113,0.4)' : inc.severity === 'Orange' ? 'rgba(251,191,36,0.2)' : 'rgba(34,211,238,0.1)';

            return (
              <motion.div
                key={inc.id}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0 }}
                transition={{ duration: 0.5, type: 'spring' }}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 group cursor-crosshair"
                style={{ left: `${inc.x}%`, top: `${inc.y}%` }}
              >
                {/* Heatmap Glow Base */}
                <div
                  className="absolute inset-0 rounded-full blur-xl mix-blend-screen pointer-events-none"
                  style={{ width: isRed ? 120 : 80, height: isRed ? 120 : 80, marginLeft: isRed ? -60 : -40, marginTop: isRed ? -60 : -40, backgroundColor: glow }}
                />
                
                {/* Core Incident Dot */}
                <motion.div
                  className="relative z-10 w-2 h-2 rounded-full border border-black"
                  style={{ backgroundColor: color }}
                  animate={isRed ? { boxShadow: [`0 0 0 0 ${color}`, `0 0 0 10px transparent`] } : {}}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />

                {/* Hover Tooltip */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none p-2 rounded shadow-xl w-32 z-50" style={{ background: 'rgba(2, 6, 23, 0.9)', border: '1px solid var(--border)', backdropFilter: 'blur(10px)' }}>
                  <div style={{ fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>{inc.id}</div>
                  <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'white', fontWeight: 'bold', margin: '2px 0' }}>{inc.severity} Triage</div>
                  <div style={{ fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--cyan)' }}>T - {Math.floor(inc.timeOffset)} HRS</div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* 🛡️ TARGET 3: FLOATING BOTTOM LEGEND */}
        <div id="spotlight-heatmap-legend" className="absolute bottom-6 left-6 pointer-events-none" style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center', background: 'rgba(0,0,0,0.6)', padding: '12px 20px', borderRadius: '8px', border: '1px solid var(--border)', backdropFilter: 'blur(10px)' }}>
          <HoverTooltip tooltip="Critical/Red triage incidents currently plotted on the map." className="pointer-events-auto" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(248,113,113,0.8)]" />
            <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text2)' }}>Severe / Red</span>
          </HoverTooltip>
          <HoverTooltip tooltip="Delayed/Orange triage incidents currently plotted on the map." className="pointer-events-auto" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="w-2 h-2 rounded-full bg-amber-400" />
            <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text2)' }}>Delayed / Orange</span>
          </HoverTooltip>
          <HoverTooltip tooltip="Monitored, stable incidents currently plotted on the map." className="pointer-events-auto" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="w-2 h-2 rounded-full bg-cyan-400" />
            <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text2)' }}>Monitored / Stable</span>
          </HoverTooltip>
          <HoverTooltip tooltip="Total incidents currently visible under the active zone, time, and severity filters." className="hidden sm:block pointer-events-auto" style={{ borderLeft: '1px solid var(--border)', paddingLeft: 24, fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', letterSpacing: 1 }}>
            LIVE DATA POINTS: <span style={{ color: 'white', fontWeight: 'bold' }}>{visibleIncidents.length}</span>
          </HoverTooltip>
        </div>

      </motion.div>

      {/* 🛡️ INJECT THE TOUR ENGINE */}
      <VoiceTour storageKey="valkyra-tour-heatmap" steps={PAGE_STEPS} />

    </div>
  );
}