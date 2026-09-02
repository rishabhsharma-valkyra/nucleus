'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Session, Toast, TriageCategory, CriticalAlert } from '@/types';
import { DeviceAssignments, getDefaultAssignments } from '@/lib/deviceAssignments';

interface NucleusStore {
  // Cached sessions
  allSessions: Session[];
  setAllSessions: (s: Session[]) => void;

  // Active patient modal
  activePatientId: string | null;
  setActivePatientId: (id: string | null) => void;

  // Incident modal
  incidentModalOpen: boolean;
  setIncidentModalOpen: (v: boolean) => void;

  // Filters
  triageFilter: 'all' | TriageCategory;
  setTriageFilter: (f: 'all' | TriageCategory) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;

  // Settings (persisted)
  refreshInterval: number;
  setRefreshInterval: (n: number) => void;
  sessionsPerPage: number;
  setSessionsPerPage: (n: number) => void;

  // Toasts
  toasts: Toast[];
  addToast: (t: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;

  // Device ↔ responder assignments (persisted)
  deviceAssignments: DeviceAssignments;
  assignDevice: (deviceId: string, responderId: string) => void;
  unassignDevice: (deviceId: string) => void;

  // Critical-case alerting (session-only list; preferences persisted)
  criticalAlerts: CriticalAlert[];
  addCriticalAlert: (a: CriticalAlert) => void;
  clearCriticalAlerts: () => void;
  alertSoundEnabled: boolean;
  setAlertSoundEnabled: (v: boolean) => void;
  browserNotifyEnabled: boolean;
  setBrowserNotifyEnabled: (v: boolean) => void;

  // Valkyra AI chat preferences (persisted)
  voiceReplyEnabled: boolean;
  setVoiceReplyEnabled: (v: boolean) => void;
}

export const useNucleusStore = create<NucleusStore>()(
  persist(
    (set) => ({
      allSessions: [],
      setAllSessions: (s) => set({ allSessions: s }),

      activePatientId: null,
      setActivePatientId: (id) => set({ activePatientId: id }),

      incidentModalOpen: false,
      setIncidentModalOpen: (v) => set({ incidentModalOpen: v }),

      triageFilter: 'all',
      setTriageFilter: (f) => set({ triageFilter: f }),
      searchQuery: '',
      setSearchQuery: (q) => set({ searchQuery: q }),

      refreshInterval: 60000,
      setRefreshInterval: (n) => set({ refreshInterval: n }),
      sessionsPerPage: 20,
      setSessionsPerPage: (n) => set({ sessionsPerPage: n }),

      toasts: [],
      addToast: (t) =>
        set((state) => ({
          toasts: [...state.toasts, { ...t, id: Date.now().toString() }],
        })),
      removeToast: (id) =>
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

      deviceAssignments: getDefaultAssignments(),
      assignDevice: (deviceId, responderId) =>
        set((state) => {
          const next: DeviceAssignments = {};
          Object.entries(state.deviceAssignments).forEach(([dId, rId]) => {
            next[dId] = rId === responderId ? null : rId;
          });
          next[deviceId] = responderId;
          return { deviceAssignments: next };
        }),
      unassignDevice: (deviceId) =>
        set((state) => ({ deviceAssignments: { ...state.deviceAssignments, [deviceId]: null } })),

      criticalAlerts: [],
      addCriticalAlert: (a) =>
        set((state) => ({ criticalAlerts: [...state.criticalAlerts, a].slice(-50) })),
      clearCriticalAlerts: () => set({ criticalAlerts: [] }),
      alertSoundEnabled: true,
      setAlertSoundEnabled: (v) => set({ alertSoundEnabled: v }),
      browserNotifyEnabled: false,
      setBrowserNotifyEnabled: (v) => set({ browserNotifyEnabled: v }),

      voiceReplyEnabled: false,
      setVoiceReplyEnabled: (v) => set({ voiceReplyEnabled: v }),
    }),
    {
      name: 'nucleus-store',
      partialize: (state) => ({
        refreshInterval: state.refreshInterval,
        sessionsPerPage: state.sessionsPerPage,
        triageFilter: state.triageFilter,
        deviceAssignments: state.deviceAssignments,
        alertSoundEnabled: state.alertSoundEnabled,
        browserNotifyEnabled: state.browserNotifyEnabled,
        voiceReplyEnabled: state.voiceReplyEnabled,
      }),
    }
  )
);
