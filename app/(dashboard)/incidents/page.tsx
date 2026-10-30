'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { useAllSessions } from '@/hooks';
import { pwatColor, formatDate, parseTimestamp, timeAgo } from '@/lib/utils';
import { sessionStatus } from '@/lib/sessionsAsIncidents';
import {
  groupSessionsByPatient, hasGps, gpsText, patientHref, regionLabel,
  UNIDENTIFIED_ID, PatientRecord, MULTIPLE_INJURIES, TRIAGE_RANK, needsReview,
} from '@/lib/patients';

const TRIAGE_DOT: Record<string, string> = { Red: 'var(--red)', Orange: 'var(--amber)', Yellow: '#facc15', Green: 'var(--green)' };
import { exportIncidentsCSV, exportIncidentsPDF } from '@/lib/exports';
import PatientPhoto from '@/components/patients/PatientPhoto';

// 🛡️ IMPORTS FOR THE PERSONALIZED VOICE TOUR
import { useSession } from 'next-auth/react';
import VoiceTour, { TourStep } from '@/components/VoiceTour';

// --- ANIMATION VARIANTS ---
const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } }
};

const rowVariant: Variants = {
  hidden: { opacity: 0, x: -10 },
  show: { opacity: 1, x: 0, transition: { duration: 0.3, ease: "easeOut" } }
};

const activeBtn = { borderColor: 'rgba(34,211,238,0.5)', color: '#22d3ee', background: 'rgba(34,211,238,0.05)' };

