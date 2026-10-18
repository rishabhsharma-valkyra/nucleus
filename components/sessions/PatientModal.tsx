'use client';

import { useNucleusStore } from '@/store/useNucleusStore';
import { usePatient, usePatientWounds, usePermission } from '@/hooks';
import { PERMISSIONS } from '@/lib/rbac';
import { pwatColor, depthSeverityColor, formatDate } from '@/lib/utils';
import { gcsImageUrl as gcsImg, gcsTextUrl as gcsTxt } from '@/lib/api';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MetricInfo, METRIC_DESCRIPTIONS as info } from '@/components/ui/MetricInfo';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

function imgTile(path: string, label: string, onOpen: (p: string, l: string) => void) {
  if (!path) return null;
  return (
    <div
      key={label}
      onClick={() => onOpen(path, label)}
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden', cursor: 'pointer', transition: 'all 0.2s ease' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(96,165,250,0.35)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'; }}
    >
      <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{label}</div>
        <div style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--mono)', letterSpacing: 1 }}>CLICK</div>
      </div>
      <div style={{ padding: 10, background: 'black' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={gcsImg(path)} loading="lazy" alt={label}
          style={{ width: '100%', height: 220, objectFit: 'contain', borderRadius: 8, background: 'black' }}
          crossOrigin="anonymous" 
          onError={(e) => { (e.target as HTMLImageElement).parentElement!.innerHTML = '<div style="height:220px;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.35);font-size:11px;font-family:var(--mono)">Failed to load</div>'; }}
        />
      </div>
    </div>
  );
}

const PDF_IMAGES = [
  { key: 'cropped_image', label: 'Source Crop' },
  { key: 'segmentation_mask', label: 'Segmentation Mask' },
  { key: 'wound_mask_overlay', label: 'Wound Overlay' },
  { key: 'peri_mask_overlay', label: 'Peri-Wound Overlay' },
  { key: 'segmentation_figure', label: 'Segmentation Figure' },
  { key: 'depth_figure', label: 'Depth Figure' },
  { key: 'depth_map', label: 'Depth Heatmap' },
];

