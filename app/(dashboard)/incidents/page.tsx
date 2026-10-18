'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useAllSessions, usePatientPhoto } from '@/hooks';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDate, pwatColor } from '@/lib/utils';
import { sessionStatus } from '@/lib/sessionsAsIncidents';
import { gcsImageUrl } from '@/lib/api';
import { useNucleusStore } from '@/store/useNucleusStore';
import { HoverTooltip } from '@/components/ui/MetricCard';
import { groupSessionsByPatient, hasGps, gpsText, PatientRecord } from '@/lib/patients';

// 🛡️ IMPORTS FOR THE PERSONALIZED VOICE TOUR
import { useSession } from 'next-auth/react';
import VoiceTour, { TourStep } from '@/components/VoiceTour';

function PatientPhoto({ patientId, name }: { patientId: string; name: string }) {
  const { data } = usePatientPhoto(patientId);
  return (
    <div className="w-14 h-14 shrink-0 rounded-lg overflow-hidden bg-black border border-white/10 flex items-center justify-center">
      {data?.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={gcsImageUrl(data.photo)} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span className="text-lg font-bold text-slate-500">{name.charAt(0).toUpperCase()}</span>
      )}
    </div>
  );
}

// Incidents, grouped by patient: each patient is one card, and every wound
// scan of that patient (today, ten days later, …) is an incident inside it.
// Clicking a card opens the patient profile with all of their incidents.
export default function IncidentsPage() {
  const { data: sessionsData, isLoading } = useAllSessions();
  const setActiveProfilePatientId = useNucleusStore((s) => s.setActiveProfilePatientId);
  const [search, setSearch] = useState('');

  const { patients, unidentifiedCount } = useMemo(
    () => groupSessionsByPatient(sessionsData?.sessions ?? []),
    [sessionsData]
  );

  const q = search.toLowerCase();
  const visible = patients.filter(
    (p) => !q || p.patient_id.toLowerCase().includes(q) || (p.patient_name ?? '').toLowerCase().includes(q)
  );
  const activeCount = patients.filter((p) => sessionStatus(p.last_seen) === 'Active').length;

  // 🛡️ EXTRACT USER NAME FOR PERSONALIZED GREETING
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(' ')[0] || 'Commander';

  // 🛡️ DYNAMIC SIMULATION STEPS
  const PAGE_STEPS: TourStep[] = [
    {
      targetId: 'spotlight-incidents-header',
      tag: 'PATIENT OVERSIGHT',
      title: 'Incidents by Patient',
      script: `Welcome to Incidents, ${firstName}. Every wound scan from the headset is filed under the patient it belongs to, so repeat injuries build a single history per patient.`
    },
    {
      targetId: 'spotlight-incident-card-0',
      tag: 'PATIENT RECORD',
      title: 'Patient Card',
      script: 'Each card shows the patient, how many incidents they have, their worst triage and where they were last scanned. Open a card to see their photo, location and every incident. Briefing complete.'
    }
  ];

  return (
    <div className="p-6 max-w-[1400px] mx-auto min-h-screen">

      {/* 🛡️ TARGET 1: Header */}
      <div id="spotlight-incidents-header" className="flex justify-between items-end mb-6 gap-4 flex-wrap">
        <div>
          <p className="text-[11px] font-mono tracking-widest text-slate-400 uppercase">
            Incidents grouped by patient
          </p>
          <input
            className="form-input mt-3"
            placeholder="Search patient name or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 260, padding: '6px 12px', fontSize: 12 }}
          />
        </div>
        <div className="flex gap-8">
          <HoverTooltip tooltip="Patients with at least one incident in the last 24 hours.">
            <div className="text-right">
              <div className="text-3xl font-bold font-mono text-white">{activeCount}</div>
              <div className="text-[10px] font-mono tracking-widest text-slate-500 uppercase">Active Patients</div>
            </div>
          </HoverTooltip>
          <div className="text-right">
            <div className="text-3xl font-bold font-mono text-white">{patients.length}</div>
            <div className="text-[10px] font-mono tracking-widest text-slate-500 uppercase">Patients</div>
          </div>
        </div>
      </div>

      {unidentifiedCount > 0 && (
        <div className="mb-4 text-[11px] font-mono text-slate-500">
          {unidentifiedCount} scan{unidentifiedCount === 1 ? '' : 's'} without a patient (recorded before face login was linked) —{' '}
          <Link href="/reports" className="text-cyan-400 underline">view in Reports</Link>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 72 }} />)}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border border-white/5 border-dashed rounded-xl bg-white/[0.01]">
          <div className="w-3 h-3 rounded-full bg-slate-600 mb-4" />
          <div className="text-sm font-mono text-slate-400">{search ? 'NO MATCHING PATIENTS' : 'NO PATIENT INCIDENTS YET'}</div>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {visible.map((p: PatientRecord, idx: number) => {
              const name = p.patient_name || p.patient_id;
              const isActive = sessionStatus(p.last_seen) === 'Active';
              const isCritical = p.worst_triage === 'Red';
              return (
                <motion.div
                  key={p.patient_id}
                  id={idx === 0 ? 'spotlight-incident-card-0' : undefined} /* 🛡️ TARGET 2 */
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: idx * 0.04 }}
                  onClick={() => setActiveProfilePatientId(p.patient_id)}
                  className={`cursor-pointer bg-white/[0.02] border ${isCritical ? 'border-red-500/30 bg-red-500/[0.02]' : 'border-white/10'} rounded-lg p-4 flex flex-col md:flex-row md:items-center gap-5 backdrop-blur-xl transition-all hover:bg-white/[0.05]`}
                >
                  <div className="flex items-center gap-4 md:w-72 shrink-0">
                    <PatientPhoto patientId={p.patient_id} name={name} />
                    <div className="min-w-0">
                      <div className="text-sm text-white font-bold truncate" title={name}>{name}</div>
                      <div className="text-[10px] font-mono text-slate-500 truncate" title={p.patient_id}>ID {p.patient_id}</div>
                      {isActive && <div className="text-[9px] font-mono tracking-widest text-cyan-400 mt-1">● ACTIVE</div>}
                    </div>
                  </div>

                  <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div>
                      <div className="text-[9px] font-mono text-slate-500 tracking-widest uppercase mb-1">INCIDENTS</div>
                      <div className="text-sm font-mono text-white font-bold">{p.incidents.length}</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-mono text-slate-500 tracking-widest uppercase mb-1">WORST TRIAGE</div>
                      <span className={`triage-badge triage-${p.worst_triage} uppercase`}>{p.worst_triage}</span>
                    </div>
                    <div>
                      <div className="text-[9px] font-mono text-slate-500 tracking-widest uppercase mb-1">MAX PWAT</div>
                      <div className="text-xs font-mono font-bold" style={{ color: pwatColor(p.max_pwat ?? 0) }}>
                        {p.max_pwat != null ? p.max_pwat.toFixed(1) : '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] font-mono text-slate-500 tracking-widest uppercase mb-1">LAST SEEN</div>
                      <div className="text-xs font-mono text-slate-300">{formatDate(p.last_seen)}</div>
                      <div className="text-[10px] text-slate-500 truncate">{p.latest_body_region || '—'}</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-mono text-slate-500 tracking-widest uppercase mb-1">LAST LOCATION</div>
                      <div className="text-xs font-mono text-slate-300">{hasGps(p.latest_location) ? gpsText(p.latest_location) : '—'}</div>
                    </div>
                  </div>

                  <div className="text-[10px] font-mono text-cyan-400 shrink-0">VIEW PATIENT →</div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* 🛡️ INJECT THE TOUR ENGINE */}
      <VoiceTour storageKey="valkyra-tour-incidents-patients" steps={PAGE_STEPS} />

    </div>
  );
}
