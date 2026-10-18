'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { motion, Variants } from 'framer-motion';
import { HoverTooltip } from '@/components/ui/MetricCard';
import { useAllSessions, useLiveLocations } from '@/hooks';
import { formatDate, parseTimestamp } from '@/lib/utils';
import { hasGps, patientHref } from '@/lib/patients';
import type { MapInjury, MapHeadset } from '@/components/maps/IncidentMap';

// 🛡️ IMPORTS FOR THE PERSONALIZED VOICE TOUR
import { useSession } from 'next-auth/react';
import VoiceTour, { TourStep } from '@/components/VoiceTour';

// Maps need the browser — never render them on the server. Google Maps when
// a browser key is configured; otherwise the keyless Esri/Leaflet map.
const mapLoading = () => <div className="skeleton" style={{ width: '100%', height: '100%' }} />;
const IncidentMap = dynamic(() => import('@/components/maps/IncidentMap'), { ssr: false, loading: mapLoading });
const GoogleIncidentMap = dynamic(() => import('@/components/maps/GoogleIncidentMap'), { ssr: false, loading: mapLoading });
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

// --- ANIMATION VARIANTS ---
const panelVariant: Variants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } }
};

const activeBtn = { borderColor: 'rgba(34,211,238,0.5)', color: '#22d3ee', background: 'rgba(34,211,238,0.05)' };

// A headset that hasn't reported for this long is shown as "last seen", not live
const LIVE_WINDOW_SECONDS = 120;

