'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAllSessions } from '@/hooks';
import { useNucleusStore } from '@/store/useNucleusStore';
import { gcsImageUrl } from '@/lib/api';
import { formatDate, pwatColor, parseTimestamp, timeAgo } from '@/lib/utils';
import { sessionStatus } from '@/lib/sessionsAsIncidents';
import {
  groupSessionsByPatient, hasGps, mapsUrl, gpsText, UNIDENTIFIED_ID,
  Injury, injuriesOf, regionLabel, regionTrends, RegionTrendPoint, MULTIPLE_INJURIES,
} from '@/lib/patients';
import { exportIncidentsCSV, exportIncidentsPDF } from '@/lib/exports';
import PatientPhoto from '@/components/patients/PatientPhoto';
import HospitalHandoff from '@/components/patients/HospitalHandoff';
import BodyMap from '@/components/patients/BodyMap';
import { Session } from '@/types';

const label: React.CSSProperties = {
  fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--mono)', letterSpacing: 2, textTransform: 'uppercase',
};

function safeDecode(v: string): string {
  try { return decodeURIComponent(v); } catch { return v; }
}

const TRIAGE_DOT: Record<string, string> = { Red: 'var(--red)', Orange: 'var(--amber)', Yellow: '#facc15', Green: 'var(--green)' };

function InjuryCard({ injury, onOpen, index }: { injury: Injury; onOpen: () => void; index: number }) {
  const { frames, worst } = injury;
  const crop = worst?.gcs_outputs?.cropped_image ?? injury.session.gcs_outputs?.cropped_image;
  const depth = worst?.depth_severity ?? injury.session.wound_metrics?.depth_severity ?? '—';
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
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{regionLabel(injury.region)}</span>
          <span className={`triage-badge triage-${injury.triage}`}>{injury.triage}</span>
          {injury.sideUnknown && (
            <span style={{ fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--amber)' }} title="The side could not be seen in the scan — confirm before treatment">SIDE NOT CONFIRMED</span>
          )}
          {injury.review ? (
            <span style={{ fontSize: 9, fontFamily: 'var(--mono)', color: '#a78bfa' }} title={`Reviewed by ${injury.review.reviewer_name || injury.review.reviewer_email}`}>
              {injury.review.verdict === 'corrected' ? '✎ DOCTOR-CORRECTED' : '✓ DOCTOR-CONFIRMED'}
            </span>
          ) : (
            <span style={{ fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--text3)' }} title="No clinician has confirmed this AI read yet">NEEDS REVIEW</span>
          )}
        </div>
        <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text2)', display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ color: pwatColor(injury.pwat ?? 0) }}>PWAT {injury.pwat != null ? injury.pwat.toFixed(1) : '—'}</span>
          <span>{depth}</span>
          {frames.length > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }} title="Captured frames (triage per frame) — the worst one sets the injury's triage">
              {frames.length} frame{frames.length === 1 ? '' : 's'}
              {frames.map((f, i) => (
                <span key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: TRIAGE_DOT[f.triage ?? ''] ?? 'var(--text3)' }} />
              ))}
            </span>
          )}
        </div>
      </div>
      <span style={{ fontSize: 10, color: 'var(--accent)', fontFamily: 'var(--mono)', flexShrink: 0 }}>Open injury →</span>
    </motion.div>
  );
}

