'use client';
// What a doctor sees of video calls: the ringing card, the full call view and
// the mini player that stays up while they move between pages.
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ConnectionQuality, LocalVideoTrack, RemoteVideoTrack } from 'livekit-client';
import { usePatientWounds } from '@/hooks';
import { CallInfo, callerLabel, formatDuration } from '@/lib/calls';
import { ActiveCall, useCalls } from './CallProvider';

function useSecondsSince(iso: string | null | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return iso ? Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000)) : null;
}

function TrackVideo({ track, muted = true, className }: { track: RemoteVideoTrack | LocalVideoTrack; muted?: boolean; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    track.attach(el);
    return () => { track.detach(el); };
  }, [track]);
  return <video ref={ref} className={className} autoPlay playsInline muted={muted} />;
}

const Icon = {
  video: <path d="M23 7l-7 5 7 5V7zM1 7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2z" />,
  videoOff: <path d="M1 1l22 22M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" />,
  mic: <><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10v1a7 7 0 0 0 14 0v-1M12 18v4" /></>,
  micOff: <path d="M1 1l22 22M9 9v2a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.94-.6M17 16.95A7 7 0 0 1 5 11v-1m14 0v1a7 7 0 0 1-.11 1.23M12 18v4" />,
  close: <path d="M18 6L6 18M6 6l12 12" />,
  expand: <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />,
  shrink: <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" />,
  hangup: <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07M5.6 13.4A19.79 19.79 0 0 1 2.08 4.18 2 2 0 0 1 4.07 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91M23 1L1 23" />,
};

function Svg({ d, size = 18 }: { d: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
  );
}

const QUALITY: Record<string, string> = {
  [ConnectionQuality.Excellent]: 'excellent', [ConnectionQuality.Good]: 'good',
  [ConnectionQuality.Poor]: 'poor', [ConnectionQuality.Lost]: 'lost', [ConnectionQuality.Unknown]: 'checking',
};

// ── Ringing ──────────────────────────────────────────────────────────────

function IncomingCard({ call }: { call: CallInfo }) {
  const { answer, decline, joining, active } = useCalls();
  const ringingFor = useSecondsSince(call.created_at);
  const busy = joining === call.call_id;
  return (
    <section className="call-incoming" aria-label="Incoming video call" role="alertdialog" aria-live="assertive">
      <div className="call-incoming-hd">
        <span className="call-ring-dot" aria-hidden="true" />
        <span className="call-eyebrow">Incoming video call</span>
        <span className="call-mono-dim">{formatDuration(ringingFor)}</span>
      </div>
      <div className="call-incoming-body">
        <div className="call-patient-name">{call.patient_name || 'Unidentified patient'}</div>
        <dl className="call-facts">
          <dt>From</dt><dd>{callerLabel(call)}{call.device_id ? ` · ${call.device_id}` : ''}</dd>
          <dt>Ringing</dt><dd>All on-call doctors</dd>
        </dl>
        {active && <p className="call-note">Answering will need you to leave your current call first.</p>}
        <div className="call-incoming-actions">
          <button className="call-btn call-btn-decline" onClick={() => decline(call)} disabled={busy}>
            <Svg d={Icon.close} size={16} /> Decline
          </button>
          <button className="call-btn call-btn-accept" onClick={() => answer(call)} disabled={busy || !!active}>
            <Svg d={Icon.video} size={16} /> {busy ? 'Joining…' : 'Accept'}
          </button>
        </div>
        {call.patient_id && (
          <Link className="call-link" href={`/incidents/${encodeURIComponent(call.patient_id)}`}>Open patient record first</Link>
        )}
      </div>
    </section>
  );
}

function JoinableBanner({ call }: { call: CallInfo }) {
  const { answer, joining, active } = useCalls();
  if (active) return null;
  return (
    <div className="call-joinable" role="status">
      <span className="call-live-dot" aria-hidden="true" />
      <span>Call in progress · {call.patient_name || 'Unidentified patient'} · {call.doctors.length} doctor{call.doctors.length === 1 ? '' : 's'}</span>
      <button className="call-btn call-btn-small" onClick={() => answer(call)} disabled={joining === call.call_id}>
        {joining === call.call_id ? 'Joining…' : 'Join'}
      </button>
    </div>
  );
}