// Patient Incidents — one row per patient (face-login patient_id). Every
// wound scan is an incident filed under its patient, so a scan today and
// another ten days later build one history. Opening a row goes to that
// patient's record page. Replaces the old per-session Incident Reports list.
export default function PatientIncidentsPage() {
  const router = useRouter();
  const { data: sessionsData, isLoading } = useAllSessions();

  // --- Filter & Selection States ---
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<'7D' | '30D' | '90D' | 'ALL'>('ALL');
  const [triageFilter, setTriageFilter] = useState<string>('All');
  // Priority: most urgent patient on top (worst triage, then most recent)
  const [sortBy, setSortBy] = useState<'priority' | 'recent'>('priority');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { patients, unidentifiedCount } = useMemo(
    () => groupSessionsByPatient(sessionsData?.sessions ?? []),
    [sessionsData]
  );

  // --- Data Processing ---
  const filteredPatients = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const now = Date.now();
    const list = patients.filter((p) => {
      const matchesSearch = !q || p.patient_id.toLowerCase().includes(q) || (p.patient_name ?? '').toLowerCase().includes(q);
      const matchesTriage = triageFilter === 'All' || p.worst_triage === triageFilter;
      const daysDiff = (now - (parseTimestamp(p.last_seen)?.getTime() ?? NaN)) / (1000 * 3600 * 24);
      let matchesDate = true;
      if (dateRange === '7D') matchesDate = daysDiff <= 7;
      if (dateRange === '30D') matchesDate = daysDiff <= 30;
      if (dateRange === '90D') matchesDate = daysDiff <= 90;
      return matchesSearch && matchesTriage && matchesDate;
    });
    // groupSessionsByPatient already returns most recent first
    if (sortBy === 'priority') {
      list.sort((a, b) => (TRIAGE_RANK[b.worst_triage] ?? 0) - (TRIAGE_RANK[a.worst_triage] ?? 0));
    }
    return list;
  }, [patients, searchQuery, triageFilter, dateRange, sortBy]);

  // Patients per worst triage, shown on the filter buttons
  const triageCounts = useMemo(() => {
    const c: Record<string, number> = { All: patients.length };
    patients.forEach((p) => { c[p.worst_triage] = (c[p.worst_triage] ?? 0) + 1; });
    return c;
  }, [patients]);

  const activeCount = patients.filter((p) => sessionStatus(p.last_seen) === 'Active').length;
  const showUnidentified = unidentifiedCount > 0 && !searchQuery && triageFilter === 'All';

  // 🛡️ EXTRACT USER NAME FOR THE TOUR
  const { data: sessionData } = useSession();
  const firstName = sessionData?.user?.name?.split(' ')[0] || 'Commander';

  const PAGE_STEPS: TourStep[] = [
    {
      targetId: 'spotlight-filters',
      tag: 'PATIENT FILTERS',
      title: 'Search & Triage',
      script: `Welcome to Patient Incidents, ${firstName}. Every wound scan is filed under the patient it belongs to. Search by patient name or ID, or filter by date and worst triage.`
    },
    {
      targetId: 'spotlight-table',
      tag: 'PATIENT RECORDS',
      title: 'Patients & Exports',
      script: 'Each row is one patient with all of their incidents. Open a patient to see their photo, location and every injury, or select rows to export a CSV or PDF. Briefing complete.'
    }
  ];

  // --- Selection Handlers ---
  const toggleSelection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredPatients.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredPatients.map((p) => p.patient_id)));
  };

  const selectedIncidents = () =>
    filteredPatients.filter((p) => selectedIds.has(p.patient_id)).flatMap((p) => p.incidents);

  return (
    <div className="pb-32">
      {/* 🛡️ TARGET 1: FILTER DECK */}
      <div id="spotlight-filters" style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center', background: 'var(--bg-card)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>

        {/* Search */}
        <div style={{ flex: 1, minWidth: '250px', position: 'relative' }}>
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            className="form-input"
            placeholder="Search patient name or ID..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: '100%', paddingLeft: '36px' }}
          />
        </div>

        {/* Date Filters (last seen) */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {['7D', '30D', '90D', 'ALL'].map(d => (
            <button
              key={d}
              className="btn"
              style={{ fontSize: 11, padding: '6px 14px', ...(dateRange === d ? activeBtn : {}) }}
              onClick={() => setDateRange(d as any)}
            >
              {d}
            </button>
          ))}
        </div>

        {/* Triage Filters (worst triage) */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', paddingLeft: 16, borderLeft: '1px solid var(--border)' }}>
          {['All', 'Red', 'Orange', 'Yellow', 'Green'].map(t => (
            <button
              key={t}
              className="btn"
              style={{ fontSize: 11, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6, ...(triageFilter === t ? activeBtn : {}) }}
              onClick={() => setTriageFilter(t)}
            >
              {t !== 'All' && <div className={`w-1.5 h-1.5 rounded-full ${t === 'Red' ? 'bg-red' : t === 'Orange' ? 'bg-amber' : t === 'Yellow' ? 'bg-yellow-400' : 'bg-green'}`} />}
              {t}
              <span style={{ fontFamily: 'var(--mono)', color: 'var(--text3)', fontSize: 10 }}>{triageCounts[t] ?? 0}</span>
            </button>
          ))}
        </div>

        {/* Sort */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', paddingLeft: 16, borderLeft: '1px solid var(--border)' }}>
          {([['priority', 'Priority'], ['recent', 'Most recent']] as const).map(([k, l]) => (
            <button
              key={k}
              className="btn"
              style={{ fontSize: 11, padding: '6px 14px', ...(sortBy === k ? activeBtn : {}) }}
              onClick={() => setSortBy(k)}
              title={k === 'priority' ? 'Worst triage first, then most recent' : 'Most recently scanned first'}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Counts */}
        <div style={{ display: 'flex', gap: 20, paddingLeft: 16, borderLeft: '1px solid var(--border)', fontFamily: 'var(--mono)' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{activeCount}</div>
            <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--text3)', textTransform: 'uppercase' }} title="Patients with an incident in the last 24 hours">Active</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{patients.length}</div>
            <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--text3)', textTransform: 'uppercase' }}>Patients</div>
          </div>
        </div>
      </div>

      {/* 🛡️ TARGET 2: PATIENT LIST CARD */}
      <div id="spotlight-table" className="card" style={{ padding: 0, overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, padding: '16px 24px', borderBottom: '1px solid var(--border)', fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, background: 'rgba(0,0,0,0.2)' }}>
          <div style={{ width: 20, display: 'flex', justifyContent: 'center' }}>
            <input type="checkbox" className="accent-cyan-500 cursor-pointer" checked={selectedIds.size > 0 && selectedIds.size === filteredPatients.length} onChange={toggleAll} />
          </div>
          <div style={{ flex: 1 }}>Patient</div>
          <div style={{ width: 100, textAlign: 'right' }}>Highest PWAT</div>
          <div style={{ width: 170, textAlign: 'right' }} className="hidden sm:block">Last Known Location</div>
        </div>

        {/* Rows */}
        <motion.div variants={staggerContainer} initial="hidden" animate="show" style={{ display: 'flex', flexDirection: 'column' }}>
          {isLoading ? (
            <div style={{ padding: '20px 24px' }}>
              {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 40, marginBottom: 12 }} />)}
            </div>
          ) : filteredPatients.length === 0 && !showUnidentified ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text3)', fontFamily: 'var(--mono)', fontSize: 12 }}>
              {patients.length === 0 ? 'No patient incidents yet.' : 'No patients match current filters.'}
            </div>
          ) : (
            <>
              {filteredPatients.map((p: PatientRecord, i: number) => {
                const name = p.patient_name || p.patient_id;
                const isSelected = selectedIds.has(p.patient_id);
                const isActive = sessionStatus(p.last_seen) === 'Active';
                return (
                  <motion.div
                    variants={rowVariant}
                    key={p.patient_id}
                    onClick={() => router.push(patientHref(p.patient_id))}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 24, padding: '14px 24px', cursor: 'pointer',
                      borderBottom: i === filteredPatients.length - 1 && !showUnidentified ? 'none' : '1px solid var(--border)', transition: 'background 0.2s',
                      ...(isSelected ? { background: 'rgba(34,211,238,0.05)' } : {})
                    }}
                    className="hover:bg-white/[0.02]"
                  >
                    {/* Checkbox */}
                    <div style={{ width: 20, display: 'flex', justifyContent: 'center' }} onClick={(e) => toggleSelection(p.patient_id, e)}>
                      <input type="checkbox" className="accent-cyan-500 cursor-pointer" checked={isSelected} readOnly />
                    </div>

                    {/* Patient */}
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                      <PatientPhoto patientId={p.patient_id} name={name} size={44} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{name}</span>
                          <span className={`triage-badge triage-${p.worst_triage} uppercase`}>{p.worst_triage}</span>
                          {isActive && <span style={{ fontSize: 9, fontFamily: 'var(--mono)', letterSpacing: 1.5, color: 'var(--cyan)' }}>● ACTIVE</span>}
                          {p.current_injuries.length >= MULTIPLE_INJURIES && (
                            <span style={{ fontSize: 9, fontFamily: 'var(--mono)', letterSpacing: 1.5, color: 'var(--amber)' }} title="Several wounds can add up to a serious patient — review overall priority">MULTIPLE INJURIES</span>
                          )}
                          {needsReview(p.current_injuries).length > 0 && (
                            <span style={{ fontSize: 9, fontFamily: 'var(--mono)', letterSpacing: 1.5, color: '#a78bfa' }} title="Injuries in the latest scan no clinician has confirmed yet">
                              {needsReview(p.current_injuries).length} TO REVIEW
                            </span>
                          )}
                        </div>
                        {/* Current injuries at a glance, worst first */}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 5 }}>
                          {p.current_injuries.slice(0, 4).map((inj) => (
                            <span
                              key={inj.key}
                              title={`${regionLabel(inj.region)} · ${inj.triage}${inj.pwat != null ? ` · PWAT ${inj.pwat.toFixed(1)}` : ''}`}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text2)', padding: '2px 8px', borderRadius: 10, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}
                            >
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: TRIAGE_DOT[inj.triage] ?? 'var(--text3)' }} />
                              {regionLabel(inj.region)}
                            </span>
                          ))}
                          {p.current_injuries.length > 4 && (
                            <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', padding: '2px 4px' }}>+{p.current_injuries.length - 4} more</span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>
                          ID {p.patient_id}{p.incidents.length > 1 ? ` · ${p.incidents.length} scans` : ''} · last scanned{' '}
                          <span title={formatDate(p.last_seen)} style={{ color: isActive ? 'var(--text2)' : undefined }}>{timeAgo(p.last_seen)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Highest PWAT */}
                    <div style={{ width: 100, display: 'flex', justifyContent: 'flex-end' }}>
                      <div style={{ padding: '4px 12px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)', borderRadius: 4 }}>
                        <span style={{ fontWeight: 700, fontFamily: 'var(--mono)', fontSize: 16, color: pwatColor(p.max_pwat ?? 0) }}>
                          {p.max_pwat != null ? p.max_pwat.toFixed(1) : '—'}
                        </span>
                      </div>
                    </div>

                    {/* Location */}
                    <div style={{ width: 170, flexDirection: 'column', alignItems: 'flex-end', fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)' }} className="hidden sm:flex">
                      <div style={{ color: 'var(--text2)' }}>{hasGps(p.latest_location) ? gpsText(p.latest_location) : '—'}</div>
                      {p.latest_location?.captured_at && <div style={{ marginTop: 4 }}>fix {formatDate(p.latest_location.captured_at)}</div>}
                    </div>
                  </motion.div>
                );
              })}

              {/* Scans recorded before face login was linked */}
              {showUnidentified && (
                <motion.div
                  variants={rowVariant}
                  onClick={() => router.push(patientHref(UNIDENTIFIED_ID))}
                  style={{ display: 'flex', alignItems: 'center', gap: 24, padding: '14px 24px', cursor: 'pointer', background: 'rgba(0,0,0,0.15)' }}
                  className="hover:bg-white/[0.02]"
                >
                  <div style={{ width: 20 }} />
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 8, border: '1px dashed rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 16 }}>?</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>Unidentified scans</div>
                      <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>
                        {unidentifiedCount} scan{unidentifiedCount === 1 ? '' : 's'} with no patient attached (face not identified, or recorded before face login)
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>View →</span>
                </motion.div>
              )}
            </>
          )}
        </motion.div>
      </div>

      {/* Tactical Floating Export Terminal */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-10 left-1/2 transform -translate-x-1/2 z-50 flex items-center p-1 rounded-2xl overflow-hidden"
            style={{
              background: 'linear-gradient(145deg, rgba(15,23,42,0.95) 0%, rgba(2,6,23,0.98) 100%)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5), 0 0 30px rgba(34,211,238,0.15), inset 0 0 0 1px rgba(255,255,255,0.1)',
              backdropFilter: 'blur(20px)'
            }}
          >
            <div className="absolute inset-0 pointer-events-none rounded-2xl overflow-hidden">
              <motion.div
                className="w-[200%] h-full bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent opacity-60"
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
              />
            </div>
            <div className="relative z-10 flex items-center gap-6 px-6 py-4">
              <div className="flex items-center gap-4">
                <div className="relative flex items-center justify-center w-10 h-10 rounded-full bg-cyan-500/10 border border-cyan-500/40">
                  <span className="text-cyan-400 font-bold font-mono text-lg">{selectedIds.size}</span>
                  <motion.div
                    className="absolute inset-0 rounded-full border border-cyan-400"
                    animate={{ scale: [1, 1.6], opacity: [0.8, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-mono text-cyan-400 tracking-[0.2em] uppercase">Patients Selected</span>
                  <span className="text-xs font-mono text-white tracking-wider">READY FOR EXPORT</span>
                </div>
              </div>
              <div className="w-[1px] h-10 bg-gradient-to-b from-transparent via-white/20 to-transparent" />
              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,255,255,0.1)' }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => exportIncidentsPDF(selectedIncidents())}
                  className="group relative px-6 py-2.5 bg-white/5 border border-white/10 text-white text-[11px] font-mono tracking-widest rounded-lg transition-all overflow-hidden flex items-center gap-2"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                  <svg className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                  BATCH PDF
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05, boxShadow: '0 0 20px rgba(34,211,238,0.4)' }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => exportIncidentsCSV(selectedIncidents())}
                  className="group relative px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 border border-cyan-400/50 text-white text-[11px] font-mono tracking-widest uppercase rounded-lg transition-all overflow-hidden flex items-center gap-2"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                  <svg className="w-4 h-4 text-cyan-200 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  GENERATE CSV
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🛡️ INJECT THE TOUR ENGINE */}
      <VoiceTour storageKey="valkyra-tour-patient-incidents" steps={PAGE_STEPS} />
    </div>
  );
}
