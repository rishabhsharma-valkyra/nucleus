'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { fetchSummary, fetchSessions, fetchMySessions, fetchPatient, fetchIncidents, createIncident, resolveIncident, checkHealth } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useNucleusStore } from '@/store/useNucleusStore';
import { generateIncidentId } from '@/lib/utils';
import { Incident } from '@/types';
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
const SESSIONS_PAGE_SIZE = 100;
const SESSIONS_MAX_PAGES = 20; // 2000 sessions

export function useAllSessions() {
  const setAllSessions = useNucleusStore((s) => s.setAllSessions);
  return useQuery({
    queryKey: queryKeys.allSessions,
    queryFn: async () => {
      const all: Awaited<ReturnType<typeof fetchSessions>>['sessions'] = [];
      let truncated = false;

      for (let page = 0; page < SESSIONS_MAX_PAGES; page++) {
        const data = await fetchSessions(SESSIONS_PAGE_SIZE, page * SESSIONS_PAGE_SIZE);
        const batch = data.sessions ?? [];
        all.push(...batch);
        if (batch.length < SESSIONS_PAGE_SIZE) break;
        if (page === SESSIONS_MAX_PAGES - 1) truncated = true;
      }

      if (truncated) {
        console.warn(
          `[useAllSessions] Stopped at ${all.length} sessions (${SESSIONS_MAX_PAGES}-page ceiling). ` +
          'Dashboard aggregates are now a partial view — move these pages to server-side aggregation.'
        );
      }

      setAllSessions(all);
      return { total_returned: all.length, sessions: all };
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
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

export function useIncidents() {
  return useQuery({
    queryKey: queryKeys.incidents,
    queryFn: fetchIncidents,
    staleTime: 30_000,
  });
}

export function useCreateIncident() {
  const qc = useQueryClient();
  const addToast = useNucleusStore((s) => s.addToast);
  const setIncidentModalOpen = useNucleusStore((s) => s.setIncidentModalOpen);

  return useMutation({
    mutationFn: (data: Omit<Incident, 'id' | 'created_at'>) => {
      const id = generateIncidentId();
      return createIncident({ ...data, id } as any);
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.incidents });
      setIncidentModalOpen(false);
      addToast({ type: 'success', message: `✓ Incident deployed · ${variables.responder} dispatched` });
    },
    onError: () => {
      addToast({ type: 'error', message: 'Failed to create incident. Check API connection.' });
    },
  });
}

export function useResolveIncident() {
  const qc = useQueryClient();
  const addToast = useNucleusStore((s) => s.addToast);

  return useMutation({
    mutationFn: resolveIncident,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.incidents });
      addToast({ type: 'success', message: 'Incident marked as resolved.' });
    },
    onError: () => {
      addToast({ type: 'error', message: 'Failed to resolve incident.' });
    },
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