// ── In a call ────────────────────────────────────────────────────────────

function PatientContext({ patientId }: { patientId: string | null }) {
  const { data } = usePatientWounds(patientId);
  const latest = data?.sessions?.[0];
  if (!patientId) return <p className="call-mono-dim">The responder has not identified the patient.</p>;
  return (
    <dl className="call-facts">
      <dt>Triage</dt><dd>{latest ? <span className={`call-triage call-triage-${latest.triage_category.toLowerCase()}`}>{latest.triage_category}</span> : '—'}</dd>
      <dt>Latest scan</dt><dd>{latest ? `${new Date(latest.created_at).toLocaleTimeString()} · ${latest.body_region || 'Region not recorded'}` : 'No scans yet'}</dd>
      <dt>PWAT</dt><dd>{latest?.pwat_score != null ? latest.pwat_score.toFixed(1) : '—'}</dd>
    </dl>
  );
}

function Controls({ a, compact = false }: { a: ActiveCall; compact?: boolean }) {
  const { toggleMic, toggleCam, setView, leave, endForAll } = useCalls();
  const [confirmEnd, setConfirmEnd] = useState(false);
  const size = compact ? 16 : 20;
  return (
    <div className={compact ? 'call-controls call-controls-compact' : 'call-controls'}>
      <button className={`call-ctl ${a.micOn ? '' : 'call-ctl-off'}`} onClick={toggleMic}
        aria-label={a.micOn ? 'Mute microphone' : 'Unmute microphone'} aria-pressed={!a.micOn}>
        <Svg d={a.micOn ? Icon.mic : Icon.micOff} size={size} />
      </button>
      {!compact && (
        <button className={`call-ctl ${a.camOn ? '' : 'call-ctl-off'}`} onClick={toggleCam}
          aria-label={a.camOn ? 'Turn camera off' : 'Turn camera on'} aria-pressed={!a.camOn}>
          <Svg d={a.camOn ? Icon.video : Icon.videoOff} size={size} />
        </button>
      )}
      <button className="call-ctl" onClick={() => setView(a.view === 'full' ? 'mini' : 'full')}
        aria-label={a.view === 'full' ? 'Minimise call' : 'Expand call'}>
        <Svg d={a.view === 'full' ? Icon.shrink : Icon.expand} size={size} />
      </button>
      {compact ? (
        <button className="call-ctl call-ctl-hangup" onClick={leave} aria-label="Leave call"><Svg d={Icon.hangup} size={size} /></button>
      ) : confirmEnd ? (
        <div className="call-end-choice" role="group" aria-label="End call">
          <button className="call-btn call-btn-small" onClick={leave}>Leave (others stay)</button>
          <button className="call-btn call-btn-small call-btn-danger" onClick={endForAll}>End for everyone</button>
          <button className="call-btn call-btn-small" onClick={() => setConfirmEnd(false)}>Cancel</button>
        </div>
      ) : (
        <button className="call-ctl call-ctl-hangup" onClick={() => setConfirmEnd(true)} aria-label="End or leave call">
          <Svg d={Icon.hangup} size={size} />
        </button>
      )}
    </div>
  );
}

function Stage({ a, compact = false }: { a: ActiveCall; compact?: boolean }) {
  const waiting = a.connection === 'connecting' ? 'Connecting…'
    : a.connection === 'reconnecting' ? 'Reconnecting…'
    : a.ended ? a.ended
    : !a.participants.some((p) => p.kind === 'headset') ? 'Waiting for the headset to connect…'
    : 'Headset connected, waiting for its camera…';
  return (
    <div className="call-stage">
      {a.headsetVideo && !a.ended
        ? <TrackVideo track={a.headsetVideo} className="call-video" />
        : <div className="call-stage-empty"><Svg d={Icon.video} size={compact ? 22 : 40} /><span>{waiting}</span></div>}
      {!compact && a.localVideo && (
        <div className="call-selfview"><TrackVideo track={a.localVideo} className="call-video" /><span>You</span></div>
      )}
    </div>
  );
}

