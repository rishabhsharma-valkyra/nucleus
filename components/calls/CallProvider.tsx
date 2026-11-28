'use client';
// Video calls from headsets: polls for ringing calls, and owns the one live
// call (a LiveKit room). Lives in the dashboard layout, so a call carries on
// while the doctor moves between pages.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ConnectionQuality, LocalVideoTrack, RemoteParticipant, RemoteTrack, RemoteVideoTrack, Room, RoomEvent, Track,
} from 'livekit-client';
import { usePermission } from '@/hooks';
import { PERMISSIONS } from '@/lib/rbac';
import { useNucleusStore } from '@/store/useNucleusStore';
import {
  CallInfo, CallJoin, INCOMING_POLL_MS, acceptCall, declineCall, endCall, fetchIncomingCalls, isHeadset,
} from '@/lib/calls';

export type Connection = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export interface Participant {
  identity: string;
  name: string;
  kind: 'headset' | 'doctor';
  isLocal: boolean;
}

export interface ActiveCall {
  call: CallJoin;
  view: 'full' | 'mini';
  connection: Connection;
  quality: ConnectionQuality;
  micOn: boolean;
  camOn: boolean;
  micError: string | null;
  participants: Participant[];
  headsetVideo: RemoteVideoTrack | null;
  headsetAudio: boolean;
  localVideo: LocalVideoTrack | null;
  // Why the call is over (shown until the doctor closes the panel)
  ended: string | null;
}

interface CallContextValue {
  canAnswer: boolean;
  ringing: CallInfo[];          // ringing now, not declined by me
  joinable: CallInfo[];         // in progress, I can join
  active: ActiveCall | null;
  joining: string | null;
  answer: (call: CallInfo) => Promise<void>;
  decline: (call: CallInfo) => Promise<void>;
  leave: () => void;
  endForAll: () => Promise<void>;
  toggleMic: () => Promise<void>;
  toggleCam: () => Promise<void>;
  setView: (view: 'full' | 'mini') => void;
  close: () => void;
}

const CallContext = createContext<CallContextValue | null>(null);

export function useCalls() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCalls must be used inside <CallProvider>');
  return ctx;
}

function participantsOf(room: Room): Participant[] {
  const describe = (p: { identity: string; name?: string }, isLocal: boolean): Participant => ({
    identity: p.identity,
    name: p.name || (isHeadset(p.identity) ? 'Headset' : 'Doctor'),
    kind: isHeadset(p.identity) ? 'headset' : 'doctor',
    isLocal,
  });
  return [
    ...Array.from(room.remoteParticipants.values()).map((p) => describe(p, false)),
    describe(room.localParticipant, true),
  ].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'headset' ? -1 : 1));
}

// A short two-tone chime, repeated while a call rings. Browsers may block
// sound until the page has been clicked once; that is fine (the card shows).
function useRingtone(on: boolean) {
  useEffect(() => {
    if (!on) return;
    let ctx: AudioContext | null = null;
    const chime = () => {
      try {
        ctx = ctx ?? new AudioContext();
        [0, 0.22].forEach((offset, i) => {
          const osc = ctx!.createOscillator();
          const gain = ctx!.createGain();
          osc.frequency.value = i ? 660 : 880;
          gain.gain.setValueAtTime(0.0001, ctx!.currentTime + offset);
          gain.gain.exponentialRampToValueAtTime(0.12, ctx!.currentTime + offset + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx!.currentTime + offset + 0.18);
          osc.connect(gain).connect(ctx!.destination);
          osc.start(ctx!.currentTime + offset);
          osc.stop(ctx!.currentTime + offset + 0.2);
        });
      } catch { /* sound not allowed yet */ }
    };
    chime();
    const timer = setInterval(chime, 2_500);
    return () => { clearInterval(timer); ctx?.close().catch(() => {}); };
  }, [on]);
}

