export interface WoundMetrics {
  depth_severity: string | null;
  depth_range: number | null;
  depth_mean: number | null;
  area_pct: number | null;
}

export interface GcsOutputs {
  cropped_image: string;
  segmentation_mask: string;
  wound_mask_overlay: string;
  peri_mask_overlay: string;
  segmentation_figure: string;
  depth_figure: string;
  depth_map: string;
  gemini_report: string;
}

export type TriageCategory = 'Red' | 'Orange' | 'Yellow' | 'Green' | 'Unclassified';

export interface Session {
  session_id: string;
  source_image: string;
  pwat_score: number;
  triage_category: TriageCategory;
  gemini_analysis: string;
  created_at: string;
  wound_metrics: WoundMetrics;
  gcs_outputs: GcsOutputs;
}

export interface TriageCount {
  count: number;
  pct: number;
}

export interface Summary {
  total_cases: number;
  avg_pwat: number;
  pwat_stats: { average: number; minimum: number; maximum: number };
  triage_distribution: {
    Red: TriageCount;
    Orange: TriageCount;
    Yellow: TriageCount;
    Green: TriageCount;
  };
}

export interface PatientsResponse {
  total_returned: number;
  sessions: Session[];
}

export type IncidentType = 'GSW' | 'STAB' | 'BLUNT' | 'BURN' | 'FRACTURE' | 'CRUSH';
export type IncidentStatus = 'Active' | 'Resolved';

export interface Incident {
  id: string;
  type: IncidentType;
  responder: string;
  device: string;
  location: string;
  notes: string;
  created_at: string;
  status: IncidentStatus;
  created_by: string;
}

export interface IncidentsResponse {
  incidents: Incident[];
}

export interface Responder {
  id: string;
  name: string;
  rank: string;
  unit: string;
  device_id: string;
  status: 'LIVE' | 'ONLINE' | 'IDLE' | 'OFFLINE';
  initials: string;
  valkyra_usage_pct: number;
  avg_response_min: number;
  resolution_rate_pct: number;
  incidents_handled: number;
}

export interface Device {
  id: string;
  model: string;
  serial: string;
  unit: string;
  status: 'LIVE' | 'ONLINE' | 'IDLE' | 'OFFLINE';
  firmware: string;
  last_sync: string;
  battery_pct: number;
  sync_failed: boolean;
}

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'alert';
  message: string;
}

// A client-detected critical case notification (new active Red-triage
// session) — kept in a short-lived list so the alert bell has something to
// show beyond the auto-dismissing toast.
export interface CriticalAlert {
  id: string;
  sessionId: string;
  message: string;
  time: string;
}