export default function PatientModal() {
  const activePatientId = useNucleusStore((s) => s.activePatientId);
  const setActivePatientId = useNucleusStore((s) => s.setActivePatientId);
  const setActiveProfilePatientId = useNucleusStore((s) => s.setActiveProfilePatientId);
  const { data: patient, isLoading } = usePatient(activePatientId);
  // Other wounds for the same patient — only for roles that may list all
  // patients (the /api/patients route enforces this server-side too).
  const canViewAllPatients = usePermission(PERMISSIONS.OPERATIONS_VIEW);
  const { data: patientWounds } = usePatientWounds(patient?.patient_id, canViewAllPatients);

  const [lightbox, setLightbox] = useState<{ path: string; title: string } | null>(null);
  const [reportText, setReportText] = useState<string | null>(null);
  const [activeFrameIndex, setActiveFrameIndex] = useState(0);
  
  const [activeTab, setActiveTab] = useState<'analytics' | 'timeline' | 'pre-arrival'>('analytics');
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [transmitStatus, setTransmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (activePatientId) {
      setActiveTab('analytics');
      setActiveFrameIndex(0);
      setTransmitStatus('idle');
      setIsTransmitting(false);
    }
  }, [activePatientId]);

  if (!activePatientId) return null;
  // Rendered via a portal to document.body — .shell (the dashboard's root
  // layout wrapper) sets position:relative + z-index:1, which creates its
  // own stacking context. That traps this modal's own z-index (however
  // high) below any sibling of .shell with a higher z-index of its own —
  // like GlobalChatbot's floating avatar/drawer (z-100 to z-120) — since
  // the comparison happens at the .shell level (z:1), not the modal's.
  // The portal escapes that ancestor entirely.
  if (typeof document === 'undefined') return null;

  const openImage = (path: string, title: string) => setLightbox({ path, title });

  const openReport = async (path: string) => {
    setReportText('Loading...');
    try {
      const res = await fetch(gcsTxt(path));
      const text = await res.text();
      setReportText(text);
    } catch {
      setReportText('Failed to load report.');
    }
  };

  const s: any = patient;
  
  const frames = s?.frames || [];
  const activeFrame = frames.length > 0 ? frames[activeFrameIndex] : null;

  const displayPwat = activeFrame?.pwat_score ?? s?.pwat_score ?? '—';
  const displayTriage = activeFrame?.triage ?? s?.triage_category;
  const displayDepthSeverity = activeFrame?.depth_severity ?? s?.wound_metrics?.depth_severity ?? '—';
  const displayArea = activeFrame?.area_pct ?? s?.wound_metrics?.area_pct;
  const displayDepthMean = activeFrame?.depth_mean ?? s?.wound_metrics?.depth_mean;
  const displaySourceImage = activeFrame?.source_image ?? s?.source_image ?? '—';
  const displayGemini = activeFrame?.gemini_text ?? s?.gemini_analysis ?? 'No analysis available.';
  const gcs: any = activeFrame?.gcs_outputs ?? s?.gcs_outputs ?? {};

  // Patient → wound → location (null on sessions recorded before these fields)
  const patientLabel = s?.patient_name || s?.patient_id || null;
  const loc = s?.location ?? {};
  const hasGps = loc.latitude != null && loc.longitude != null;
  const gpsText = hasGps ? `${Number(loc.latitude).toFixed(5)}, ${Number(loc.longitude).toFixed(5)}` : null;
  const mapsUrl = hasGps ? `https://www.google.com/maps?q=${loc.latitude},${loc.longitude}` : null;
  const otherWounds = (patientWounds?.sessions ?? []).filter((w: any) => w.session_id !== s?.session_id);

  // No real vitals source exists yet (the headset HUD values are simulated
  // and never stored), so nothing is shown as a reading.
  const vitals = null;

  const timelineEvents = [
    { time: '08:40:02 PM', e: 'Headset uplink stream configured by field unit.', color: 'rgba(255,255,255,0.5)' },
    ...frames.map((f: any, idx: number) => ({
      time: `08:40:0${5 + idx} PM`,
      e: `Automated PWAT score for Frame ${f.frame_index ?? idx + 1}: ${f.pwat_score ?? '—'}`,
      color: 'var(--amber)'
    })),
    { time: '08:40:13 PM', e: 'Operator deployed manual debridement.', color: 'var(--cyan)' }
  ];

  const handleHospitalTransmission = async () => {
    setIsTransmitting(true);
    setTransmitStatus('idle');
    
    const hospitalPayload = {
      incidentId: s?.session_id,
      timestamp: s?.created_at,
      patientId: s?.patient_id,
      patientName: s?.patient_name,
      bodyRegion: s?.body_region,
      location: hasGps ? { latitude: loc.latitude, longitude: loc.longitude } : null,
      triageLevel: displayTriage,
      severity: displayDepthSeverity,
      maxPwat: displayPwat,
      vitals: vitals,
      eta: "9 Minutes",
      framesAnalyzed: frames.length,
      geminiAnalysis: displayGemini
    };
    
    console.log("Transmitting Payload to Hospital API:", hospitalPayload);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1800));
      setTransmitStatus('success');
    } catch {
      setTransmitStatus('error');
    } finally {
      setIsTransmitting(false);
    }
  };

  const handlePdfExport = async () => {
    setIsExporting(true);
    const element = document.getElementById('full-document-hidden-print');
    if (!element) {
      setIsExporting(false);
      return;
    }

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true, 
        backgroundColor: '#060a12',
        windowWidth: 1200, 
      });

      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });
      
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`Valkyra_Case_${activePatientId}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
    } finally {
      setIsExporting(false);
    }
  };

  return createPortal(
    <>
      <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setActivePatientId(null); }}>
        
        {/* 🛡️ CORRECTED ID: spotlight-modal-container */}
        <div id="spotlight-modal-container" className="modal modal-wide" style={{ display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
          
          <div className="modal-header">
            <div>
              <div className="modal-title">
                {isLoading ? 'Loading...' : patientLabel ? `Patient: ${patientLabel}` : `Case: ${s?.session_id}`}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', marginTop: 2 }}>
                {patientLabel && s?.session_id ? `Case ${s.session_id} · ` : ''}
                {s?.created_at ? formatDate(s.created_at) : ''}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {displayTriage && <span className={`triage-badge triage-${displayTriage}`}>{displayTriage}</span>}
              <div className="modal-close" onClick={() => setActivePatientId(null)}>✕</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 20, padding: '0 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.01)' }}>
            {[
              { id: 'analytics', label: 'Core Analytics' },
              { id: 'timeline', label: 'Timeline & Telemetry' },
              { id: 'pre-arrival', label: 'Hospital Pre-Arrival Desk' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  padding: '12px 4px',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === tab.id ? '2px solid var(--cyan)' : '2px solid transparent',
                  color: activeTab === tab.id ? 'var(--cyan)' : 'var(--text3)',
                  fontSize: 12,
                  fontFamily: 'var(--mono)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="modal-body" style={{ flex: 1, overflowY: 'auto' }}>
            {isLoading ? (
              <>
                <div className="skeleton" style={{ width: '100%', height: 18, marginBottom: 8 }} />
                <div className="skeleton" style={{ width: '80%', height: 14 }} />
              </>
            ) : s ? (
              <>
                {activeTab === 'analytics' && (
                  <div>
                    <div style={{ marginBottom: 16, padding: '12px 14px', background: 'rgba(34,211,238,0.04)', border: '1px solid rgba(34,211,238,0.18)', borderRadius: 8 }}>
                      <div style={{ fontSize: 9, color: 'var(--cyan)', fontFamily: 'var(--mono)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>Patient & Wound Location</div>
                      <div className="patient-detail" style={{ marginBottom: 0 }}>
                        <div className="patient-field">
                          <div className="patient-field-label">Patient</div>
                          <div className="patient-field-value" style={{ fontSize: 13 }}>
                            {s.patient_id && canViewAllPatients ? (
                              <span
                                onClick={() => setActiveProfilePatientId(s.patient_id)}
                                style={{ color: 'var(--cyan)', textDecoration: 'underline', cursor: 'pointer' }}
                                title="Open patient profile — all incidents"
                              >
                                {s.patient_name || s.patient_id}
                              </span>
                            ) : (s.patient_name || '—')}
                          </div>
                        </div>
                        <div className="patient-field">
                          <div className="patient-field-label">Patient ID</div>
                          <div className="patient-field-value" style={{ fontSize: 11, fontFamily: 'var(--mono)', wordBreak: 'break-all' }}>{s.patient_id || '—'}</div>
                        </div>
                        <div className="patient-field">
                          <div className="patient-field-label">Body Region</div>
                          <div className="patient-field-value" style={{ fontSize: 13 }}>{s.body_region || '—'}</div>
                        </div>
                        <div className="patient-field">
                          <div className="patient-field-label">Scan Location (GPS)</div>
                          <div className="patient-field-value" style={{ fontSize: 11, fontFamily: 'var(--mono)' }}>
                            {mapsUrl ? (
                              <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--cyan)', textDecoration: 'underline' }}>
                                {gpsText} ↗
                              </a>
                            ) : '—'}
                            {loc.captured_at && (
                              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>fix at {formatDate(loc.captured_at)}</div>
                            )}
                          </div>
                        </div>
                      </div>
                      {!patientLabel && !hasGps && !s.body_region && (
                        <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', marginTop: 8 }}>
                          Recorded before patient and location capture was enabled.
                        </div>
                      )}
                      {otherWounds.length > 0 && (
                        <div style={{ marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10 }}>
                          <div style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--mono)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>
                            Other wounds for this patient ({otherWounds.length})
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {otherWounds.map((w: any) => (
                              <div
                                key={w.session_id}
                                onClick={() => setActivePatientId(w.session_id)}
                                className="hover:bg-white/5"
                                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontFamily: 'var(--mono)' }}
                              >
                                <span className={`triage-badge triage-${w.triage_category}`}>{w.triage_category}</span>
                                <span style={{ color: 'var(--text)', flex: 1 }}>{w.body_region || 'Region not specified'}</span>
                                <span style={{ color: pwatColor(w.pwat_score) }}>PWAT {w.pwat_score != null ? Number(w.pwat_score).toFixed(1) : '—'}</span>
                                <span style={{ color: 'var(--text3)' }}>{formatDate(w.created_at)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {frames.length > 1 && (
                      <div style={{ marginBottom: 16, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 8 }}>
                        <div style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--mono)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>Captured Frames</div>
                        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                          {frames.map((f: any, i: number) => (
                            <button
                              key={i}
                              onClick={() => setActiveFrameIndex(i)}
                              style={{
                                padding: '6px 14px',
                                borderRadius: 6,
                                fontSize: 11,
                                fontFamily: 'var(--mono)',
                                cursor: 'pointer',
                                border: activeFrameIndex === i ? '1px solid rgba(96,165,250,0.5)' : '1px solid rgba(255,255,255,0.1)',
                                background: activeFrameIndex === i ? 'rgba(96,165,250,0.1)' : 'transparent',
                                color: activeFrameIndex === i ? '#60a5fa' : 'var(--text2)',
                                transition: 'all 0.2s',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              Frame {f.frame_index ?? i + 1}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="patient-detail">
                      <div className="patient-field">
                        <div className="patient-field-label"><MetricInfo label="PWAT Score" description={info.pwat} /></div>
                        <div className="patient-field-value" style={{ fontSize: 22, fontWeight: 700, color: pwatColor(displayPwat) }}>{displayPwat}</div>
                      </div>
                      <div className="patient-field">
                        <div className="patient-field-label"><MetricInfo label="Triage Category" description={info.triage} /></div>
                        <div className="patient-field-value"><span className={`triage-badge triage-${displayTriage}`}>{displayTriage}</span></div>
                      </div>
                      <div className="patient-field">
                        <div className="patient-field-label">Recorded At</div>
                        <div className="patient-field-value" style={{ fontSize: 12 }}>{formatDate(s.created_at)}</div> 
                      </div>
                      <div className="patient-field">
                        <div className="patient-field-label"><MetricInfo label="Depth Severity" description={info.depthSeverity} /></div>
                        <div className="patient-field-value" style={{ color: depthSeverityColor(displayDepthSeverity === '—' ? null : displayDepthSeverity) }}>{displayDepthSeverity}</div>
                      </div>
                      {displayArea != null && (
                        <div className="patient-field">
                          <div className="patient-field-label"><MetricInfo label="Wound Area %" description={info.woundArea} /></div>
                          <div className="patient-field-value">{Number(displayArea).toFixed(1)}%</div>
                        </div>
                      )}
                      {displayDepthMean != null && (
                        <div className="patient-field">
                          <div className="patient-field-label"><MetricInfo label="Depth Mean" description={info.depthMean} /></div>
                          <div className="patient-field-value">{Number(displayDepthMean).toFixed(3)}</div>
                        </div>
                      )}
                    </div>

                    <div style={{ marginBottom: 14, padding: '8px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 8 }}>
                      <div style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--mono)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>Source Image (Frame {activeFrameIndex + 1})</div>
                      <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text2)', wordBreak: 'break-all' }}>{displaySourceImage}</div>
                    </div>

                    <div>
                      <div style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--mono)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>Gemini Clinical Analysis</div>
                      <div className="gemini-box">{displayGemini}</div>
                    </div>

                    <div style={{ marginTop: 20 }}>
                      <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>Generated Clinical Outputs</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
                        {imgTile(gcs.cropped_image, 'Cropped Wound', openImage)}
                        {imgTile(gcs.segmentation_mask, 'Segmentation Mask', openImage)}
                        {imgTile(gcs.wound_mask_overlay, 'Wound Overlay', openImage)}
                        {imgTile(gcs.peri_mask_overlay, 'Peri-Wound Overlay', openImage)}
                        {imgTile(gcs.segmentation_figure, 'Segmentation Figure', openImage)}
                        {imgTile(gcs.depth_figure, 'Depth Figure', openImage)}
                        {imgTile(gcs.depth_map, 'Depth Heatmap', openImage)}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'timeline' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    <div>
                      <div style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--mono)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>Vitals</div>
                      <div style={{ padding: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>
                        Not captured yet — the headset does not record real vitals, so none are stored for this case.
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--mono)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>Incident Progression</div>
                      <div style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', marginLeft: 8, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
                        {timelineEvents.map((evt, i) => (
                          <div key={i} style={{ position: 'relative' }}>
                            <div style={{ position: 'absolute', left: -26, top: 4, width: 10, height: 10, borderRadius: '50%', background: 'black', border: `1px solid ${evt.color}` }} />
                            <div style={{ fontSize: 12, color: 'var(--text)', fontFamily: 'var(--mono)' }}>{evt.e}</div>
                            <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', marginTop: 4 }}>{evt.time}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'pre-arrival' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div style={{ background: 'rgba(34,211,238,0.05)', border: '1px solid rgba(34,211,238,0.2)', padding: 20, borderRadius: 8 }}>
                      <div style={{ fontSize: 10, color: 'var(--cyan)', fontFamily: 'var(--mono)', letterSpacing: 2, fontWeight: 700, marginBottom: 12 }}>STRUCTURED PRE-ARRIVAL MANIFEST</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>
                        <div><strong style={{ color: 'var(--text)' }}>Injury Class:</strong> Tactical Trauma Wounding Registry</div>
                        <div><strong style={{ color: 'var(--text)' }}>Severity Level:</strong> Critical Triage // {displayDepthSeverity}</div>
                        <div><strong style={{ color: 'var(--text)' }}>Calculated ETA:</strong> 09 Minutes Remaining to Trauma Bay</div>
                      </div>
                    </div>

                    <button 
                      onClick={handleHospitalTransmission}
                      disabled={isTransmitting}
                      style={{
                        padding: '14px', borderRadius: 8, border: 'none', cursor: isTransmitting ? 'not-allowed' : 'pointer',
                        fontSize: 12, fontWeight: 700, fontFamily: 'var(--mono)',
                        background: transmitStatus === 'success' ? 'var(--green)' : 'var(--cyan)',
                        color: 'black', transition: 'all 0.2s ease'
                      }}
                    >
                      {isTransmitting ? 'TRANSMITTING ENCRYPTED PAYLOAD...' : 
                        transmitStatus === 'success' ? '✓ TRANSMITTED SECURELY TO HOSPITAL' : 
                        'TRANSMIT PRE-ARRIVAL PAYLOAD'}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div style={{ color: 'var(--red)', fontFamily: 'var(--mono)', fontSize: 12 }}>Failed to load patient record.</div>
            )}
          </div>

          <div className="modal-footer" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16 }}>
            <div style={{ display: 'flex', gap: 10 }}>
               <button className="btn" onClick={() => setActivePatientId(null)}>Close</button>
               <button 
                 className="btn" 
                 onClick={handlePdfExport} 
                 disabled={isExporting} 
                 style={{ borderColor: 'var(--cyan)', color: 'var(--cyan)' }}
               >
                 {isExporting ? 'Generating...' : '📄 Export Full PDF'}
               </button>
            </div>
            
            {s && gcs.gemini_report && (
              // 🛡️ CORRECTED SYNTAX: Clean Javascript comment
              <button 
                className="btn btn-accent" 
                onClick={() => openReport(gcs.gemini_report)}
              >
                🤖 Gemini Report
              </button>
            )}
          </div>
        </div>
      </div>

      {lightbox && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, backdropFilter: 'blur(12px)', cursor: 'zoom-out' }}
          onClick={() => setLightbox(null)}>
          <div style={{ fontSize: 12, color: 'rgba(240,244,255,0.5)', fontFamily: 'var(--mono)', letterSpacing: 2, textTransform: 'uppercase' }}>{lightbox.title}</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={gcsImg(lightbox.path)} alt={lightbox.title} style={{ maxWidth: '90vw', maxHeight: '80vh', borderRadius: 12, border: '1px solid rgba(255,255,255,0.15)' }} crossOrigin="anonymous" />
          <div style={{ fontSize: 11, color: 'rgba(240,244,255,0.3)', fontFamily: 'var(--mono)' }}>click anywhere to close</div>
        </div>
      )}

      {reportText !== null && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, backdropFilter: 'blur(12px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setReportText(null); }}>
          <div style={{ width: '100%', maxWidth: 680, background: 'rgba(6,12,24,0.95)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              {/* 🛡️ CORRECTED SYNTAX: fontWeight is now camelCase */}
              <span style={{ fontSize: 12, fontWeight: 600, color: '#f0f4ff' }}>📄 Gemini Clinical Report</span>
              <div onClick={() => setReportText(null)} style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 11, color: 'rgba(240,244,255,0.5)' }}>✕</div>
            </div>
            <pre style={{ padding: 18, fontFamily: 'var(--mono)', fontSize: 11, color: 'rgba(240,244,255,0.7)', lineHeight: 1.8, overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
              {reportText}
            </pre>
          </div>
        </div>
      )}

      {s && (
        <div style={{ position: 'absolute', top: -9999, left: -9999, pointerEvents: 'none', opacity: 0 }}>
          <div id="full-document-hidden-print" style={{ width: 1000, padding: 40, background: '#060a12', color: '#fff', fontFamily: 'monospace' }}>
            <div style={{ borderBottom: '2px solid #3b82f6', paddingBottom: 20, marginBottom: 30 }}>
              <h1 style={{ fontSize: 24, margin: '0 0 10px 0', color: '#fff' }}>VALKYRA CLINICAL INCIDENT REPORT</h1>
              <div style={{ fontSize: 14, color: '#9ca3af' }}>SESSION ID: {s.session_id}</div>
              <div style={{ fontSize: 14, color: '#9ca3af', marginTop: 5 }}>DATE: {formatDate(s.created_at)}</div>
              <div style={{ fontSize: 14, color: '#9ca3af', marginTop: 5 }}>PATIENT: {s.patient_name || '—'}{s.patient_id ? ` (${s.patient_id})` : ''}</div>
              <div style={{ fontSize: 14, color: '#9ca3af', marginTop: 5 }}>BODY REGION: {s.body_region || '—'}</div>
              <div style={{ fontSize: 14, color: '#9ca3af', marginTop: 5 }}>SCAN LOCATION: {gpsText || '—'}</div>
            </div>

            {frames.map((frame: any, idx: number) => {
              const frameGcs = frame.gcs_outputs || {};
              const framePwat = frame.pwat_score ?? '—';
              const frameDepth = frame.depth_severity ?? '—';
              const frameArea = frame.area_pct != null ? `${Number(frame.area_pct).toFixed(1)}%` : '—';
              
              return (
                <div key={idx} style={{ marginBottom: 40, background: '#0f172a', padding: 20, borderRadius: 10, border: '1px solid #1e293b', pageBreakInside: 'avoid' }}>
                  <h2 style={{ fontSize: 18, borderBottom: '1px solid #334155', paddingBottom: 10, color: '#38bdf8' }}>
                    FRAME {frame.frame_index ?? idx + 1}
                  </h2>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 15, marginTop: 15 }}>
                    <div style={{ background: '#020617', padding: 15, borderRadius: 8 }}>
                      <div style={{ color: '#64748b', fontSize: 12 }}>PWAT SCORE</div>
                      <div style={{ color: pwatColor(framePwat), fontSize: 20, fontWeight: 'bold' }}>{framePwat}</div>
                    </div>
                    <div style={{ background: '#020617', padding: 15, borderRadius: 8 }}>
                      <div style={{ color: '#64748b', fontSize: 12 }}>DEPTH SEVERITY</div>
                      <div style={{ color: '#fff', fontSize: 16 }}>{frameDepth}</div>
                    </div>
                    <div style={{ background: '#020617', padding: 15, borderRadius: 8 }}>
                      <div style={{ color: '#64748b', fontSize: 12 }}>WOUND AREA %</div>
                      <div style={{ color: '#fff', fontSize: 16 }}>{frameArea}</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 15, marginTop: 20 }}>
                    {PDF_IMAGES.map((imgDef) => {
                      if (!frameGcs[imgDef.key]) return null;
                      return (
                        <div key={imgDef.key}>
                          <div style={{ fontSize: 11, color: '#cbd5e1', marginBottom: 5 }}>{imgDef.label}</div>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={gcsImg(frameGcs[imgDef.key])} crossOrigin="anonymous" style={{ width: '100%', height: 180, objectFit: 'contain', background: '#000', borderRadius: 8 }} alt={imgDef.label} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            <div style={{ pageBreakInside: 'avoid', borderTop: '2px solid #334155', paddingTop: 20 }}>
              <h2 style={{ fontSize: 18, color: '#38bdf8' }}>TELEMETRY & LOGS</h2>
              <div style={{ marginTop: 15 }}>
                {timelineEvents.map((evt, i) => (
                  <div key={i} style={{ marginBottom: 10, display: 'flex', gap: 15 }}>
                    <div style={{ color: '#94a3b8', width: 120 }}>{evt.time}</div>
                    <div style={{ color: '#f8fafc' }}>{evt.e}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body
  );
}