export default function CallProvider({ children }: { children: React.ReactNode }) {
  const canAnswer = usePermission(PERMISSIONS.CALLS_ANSWER);
  const addToast = useNucleusStore((s) => s.addToast);
  const queryClient = useQueryClient();
  const pathname = usePathname();

  const [active, setActive] = useState<ActiveCall | null>(null);
  const [joining, setJoining] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const roomRef = useRef<Room | null>(null);
  const leavingRef = useRef(false);
  const audioHostRef = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ['calls', 'incoming'],
    queryFn: fetchIncomingCalls,
    enabled: canAnswer,
    refetchInterval: INCOMING_POLL_MS,
    refetchIntervalInBackground: true,
    staleTime: 0,
  });

  const activeId = active?.call.call_id;
  const ringing = useMemo(
    () => (data?.calls ?? []).filter((c) => c.status === 'ringing' && !c.declined_by_me && !hidden.has(c.call_id) && c.call_id !== activeId),
    [data, hidden, activeId]
  );
  const joinable = useMemo(
    () => (data?.calls ?? []).filter((c) => c.status === 'active' && c.call_id !== activeId),
    [data, activeId]
  );

  useRingtone(ringing.length > 0 && !active);

  const patch = useCallback((p: Partial<ActiveCall>) => {
    setActive((a) => (a ? { ...a, ...p } : a));
  }, []);

  const teardown = useCallback(() => {
    const room = roomRef.current;
    roomRef.current = null;
    if (room) {
      room.removeAllListeners();
      room.disconnect().catch(() => {});
    }
    if (audioHostRef.current) audioHostRef.current.innerHTML = '';
  }, []);

  // A call carries on across pages; the full view shrinks when the doctor navigates
  useEffect(() => {
    setActive((a) => (a && a.view === 'full' ? { ...a, view: 'mini' } : a));
  }, [pathname]);

  useEffect(() => () => teardown(), [teardown]);

  const answer = useCallback(async (info: CallInfo) => {
    if (roomRef.current) {
      addToast({ type: 'error', message: 'Leave your current call before joining another one.' });
      return;
    }
    setJoining(info.call_id);
    leavingRef.current = false;
    let join: CallJoin;
    try {
      join = await acceptCall(info.call_id);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      addToast({ type: 'error', message: detail ? `Could not join: ${detail}` : 'Could not join the call.' });
      setJoining(null);
      queryClient.invalidateQueries({ queryKey: ['calls'] });
      return;
    }

    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;
    setActive({
      call: join, view: 'full', connection: 'connecting', quality: ConnectionQuality.Unknown,
      micOn: false, camOn: false, micError: null, participants: [], headsetVideo: null,
      headsetAudio: false, localVideo: null, ended: null,
    });

    const refresh = () => patch({ participants: participantsOf(room) });

    room
      .on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _pub, p: RemoteParticipant) => {
        if (track.kind === Track.Kind.Video && isHeadset(p.identity)) {
          patch({ headsetVideo: track as RemoteVideoTrack });
        } else if (track.kind === Track.Kind.Audio) {
          const el = track.attach();
          el.dataset.identity = p.identity;
          audioHostRef.current?.appendChild(el);
          if (isHeadset(p.identity)) patch({ headsetAudio: true });
        }
      })
      .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, _pub, p: RemoteParticipant) => {
        track.detach().forEach((el) => el.remove());
        if (isHeadset(p.identity)) {
          if (track.kind === Track.Kind.Video) patch({ headsetVideo: null });
          else patch({ headsetAudio: false });
        }
      })
      .on(RoomEvent.LocalTrackPublished, (pub) => {
        if (pub.track?.kind === Track.Kind.Video) patch({ localVideo: pub.track as LocalVideoTrack });
      })
      .on(RoomEvent.LocalTrackUnpublished, (pub) => {
        if (pub.kind === Track.Kind.Video) patch({ localVideo: null });
      })
      .on(RoomEvent.ParticipantConnected, refresh)
      .on(RoomEvent.ParticipantDisconnected, (p: RemoteParticipant) => {
        refresh();
        if (isHeadset(p.identity)) patch({ ended: 'The responder left the call.', headsetVideo: null, headsetAudio: false });
      })
      .on(RoomEvent.ConnectionQualityChanged, (q, p) => { if (p.isLocal) patch({ quality: q }); })
      .on(RoomEvent.Reconnecting, () => patch({ connection: 'reconnecting' }))
      .on(RoomEvent.Reconnected, () => { patch({ connection: 'connected' }); refresh(); })
      .on(RoomEvent.Disconnected, () => {
        if (leavingRef.current) return;
        patch({ connection: 'disconnected', ended: 'The call has ended.', headsetVideo: null, headsetAudio: false, localVideo: null });
        if (audioHostRef.current) audioHostRef.current.innerHTML = '';
        queryClient.invalidateQueries({ queryKey: ['calls'] });
      });

    try {
      await room.connect(join.server_url, join.token);
    } catch {
      teardown();
      setActive(null);
      setJoining(null);
      addToast({ type: 'error', message: 'Could not connect to the call. Check your network and try again.' });
      return;
    }
    patch({ connection: 'connected', participants: participantsOf(room) });
    setJoining(null);
    room.startAudio().catch(() => {});
    try {
      await room.localParticipant.setMicrophoneEnabled(true);
      patch({ micOn: true });
    } catch {
      patch({ micError: 'Microphone blocked: you can watch and listen. Allow the microphone in your browser to talk.' });
    }
    queryClient.invalidateQueries({ queryKey: ['calls'] });
  }, [addToast, patch, queryClient, teardown]);

  const decline = useCallback(async (info: CallInfo) => {
    setHidden((h) => new Set(h).add(info.call_id));
    try { await declineCall(info.call_id); } catch { /* hidden locally anyway */ }
  }, []);

  const leave = useCallback(() => {
    leavingRef.current = true;
    teardown();
    setActive(null);
    queryClient.invalidateQueries({ queryKey: ['calls'] });
  }, [queryClient, teardown]);

  const endForAll = useCallback(async () => {
    const id = active?.call.call_id;
    if (id) {
      try { await endCall(id); } catch { addToast({ type: 'error', message: 'Could not end the call for everyone; you have left it.' }); }
    }
    leave();
  }, [active, addToast, leave]);

  const toggleMic = useCallback(async () => {
    const room = roomRef.current;
    if (!room || !active) return;
    try {
      await room.localParticipant.setMicrophoneEnabled(!active.micOn);
      patch({ micOn: !active.micOn, micError: null });
    } catch {
      patch({ micError: 'Microphone blocked. Allow it in your browser settings to talk.' });
    }
  }, [active, patch]);

  const toggleCam = useCallback(async () => {
    const room = roomRef.current;
    if (!room || !active) return;
    try {
      await room.localParticipant.setCameraEnabled(!active.camOn);
      patch({ camOn: !active.camOn });
    } catch {
      addToast({ type: 'error', message: 'Camera blocked. Allow it in your browser settings.' });
    }
  }, [active, addToast, patch]);

  const setView = useCallback((view: 'full' | 'mini') => patch({ view }), [patch]);
  const close = useCallback(() => leave(), [leave]);

  const value = useMemo<CallContextValue>(() => ({
    canAnswer, ringing, joinable, active, joining, answer, decline, leave, endForAll, toggleMic, toggleCam, setView, close,
  }), [canAnswer, ringing, joinable, active, joining, answer, decline, leave, endForAll, toggleMic, toggleCam, setView, close]);

  return (
    <CallContext.Provider value={value}>
      {children}
      <div ref={audioHostRef} aria-hidden="true" style={{ display: 'none' }} />
    </CallContext.Provider>
  );
}
