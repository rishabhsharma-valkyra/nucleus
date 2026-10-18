export const queryKeys = {
  summary:     ['summary'] as const,
  sessions:    (limit: number, offset: number) => ['sessions', limit, offset] as const,
  allSessions: ['sessions', 'all'] as const,
  mySessions:  (limit: number, offset: number) => ['mySessions', limit, offset] as const,
  patient:     (id: string) => ['patient', id] as const,
  patientWounds: (patientId: string) => ['patientWounds', patientId] as const,
  patientPhoto:  (patientId: string) => ['patientPhoto', patientId] as const,
  liveLocations: ['liveLocations'] as const,
  incidents:   ['incidents'] as const,
  health:      ['health'] as const,
};