function ago(unix: number | null): string {
  if (!unix) return 'unknown';
  const s = Math.max(0, Math.floor(Date.now() / 1000 - unix));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

// Geographic view of real wound scans (GPS captured by the headset at scan
// time) and every headset's latest live position.
export default function HeatmapPage() {
  const router = useRouter();
  const [timeRange, setTimeRange] = useState<number>(0);      // hours; 0 = all time
  const [outcomeFilter, setOutcomeFilter] = useState<'ALL' | 'CRITICAL'>('ALL');
  const [showHeadsets, setShowHeadsets] = useState(true);

  const { data: sessionsData, isLoading } = useAllSessions();
  const { data: liveData } = useLiveLocations(showHeadsets);
  const sessions = sessionsData?.sessions ?? [];

  const withGps = useMemo(() => sessions.filter((s) => hasGps(s.location)), [sessions]);

  const injuries: MapInjury[] = useMemo(() => {
    const now = Date.now();
    return withGps
      .filter((s) => {
        const t = parseTimestamp(s.location.captured_at ?? s.created_at)?.getTime() ?? 0;
        const matchTime = timeRange === 0 || (now - t) / 3_600_000 <= timeRange;
        const matchOutcome = outcomeFilter === 'ALL' || s.triage_category === 'Red';
        return matchTime && matchOutcome;
      })
      .map((s) => ({
        id: s.session_id,
        lat: Number(s.location.latitude),
        lng: Number(s.location.longitude),
        triage: s.triage_category,
        title: s.patient_name || s.patient_id || 'Unidentified patient',
        subtitle: `${s.body_region || 'Region not specified'} · PWAT ${s.pwat_score != null ? Number(s.pwat_score).toFixed(1) : '—'}`,
        time: formatDate(s.location.captured_at ?? s.created_at),
        onOpen: s.patient_id ? () => router.push(patientHref(s.patient_id!)) : undefined,
      }));
  }, [withGps, timeRange, outcomeFilter, router]);

  const headsets: MapHeadset[] = useMemo(() => {
    if (!showHeadsets) return [];
    const names = new Map(sessions.filter((s) => s.patient_id).map((s) => [s.patient_id!, s.patient_name || s.patient_id!]));
    return (liveData?.headsets ?? []).map((h) => ({
      id: h.device_id,
      lat: h.latitude,
      lng: h.longitude,
      label: h.patient_id && names.get(h.patient_id) ? `${h.device_id} · ${names.get(h.patient_id)}` : h.device_id,
      updated: ago(h.last_updated_unix),
      stale: !h.last_updated_unix || Date.now() / 1000 - h.last_updated_unix > LIVE_WINDOW_SECONDS,
    }));
  }, [liveData, showHeadsets, sessions]);

  const liveCount = headsets.filter((h) => !h.stale).length;
  const counts = injuries.reduce<Record<string, number>>((acc, i) => ({ ...acc, [i.triage]: (acc[i.triage] ?? 0) + 1 }), {});

  // 🛡️ EXTRACT USER NAME FOR PERSONALIZED GREETING
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(' ')[0] || 'Commander';

  // 🛡️ DYNAMIC SIMULATION STEPS
  const PAGE_STEPS: TourStep[] = [
    {
      targetId: 'spotlight-heatmap-filters',
      tag: 'DATA CONSOLE',
      title: 'Map Filters',
      script: `Welcome to the Incident Map, ${firstName}. Filter wound scans by time window or show critical cases only, and toggle live headset positions.`
    },
    {
      targetId: 'spotlight-heatmap-canvas',
      tag: 'LIVE MAP',
      title: 'Scan Locations',
      script: 'Every dot is a real wound scan, placed where the headset was when it was captured, and coloured by triage. Pulsing markers are headsets reporting their position right now. Click a dot to open the patient.'
    },
    {
      targetId: 'spotlight-heatmap-legend',
      tag: 'LEGEND',
      title: 'Triage Indicators',
      script: 'The legend counts what is currently plotted under your filters. Briefing complete.'
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
        {/* Time Range */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1 }}>Time:</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {[{ label: '24H', val: 24 }, { label: '7D', val: 168 }, { label: '30D', val: 720 }, { label: 'ALL', val: 0 }].map(tr => (
              <button key={tr.label} onClick={() => setTimeRange(tr.val)} className="btn"
                style={{ fontSize: 10, padding: '6px 12px', ...(timeRange === tr.val ? activeBtn : {}) }}>
                {tr.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ width: 1, height: 24, background: 'var(--border)' }} className="hidden lg:block" />

        {/* Outcome Filter */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1 }}>Layer:</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setOutcomeFilter('ALL')} className="btn"
              style={{ fontSize: 10, padding: '6px 16px', ...(outcomeFilter === 'ALL' ? activeBtn : {}) }}>
              All Scans
            </button>
            <button onClick={() => setOutcomeFilter('CRITICAL')} className="btn"
              style={{ fontSize: 10, padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 6, ...(outcomeFilter === 'CRITICAL' ? { borderColor: 'rgba(248,113,113,0.5)', color: 'var(--red)', background: 'rgba(248,113,113,0.05)' } : {}) }}>
              <div className={`w-1.5 h-1.5 rounded-full ${outcomeFilter === 'CRITICAL' ? 'bg-red-400 animate-pulse' : 'bg-slate-500'}`} />
              Critical Only
            </button>
          </div>
        </div>

        <div style={{ width: 1, height: 24, background: 'var(--border)' }} className="hidden xl:block" />

        {/* Live headsets */}
        <button onClick={() => setShowHeadsets((v) => !v)} className="btn"
          style={{ fontSize: 10, padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 8, ...(showHeadsets ? activeBtn : {}) }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: showHeadsets ? '#22d3ee' : '#64748b' }} />
          Live Headsets{showHeadsets ? ` (${liveCount} live)` : ''}
        </button>
      </motion.div>

      {/* 🛡️ TARGET 2: MAP CANVAS */}
      <motion.div id="spotlight-heatmap-canvas" variants={panelVariant} initial="hidden" animate="show" className="card relative flex-1 p-0 overflow-hidden" style={{ minHeight: '500px', border: '1px solid var(--border)' }}>
        {isLoading ? (
          <div className="skeleton" style={{ width: '100%', height: '100%' }} />
        ) : (
          GOOGLE_MAPS_API_KEY
            ? <GoogleIncidentMap injuries={injuries} headsets={headsets} apiKey={GOOGLE_MAPS_API_KEY} />
            : <IncidentMap injuries={injuries} headsets={headsets} />
        )}

        {!isLoading && injuries.length === 0 && headsets.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 1000 }}>
            <div style={{ background: 'rgba(2,6,23,0.85)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 20px', fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text3)', textAlign: 'center' }}>
              No located scans for these filters.<br />Scans get a location once the headset sends GPS.
            </div>
          </div>
        )}

        {/* 🛡️ TARGET 3: FLOATING BOTTOM LEGEND */}
        <div id="spotlight-heatmap-legend" className="absolute bottom-6 left-6 pointer-events-none" style={{ zIndex: 1000, display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center', background: 'rgba(0,0,0,0.7)', padding: '12px 20px', borderRadius: '8px', border: '1px solid var(--border)', backdropFilter: 'blur(10px)' }}>
          {[
            { t: 'Red', label: 'Severe / Red', color: '#f87171' },
            { t: 'Orange', label: 'Delayed / Orange', color: '#fbbf24' },
            { t: 'Yellow', label: 'Minor / Yellow', color: '#facc15' },
            { t: 'Green', label: 'Stable / Green', color: '#4ade80' },
          ].map((l) => (
            <div key={l.t} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: l.color, boxShadow: `0 0 6px ${l.color}` }} />
              <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text2)' }}>{l.label} <span style={{ color: 'var(--text3)' }}>{counts[l.t] ?? 0}</span></span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="nucleus-headset" style={{ width: 12, height: 12 }}><span style={{ width: 6, height: 6 }} /></span>
            <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text2)' }}>Live headset</span>
          </div>
          <HoverTooltip tooltip={`${sessions.length - withGps.length} older scans have no GPS and can't be placed on the map.`} className="hidden sm:block pointer-events-auto" style={{ borderLeft: '1px solid var(--border)', paddingLeft: 20, fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', letterSpacing: 1 }}>
            PLOTTED SCANS: <span style={{ color: 'white', fontWeight: 'bold' }}>{injuries.length}</span>
          </HoverTooltip>
        </div>
      </motion.div>

      {/* 🛡️ INJECT THE TOUR ENGINE */}
      <VoiceTour storageKey="valkyra-tour-incident-map" steps={PAGE_STEPS} />
    </div>
  );
}
