'use client';

import { createPortal } from 'react-dom';
import { useNucleusStore } from '@/store/useNucleusStore';
import { usePatientWounds, usePatientPhoto } from '@/hooks';
import { gcsImageUrl } from '@/lib/api';
import { formatDate, pwatColor } from '@/lib/utils';
import { groupSessionsByPatient, hasGps, mapsUrl, gpsText } from '@/lib/patients';

const label: React.CSSProperties = {
  fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--mono)', letterSpacing: 2, textTransform: 'uppercase',
};

// One patient, all of their incidents (wound scans) over time. Opened from
// the Incidents page or from a case's patient name. Rendered just below the
// case modal (z-index 190 vs 200) so "Open case" stacks the case on top.
export default function PatientProfileModal() {
  const patientId = useNucleusStore((s) => s.activeProfilePatientId);
  const setPatientId = useNucleusStore((s) => s.setActiveProfilePatientId);
  const setActiveCaseId = useNucleusStore((s) => s.setActivePatientId);

  const { data: woundsData, isLoading } = usePatientWounds(patientId);
  const { data: photoData, isLoading: photoLoading } = usePatientPhoto(patientId);

  if (!patientId) return null;
  if (typeof document === 'undefined') return null;

  const record = groupSessionsByPatient(woundsData?.sessions ?? []).patients[0] ?? null;
  const name = record?.patient_name || patientId;
  const loc = record?.latest_location ?? null;
  const close = () => setPatientId(null);

  return createPortal(
    <div className="modal-overlay" style={{ zIndex: 190 }} onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal modal-wide" style={{ display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Patient: {name}</div>
            <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', marginTop: 2 }}>
              ID {patientId}
              {record && ` · ${record.incidents.length} incident${record.incidents.length === 1 ? '' : 's'} · last seen ${formatDate(record.last_seen)}`}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {record && <span className={`triage-badge triage-${record.worst_triage}`}>{record.worst_triage}</span>}
            <div className="modal-close" onClick={close}>✕</div>
          </div>
        </div>

        <div className="modal-body" style={{ flex: 1, overflowY: 'auto' }}>
          {isLoading ? (
            <>
              <div className="skeleton" style={{ width: '100%', height: 18, marginBottom: 8 }} />
              <div className="skeleton" style={{ width: '80%', height: 14 }} />
            </>
          ) : !record ? (
            <div style={{ color: 'var(--text3)', fontFamily: 'var(--mono)', fontSize: 12 }}>No incidents recorded for this patient.</div>
          ) : (
            <>
              {/* Photo + identity */}
              <div style={{ display: 'flex', gap: 20, marginBottom: 18, flexWrap: 'wrap' }}>
                <div style={{ width: 168, height: 168, flexShrink: 0, borderRadius: 12, overflow: 'hidden', background: 'black', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {photoLoading ? (
                    <div className="skeleton" style={{ width: '100%', height: '100%' }} />
                  ) : photoData?.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={gcsImageUrl(photoData.photo)} alt={`${name} — registered face`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', textAlign: 'center', padding: 12 }}>No registered photo</div>
                  )}
                </div>

                <div className="patient-detail" style={{ flex: 1, minWidth: 280, marginBottom: 0 }}>
                  <div className="patient-field">
                    <div className="patient-field-label">Patient</div>
                    <div className="patient-field-value" style={{ fontSize: 13 }}>{record.patient_name || '—'}</div>
                  </div>
                  <div className="patient-field">
                    <div className="patient-field-label">Patient ID</div>
                    <div className="patient-field-value" style={{ fontSize: 11, fontFamily: 'var(--mono)', wordBreak: 'break-all' }}>{patientId}</div>
                  </div>
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
                      {loc?.captured_at && (
                        <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>fix at {formatDate(loc.captured_at)}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Vitals — no real source yet, so say so instead of showing numbers */}
              <div style={{ marginBottom: 18, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 8 }}>
                <div style={{ ...label, marginBottom: 4 }}>Vitals</div>
                <div style={{ fontSize: 11, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>
                  Not captured yet — the headset does not record real vitals, so none are stored.
                </div>
              </div>

              {/* Incidents, newest first */}
              <div style={{ ...label, marginBottom: 10 }}>Incidents ({record.incidents.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {record.incidents.map((inc) => {
                  const crop = inc.gcs_outputs?.cropped_image;
                  return (
                    <div
                      key={inc.session_id}
                      onClick={() => setActiveCaseId(inc.session_id)}
                      className="hover:bg-white/5"
                      style={{ display: 'flex', gap: 14, alignItems: 'center', padding: 10, border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer', transition: 'background 0.2s' }}
                    >
                      <div style={{ width: 72, height: 72, flexShrink: 0, borderRadius: 8, overflow: 'hidden', background: 'black' }}>
                        {crop && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={gcsImageUrl(crop)} alt="Wound crop" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                          <span className={`triage-badge triage-${inc.triage_category}`}>{inc.triage_category}</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{inc.body_region || 'Region not specified'}</span>
                          <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>{formatDate(inc.created_at)}</span>
                        </div>
                        <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text2)', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                          <span style={{ color: pwatColor(inc.pwat_score) }}>PWAT {inc.pwat_score != null ? Number(inc.pwat_score).toFixed(1) : '—'}</span>
                          <span>{inc.wound_metrics?.depth_severity ?? '—'}</span>
                          <span>{hasGps(inc.location) ? gpsText(inc.location) : 'No GPS'}</span>
                        </div>
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--accent)', fontFamily: 'var(--mono)', flexShrink: 0 }}>Open case →</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="modal-footer" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16 }}>
          <button className="btn" onClick={close}>Close</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
