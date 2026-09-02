'use client';
import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useAllSessions } from '@/hooks';
import { useNucleusStore } from '@/store/useNucleusStore';
import { sessionStatus } from '@/lib/sessionsAsIncidents';

// Purely client-side alerting — there's no push infrastructure, so this
// polls the same React Query cache every other page already reads (no
// extra network cost) and diffs active Red-triage session IDs against what
// it's seen before. The first tick after mount only baselines (so opening
// the app doesn't alert-storm for every Red case that already existed);
// anything new after that fires a toast, an entry in the alert bell, an
// optional chime, and an optional OS notification.
function playAlertChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // Web Audio unsupported/blocked — silently skip the chime.
  }
}

export default function CriticalAlertWatcher() {
  const { status } = useSession();
  const { data } = useAllSessions();
  const addToast = useNucleusStore((s) => s.addToast);
  const addCriticalAlert = useNucleusStore((s) => s.addCriticalAlert);
  const alertSoundEnabled = useNucleusStore((s) => s.alertSoundEnabled);
  const browserNotifyEnabled = useNucleusStore((s) => s.browserNotifyEnabled);

  const seenRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (status !== 'authenticated' || !data?.sessions) return;

    const activeRed = data.sessions.filter(
      (s: any) => s.triage_category === 'Red' && sessionStatus(s.created_at) === 'Active'
    );

    if (seenRef.current === null) {
      seenRef.current = new Set(activeRed.map((s: any) => s.session_id));
      return;
    }

    const newOnes = activeRed.filter((s: any) => !seenRef.current!.has(s.session_id));
    if (newOnes.length === 0) return;

    newOnes.forEach((s: any) => {
      seenRef.current!.add(s.session_id);
      const message = `New Red-triage case · PWAT ${Number(s.pwat_score).toFixed(1)} · ${s.session_id.slice(0, 8)}…`;

      addToast({ type: 'alert', message });
      addCriticalAlert({
        id: `${s.session_id}-${Date.now()}`,
        sessionId: s.session_id,
        message,
        time: new Date().toLocaleTimeString(),
      });

      if (alertSoundEnabled) playAlertChime();

      if (browserNotifyEnabled && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('Valkyra Nucleus — Critical Case', {
          body: message,
          tag: s.session_id,
        });
      }
    });
  }, [data, status, addToast, addCriticalAlert, alertSoundEnabled, browserNotifyEnabled]);

  return null;
}
