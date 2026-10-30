'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Session } from '@/types';
import {
  SessionsSnapshot, mergeSessions, hasPendingAnalysis, shouldReloadFully, POLL_MS, POLL_PENDING_MS,
} from '@/lib/sessionSync';
import { useSession } from 'next-auth/react';
import { fetchSummary, fetchSessions, fetchMySessions, fetchPatient, fetchPatientWounds, fetchPatientPhoto, fetchLiveLocations, checkHealth } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useNucleusStore } from '@/store/useNucleusStore';
import { Permission, hasPermission } from '@/lib/rbac';
import { DEV_ROLE_SWITCH_ENABLED, readDevRoleCookie } from '@/lib/devRole';

// ── RBAC ────────────────────────────────────────────────────
export function useRole() {
  const { data: session } = useSession();
  // TEMPORARY testing override — see lib/devRole.ts. No-ops unless
  // NEXT_PUBLIC_ENABLE_DEV_ROLE_SWITCH=true.
  if (DEV_ROLE_SWITCH_ENABLED) {
    const override = readDevRoleCookie();
    if (override) return override;
  }
  return session?.user?.role;
}

export function usePermission(permission: Permission) {
  const role = useRole();
  return hasPermission(role, permission);
}

export function useSummary(enabled = true) {
  return useQuery({
    queryKey: queryKeys.summary,
    queryFn: fetchSummary,
    staleTime: 60_000,
    refetchInterval: 60_000,
    enabled,
  });
}

export function useSessions(limit = 20, offset = 0) {
  return useQuery({
    queryKey: queryKeys.sessions(limit, offset),
    queryFn: () => fetchSessions(limit, offset),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
}

// The backend hard-caps /patients at 100 rows per request (getPagination in
// app.js), so a single fetchSessions(100) silently truncated the moment the
// dataset passed 100 sessions — Overview, Reports, Mortality and the
// critical-case watcher would all have been quietly computing over the
// newest 100 only, disagreeing with the totals from /patients/summary.
// Page through instead, with a ceiling so a runaway dataset can't spin here.
const SESSIONS_PAGE_SIZE = 500;
const SESSIONS_MAX_PAGES = 8; // 4000 sessions

async function loadSessionPages(since?: string): Promise<{ sessions: Session[]; asOf?: string; truncated: boolean }> {
  const all: Session[] = [];
  let asOf: string | undefined;
  let truncated = false;
  for (let page = 0; page < SESSIONS_MAX_PAGES; page++) {
    const data = await fetchSessions(SESSIONS_PAGE_SIZE, page * SESSIONS_PAGE_SIZE, since);
    // The FIRST page's as_of is the earliest — safe as the next `since`
    if (page === 0) asOf = data.as_of;
    const batch = data.sessions ?? [];
    all.push(...batch);
    if (batch.length < SESSIONS_PAGE_SIZE) break;
    if (page === SESSIONS_MAX_PAGES - 1) truncated = true;
  }
  return { sessions: all, asOf, truncated };
}

export function useAllSessions() {
  const setAllSessions = useNucleusStore((s) => s.setAllSessions);
  const qc = useQueryClient();
  return useQuery<SessionsSnapshot>({
    queryKey: queryKeys.allSessions,
    queryFn: async () => {
      const prev = qc.getQueryData<SessionsSnapshot>(queryKeys.allSessions);

      // Incremental: only scans delivered / AI-updated since the last poll
      if (prev && !shouldReloadFully(prev)) {
        try {
          const { sessions: changed, asOf } = await loadSessionPages(prev.asOf);
          const merged = mergeSessions(prev.sessions, changed);
          if (changed.length) setAllSessions(merged);
          return { ...prev, total_returned: merged.length, sessions: merged, asOf: asOf ?? prev.asOf };
        } catch (e) {
          console.warn('[useAllSessions] incremental poll failed — doing a full reload', e);
        }
      }

      const { sessions: all, asOf, truncated } = await loadSessionPages();
      if (truncated) {
        console.warn(
          `[useAllSessions] Stopped at ${all.length} sessions (${SESSIONS_MAX_PAGES}-page ceiling). ` +
          'Dashboard aggregates are now a partial view — move these pages to server-side aggregation.'
        );
      }
      setAllSessions(all);
      return { total_returned: all.length, sessions: all, asOf, fullLoadedAt: Date.now() };
    },
    staleTime: 15_000,
    refetchInterval: (query) => (hasPendingAnalysis(query.state.data?.sessions) ? POLL_PENDING_MS : POLL_MS),
  });
}

export function useMySessions(limit = 20, offset = 0) {
  return useQuery({
    queryKey: queryKeys.mySessions(limit, offset),
    queryFn: () => fetchMySessions(limit, offset),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
}

export function usePatient(sessionId: string | null) {
  return useQuery({
    queryKey: queryKeys.patient(sessionId!),
    queryFn: () => fetchPatient(sessionId!),
    enabled: !!sessionId,
    staleTime: 5 * 60_000,
  });
}

// All wound sessions for the patient behind the open case. Disabled when the
// session has no patient (older sessions) or the caller can't list patients.
export function usePatientWounds(patientId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.patientWounds(patientId ?? ''),
    queryFn: () => fetchPatientWounds(patientId!),
    enabled: enabled && !!patientId,
    staleTime: 60_000,
  });
}

export function usePatientPhoto(patientId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.patientPhoto(patientId ?? ''),
    queryFn: () => fetchPatientPhoto(patientId!),
    enabled: enabled && !!patientId,
    staleTime: 10 * 60_000,
  });
}

export function useLiveLocations(enabled = true) {
  return useQuery({
    queryKey: queryKeys.liveLocations,
    queryFn: fetchLiveLocations,
    enabled,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}

export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: checkHealth,
    staleTime: 0,
    enabled: false,
    retry: false,
  });
}
