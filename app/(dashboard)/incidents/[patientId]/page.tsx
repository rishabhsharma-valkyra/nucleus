'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAllSessions } from '@/hooks';
import { useNucleusStore } from '@/store/useNucleusStore';
import { gcsImageUrl } from '@/lib/api';
import { formatDate, pwatColor, parseTimestamp } from '@/lib/utils';
import { sessionStatus } from '@/lib/sessionsAsIncidents';
import { groupSessionsByPatient, hasGps, mapsUrl, gpsText, UNIDENTIFIED_ID } from '@/lib/patients';
import { exportIncidentsCSV, exportIncidentsPDF } from '@/lib/exports';
import PatientPhoto from '@/components/patients/PatientPhoto';
import HospitalHandoff from '@/components/patients/HospitalHandoff';
import { Session } from '@/types';

const label: React.CSSProperties = {
  fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--mono)', letterSpacing: 2, textTransform: 'uppercase',
};

function safeDecode(v: string): string {
  try { return decodeURIComponent(v); } catch { return v; }
}

const TRIAGE_DOT: Record<string, string> = { Red: 'var(--red)', Orange: 'var(--amber)', Yellow: '#facc15', Green: 'var(--green)' };

function InjuryCard({ inc, onOpen, index }: { inc: Session; onOpen: () => void; index: number }) {
  const frames: any[] = (inc as any).frames ?? [];
  const crop = inc.gcs_outputs?.cropped_image;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}
      onClick={onOpen}
      className="hover:bg-white/[0.03]"
      style={{ display: 'flex', gap: 16, alignItems: 'center', padding: 12, border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer', transition: 'background 0.2s' }}
    >
      <div style={{ width: 84, height: 84, flexShrink: 0, borderRadius: 8, overflow: 'hidden', background: 'black' }}>
        {crop && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={gcsImageUrl(crop)} alt="Wound crop" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{inc.body_region || 'Region not specified'}</span>
          <span className={`triage-badge triage-${inc.triage_category}`}>{inc.triage_category}</span>
          <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>{formatDate(inc.created_at)}</span>
        </div>
        <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text2)', display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ color: pwatColor(inc.pwat_score) }}>PWAT {inc.pwat_score != null ? Number(inc.pwat_score).toFixed(1) : '—'}</span>
          <span>{inc.wound_metrics?.depth_severity ?? '—'}</span>
          <span>{hasGps(inc.location) ? gpsText(inc.location) : 'No GPS'}</span>
          {frames.length > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }} title="Captured frames (triage per frame)">
              {frames.length} frame{frames.length === 1 ? '' : 's'}
              {frames.map((f, i) => (
                <span key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: TRIAGE_DOT[f.triage] ?? 'var(--text3)' }} />
              ))}
            </span>
          )}
        </div>
      </div>
      <span style={{ fontSize: 10, color: 'var(--accent)', fontFamily: 'var(--mono)', flexShrink: 0 }}>Open injury →</span>
    </motion.div>
  );
}