function FullView({ a }: { a: ActiveCall }) {
  const elapsed = useSecondsSince(a.call.answered_at || a.call.created_at);
  const { close } = useCalls();
  const headset = a.participants.find((p) => p.kind === 'headset');
  return (
    <div className="call-full" role="dialog" aria-label="Video call">
      <header className="call-full-hd">
        <div>
          <div className="page-title">Call · {a.call.patient_name || 'Unidentified patient'}</div>
          <div className="page-sub">{callerLabel(a.call)}{a.call.device_id ? ` · headset ${a.call.device_id}` : ''}</div>
        </div>
        <div className="call-pills">
          <span className="call-pill call-pill-live">● {a.ended ? 'ENDED' : `LIVE ${formatDuration(elapsed)}`}</span>
          <span className="call-pill">Connection: {a.connection === 'connected' ? QUALITY[a.quality] : a.connection}</span>
        </div>
      </header>
      <div className="call-full-body">
        <section className="call-main" aria-label="Headset video">
          <p className="call-banner" role="status">
            The responder hears you through the headset. They can&apos;t see your camera yet.
          </p>
          {a.micError && <p className="call-banner call-banner-warn" role="alert">{a.micError}</p>}
          <div className="call-stage-wrap">
            <Stage a={a} />
            {a.ended
              ? <div className="call-controls"><button className="call-btn" onClick={close}>Close</button></div>
              : <Controls a={a} />}
          </div>
        </section>
        <aside className="call-side" aria-label="Call details">
          <div className="card call-card">
            <div className="call-eyebrow">Patient</div>
            <div className="call-patient-name">{a.call.patient_name || 'Unidentified patient'}</div>
            <PatientContext patientId={a.call.patient_id} />
            {a.call.patient_id && (
              <Link className="call-link" href={`/incidents/${encodeURIComponent(a.call.patient_id)}`} target="_blank">
                Open full record in a new tab
              </Link>
            )}
          </div>
          <div className="card call-card">
            <div className="call-eyebrow">In this call ({a.participants.length})</div>
            <ul className="call-people">
              {a.participants.map((p) => (
                <li key={p.identity}>
                  <span className="call-live-dot" aria-hidden="true" />
                  {p.isLocal ? 'You' : p.name}{p.kind === 'headset' ? ' (headset)' : ''}
                  <span className="call-mono-dim">
                    {p.kind === 'headset' ? [a.headsetVideo && 'video', a.headsetAudio && 'audio'].filter(Boolean).join(' · ') || 'joining'
                      : p.isLocal ? [a.micOn && 'audio', a.camOn && 'video'].filter(Boolean).join(' · ') || 'muted' : ''}
                  </span>
                </li>
              ))}
            </ul>
            {!headset && !a.ended && <p className="call-mono-dim">The headset isn&apos;t in the room yet.</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}

function MiniView({ a }: { a: ActiveCall }) {
  const elapsed = useSecondsSince(a.call.answered_at || a.call.created_at);
  const { close } = useCalls();
  return (
    <section className="call-mini" aria-label="Call in progress">
      <Stage a={a} compact />
      <span className="call-mini-time">● {a.ended ? 'Ended' : formatDuration(elapsed)}</span>
      <div className="call-mini-bar">
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="call-mini-name">{a.call.patient_name || 'Unidentified patient'}</div>
          <div className="call-mono-dim">{a.participants.length} in call</div>
        </div>
        {a.ended
          ? <button className="call-btn call-btn-small" onClick={close}>Close</button>
          : <Controls a={a} compact />}
      </div>
    </section>
  );
}

export default function CallLayer() {
  const { canAnswer, ringing, joinable, active } = useCalls();
  if (!canAnswer) return null;
  return (
    <>
      {active?.view === 'full' && <FullView a={active} />}
      {active?.view === 'mini' && <MiniView a={active} />}
      <div className="call-stack">
        {ringing.slice(0, 3).map((c) => <IncomingCard key={c.call_id} call={c} />)}
        {joinable.slice(0, 2).map((c) => <JoinableBanner key={c.call_id} call={c} />)}
      </div>
    </>
  );
}