// One End Scan: when and where it happened, then every wound scanned in it.
function EncounterBlock({ encounter, index, latest, onOpen }: {
  encounter: Session; index: number; latest: boolean; onOpen: (sessionId: string, region: string | null) => void;
}) {
  const injuries = injuriesOf(encounter);
  // Worst injury in this scan (clinician triage where reviewed)
  const scanTriage = injuries[0]?.triage ?? encounter.triage_category;
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{latest ? 'Latest scan' : 'Earlier scan'} · {formatDate(encounter.created_at)}</span>
        <span className={`triage-badge triage-${scanTriage}`}>{scanTriage}</span>
        <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>
          {injuries.length} injur{injuries.length === 1 ? 'y' : 'ies'} · {hasGps(encounter.location) ? (
            <a href={mapsUrl(encounter.location)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--cyan)' }}>{gpsText(encounter.location)} ↗</a>
          ) : 'no GPS'}
        </span>
        {injuries.length >= MULTIPLE_INJURIES && (
          <span style={{ fontSize: 9, fontFamily: 'var(--mono)', letterSpacing: 1.5, color: 'var(--amber)' }} title="Several wounds can add up to a serious patient — review overall priority">
            MULTIPLE INJURIES
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {injuries.map((inj, i) => (
          <InjuryCard key={inj.key} injury={inj} index={index + i} onOpen={() => onOpen(encounter.session_id, inj.groupRegion)} />
        ))}
      </div>
    </div>
  );
}

// Same region over repeat scans: is the wound getting worse?
function TrendRow({ region, points }: { region: string; points: RegionTrendPoint[] }) {
  const first = points[0].pwat, last = points[points.length - 1].pwat;
  const delta = first != null && last != null ? last - first : null;
  // PWAT: higher = worse wound
  const verdict = delta == null ? null : delta > 1 ? { t: 'worsening', c: 'var(--red)' } : delta < -1 ? { t: 'improving', c: 'var(--green)' } : { t: 'stable', c: 'var(--text3)' };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text2)', padding: '4px 0' }}>
      <span style={{ color: 'var(--text)', fontWeight: 600, fontFamily: 'inherit', minWidth: 150 }}>{region}</span>
      <span>{points.map((p) => (p.pwat != null ? p.pwat.toFixed(1) : '—')).join(' → ')}</span>
      {verdict && <span style={{ color: verdict.c }}>{verdict.t}</span>}
      <span style={{ color: 'var(--text3)', fontSize: 10 }}>{formatDate(points[0].at)} – {formatDate(points[points.length - 1].at)}</span>
    </div>
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
            {unidentified.length} scan{unidentified.length === 1 ? '' : 's'} with no patient attached — the face could not be identified, the responder continued without an ID, or the scan was recorded before face login was linked.
          </div>
        </div>
        {unidentified.map((enc, i) => (
          <EncounterBlock key={enc.session_id} encounter={enc} index={i} latest={i === 0} onOpen={setActiveCaseId} />
        ))}
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
  const trends = regionTrends(record.incidents);
  const currentCount = record.current_injuries.length;

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
              {currentCount >= MULTIPLE_INJURIES && (
                <span style={{ fontSize: 9, fontFamily: 'var(--mono)', letterSpacing: 1.5, color: 'var(--amber)', border: '1px solid rgba(251,191,36,0.4)', borderRadius: 6, padding: '3px 8px' }} title="Several wounds can add up to a serious patient — review overall priority">
                  MULTIPLE INJURIES ({currentCount})
                </span>
              )}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-accent"
                  style={{ fontSize: 11 }}
                  onClick={() => document.getElementById('hospital-handoff')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                >
                  🏥 Hospital handoff ↓
                </button>
                <button className="btn" style={{ fontSize: 11 }} onClick={() => exportIncidentsCSV(record.incidents, `Valkyra_${record.patient_id}`)}>Export CSV</button>
                <button className="btn" style={{ fontSize: 11, borderColor: 'var(--cyan)', color: 'var(--cyan)' }} onClick={() => exportIncidentsPDF(record.incidents, `Valkyra Nucleus - ${name}`)}>📄 Export PDF</button>
              </div>
            </div>
            <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text3)', marginBottom: 14 }}>ID {record.patient_id}</div>

            <div className="patient-detail" style={{ marginBottom: 0 }}>
              <div className="patient-field">
                <div className="patient-field-label">Current Injuries</div>
                <div className="patient-field-value">{currentCount}</div>
              </div>
              <div className="patient-field">
                <div className="patient-field-label">Scans</div>
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
                <div className="patient-field-label">Last Scanned</div>
                <div className="patient-field-value" style={{ fontSize: 12 }} title={formatDate(record.last_seen)}>{timeAgo(record.last_seen)}</div>
              </div>
              <div className="patient-field">
                <div className="patient-field-label">Current Body Regions</div>
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
              {/* No real source yet, so say so instead of showing numbers */}
              <div className="patient-field">
                <div className="patient-field-label">Vitals</div>
                <div className="patient-field-value" style={{ fontSize: 11, color: 'var(--text3)' }} title="The headset does not record real vitals yet, so none are stored">Not captured</div>
              </div>
            </div>
          </div>

          {/* Where the current injuries are — click a marker to open it */}
          <div style={{ flexShrink: 0, padding: '4px 8px', borderLeft: '1px solid var(--border)' }}>
            <div style={{ ...label, textAlign: 'center', marginBottom: 4 }}>Current injuries</div>
            <BodyMap
              injuries={record.current_injuries}
              height={250}
              onOpen={(inj) => setActiveCaseId(inj.session.session_id, inj.groupRegion)}
            />
          </div>
        </div>
      </motion.div>

      {/* Reassessment: same region over repeat scans */}
      {trends.size > 0 && (
        <div style={{ marginBottom: 18, padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 8 }}>
          <div style={{ ...label, marginBottom: 6 }}>Wound trend across scans (PWAT — higher is worse)</div>
          {Array.from(trends.entries()).map(([region, points]) => <TrendRow key={region} region={region} points={points} />)}
        </div>
      )}

      {/* Scans (End Scans), newest first, each with its injuries */}
      <div style={{ ...label, marginBottom: 10 }}>Injuries by scan ({record.incidents.length} scan{record.incidents.length === 1 ? '' : 's'})</div>
      {record.incidents.map((enc, i) => (
        <EncounterBlock key={enc.session_id} encounter={enc} index={i} latest={i === 0} onOpen={setActiveCaseId} />
      ))}

      {/* Hospital handoff — per patient, built from the injuries above */}
      <div style={{ marginTop: 8 }}>
        <HospitalHandoff key={record.patient_id} record={record} />
      </div>
    </div>
  );
}