// One patient's record: identity, photo, last location, vitals status and
// every injury (wound scan) over time. Clicking an injury opens the case
// window, where the patient's other injuries are one click away.
export default function PatientRecordPage() {
  const params = useParams<{ patientId: string }>();
  // Next 14 hands dynamic segments over still URL-encoded ("Krishna%20Sharad%20Soni")
  const patientId = safeDecode(params.patientId);
  const isUnidentified = patientId === UNIDENTIFIED_ID;

  const { data: sessionsData, isLoading } = useAllSessions();
  const setActiveCaseId = useNucleusStore((s) => s.setActivePatientId);

  const sessions = sessionsData?.sessions ?? [];
  const record = useMemo(
    () => (isUnidentified ? null : groupSessionsByPatient(sessions.filter((s) => s.patient_id === patientId)).patients[0] ?? null),
    [sessions, patientId, isUnidentified]
  );
  const unidentified = useMemo(
    () => (isUnidentified
      ? sessions.filter((s) => !s.patient_id).sort((a, b) => (parseTimestamp(b.created_at)?.getTime() ?? 0) - (parseTimestamp(a.created_at)?.getTime() ?? 0))
      : []),
    [sessions, isUnidentified]
  );

  // "Hospital handoff →" from the case window links to #hospital-handoff;
  // the section only exists once data has loaded, so scroll to it then.
  const hasRecord = !!record;
  useEffect(() => {
    if (hasRecord && window.location.hash === '#hospital-handoff') {
      document.getElementById('hospital-handoff')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [hasRecord]);

  const back = (
    <Link href="/incidents" style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text3)', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16 }} className="hover:text-white">
      ← Patient Incidents
    </Link>
  );

  if (isLoading) {
    return (
      <div className="pb-32">
        {back}
        <div className="skeleton" style={{ height: 170, marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 90, marginBottom: 10 }} />
        <div className="skeleton" style={{ height: 90 }} />
      </div>
    );
  }

  // ── Scans without a patient ────────────────────────────────────────────
  if (isUnidentified) {
    return (
      <div className="pb-32">
        {back}
        <div className="card" style={{ padding: 20, marginBottom: 18 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Unidentified scans</div>
          <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>
            {unidentified.length} scan{unidentified.length === 1 ? '' : 's'} recorded before face login was linked to wound scans. They carry no patient, location or body region.
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {unidentified.map((inc, i) => (
            <InjuryCard key={inc.session_id} inc={inc} index={i} onOpen={() => setActiveCaseId(inc.session_id)} />
          ))}
        </div>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="pb-32">
        {back}
        <div className="card" style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text3)', fontFamily: 'var(--mono)', fontSize: 12 }}>
          No incidents recorded for patient “{patientId}”.
        </div>
      </div>
    );
  }

  const name = record.patient_name || record.patient_id;
  const loc = record.latest_location;
  const isActive = sessionStatus(record.last_seen) === 'Active';

  return (
    <div className="pb-32">
      {back}

      {/* Identity */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card" style={{ padding: 20, marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
          <PatientPhoto patientId={record.patient_id} name={name} size={150} />

          <div style={{ flex: 1, minWidth: 300 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{name}</span>
              <span className={`triage-badge triage-${record.worst_triage} uppercase`}>{record.worst_triage}</span>
              {isActive && <span style={{ fontSize: 9, fontFamily: 'var(--mono)', letterSpacing: 1.5, color: 'var(--cyan)' }}>● ACTIVE</span>}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button className="btn" style={{ fontSize: 11 }} onClick={() => exportIncidentsCSV(record.incidents, `Valkyra_${record.patient_id}`)}>Export CSV</button>
                <button className="btn" style={{ fontSize: 11, borderColor: 'var(--cyan)', color: 'var(--cyan)' }} onClick={() => exportIncidentsPDF(record.incidents, `Valkyra Nucleus - ${name}`)}>📄 Export PDF</button>
              </div>
            </div>
            <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text3)', marginBottom: 14 }}>ID {record.patient_id}</div>

            <div className="patient-detail" style={{ marginBottom: 0 }}>
              <div className="patient-field">
                <div className="patient-field-label">Incidents</div>
                <div className="patient-field-value">{record.incidents.length}</div>
              </div>
              <div className="patient-field">
                <div className="patient-field-label">Highest PWAT</div>
                <div className="patient-field-value" style={{ color: pwatColor(record.max_pwat ?? 0) }}>
                  {record.max_pwat != null ? record.max_pwat.toFixed(1) : '—'}
                </div>
              </div>
              <div className="patient-field">
                <div className="patient-field-label">First Seen</div>
                <div className="patient-field-value" style={{ fontSize: 12 }}>{formatDate(record.first_seen)}</div>
              </div>
              <div className="patient-field">
                <div className="patient-field-label">Last Seen</div>
                <div className="patient-field-value" style={{ fontSize: 12 }}>{formatDate(record.last_seen)}</div>
              </div>
              <div className="patient-field">
                <div className="patient-field-label">Latest Body Region</div>
                <div className="patient-field-value" style={{ fontSize: 13 }}>{record.latest_body_region || '—'}</div>
              </div>
              <div className="patient-field">
                <div className="patient-field-label">Last Known Location</div>
                <div className="patient-field-value" style={{ fontSize: 11, fontFamily: 'var(--mono)' }}>
                  {hasGps(loc) ? (
                    <a href={mapsUrl(loc)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--cyan)', textDecoration: 'underline' }}>
                      {gpsText(loc)} ↗
                    </a>
                  ) : '—'}
                  {loc?.captured_at && <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>fix at {formatDate(loc.captured_at)}</div>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Vitals — no real source yet, so say so instead of showing numbers */}
      <div style={{ marginBottom: 18, padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 8 }}>
        <div style={{ ...label, marginBottom: 4 }}>Vitals</div>
        <div style={{ fontSize: 11, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>
          Not captured yet — the headset does not record real vitals, so none are stored.
        </div>
      </div>

      {/* Hospital handoff — per patient */}
      <HospitalHandoff key={record.patient_id} record={record} />

      {/* Injuries, newest first */}
      <div style={{ ...label, marginBottom: 10 }}>Injuries ({record.incidents.length})</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {record.incidents.map((inc, i) => (
          <InjuryCard key={inc.session_id} inc={inc} index={i} onOpen={() => setActiveCaseId(inc.session_id)} />
        ))}
      </div>
    </div>
  );
}
