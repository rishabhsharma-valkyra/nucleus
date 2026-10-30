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

// Where the headset was when the wound was scanned (GPS). All null for
// sessions recorded before location capture, or with no GPS fix.
export interface WoundLocation {
  latitude: number | null;
  longitude: number | null;
  captured_at: string | null;
}

// A headset's latest GPS fix (overwritten every ~10s while it runs)
export interface LiveHeadset {
  device_id: string;
  session_id: string | null;
  patient_id: string | null;
  latitude: number;
  longitude: number;
  last_updated_unix: number | null;
}

export interface Session {
  session_id: string;
  source_image: string;
  pwat_score: number;
  triage_category: TriageCategory;
  gemini_analysis: string;
  created_at: string;
  wound_metrics: WoundMetrics;
  gcs_outputs: GcsOutputs;
  // Patient → wound. From the headset's face login; null for older
  // sessions or scans without a login.
  patient_id: string | null;
  patient_name: string | null;
  // Every body region in this scan, worst first, e.g. "Left Forearm, Face".
  // Per-wound regions are on the frames (one End Scan covers several wounds).
  body_region: string | null;
  location: WoundLocation;
  // One entry per wound detection during the scan
  frames?: WoundFrame[];
  // Frames whose AI read (body region + report) hasn't arrived yet. The scan
  // reaches the dashboard first; AI reads follow and are merged in.
  analysis_pending?: number;
  ingested_at?: string | null;
  // "end_scan", or "auto_recovered" when the headset server published a scan
  // that never received End Scan (crash / app closed)
  closed_by?: string | null;
  // Latest clinician review per injury (keyed by the injury's AI region)
  reviews?: ClinicianReview[];
}

export type Severity = 'Minor' | 'Moderate' | 'Severe' | 'Critical';

// A clinician's confirmation/correction of the AI read of one injury
export interface ClinicianReview {
  review_id: string;
  // AI region of the reviewed injury group (null for older scans)
  model_region: string | null;
  frame_keys: string[];
  verdict: 'confirmed' | 'corrected';
  body_region: string | null;
  wound_type: string | null;
  severity: Severity | null;
  triage: TriageCategory | null;
  notes: string | null;
  reviewer_email: string;
  reviewer_name: string | null;
  reviewer_role: string | null;
  reviewed_at: string | null;
}

// One auto-detection of a wound during a scan
export interface WoundFrame {
  frame_index?: number;
  frame_key?: string;
  pwat_score: number | null;
  triage: TriageCategory | null;
  depth_severity: string | null;
  depth_range?: number | null;
  depth_mean: number | null;
  area_pct: number | null;
  gemini_text: string | null;
  source_image?: string | null;
  gcs_outputs?: Partial<GcsOutputs>;
  captured_at?: string | null;
  // Fixed-list body region (patient's own left/right); absent on older scans
  body_region?: string | null;
  // "pending" until the frame's AI read arrives
  analysis_status?: 'pending' | 'done';
  analysis_model?: string | null;
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
  // Server time to pass as `since` on the next poll (only scans delivered or
  // AI-updated after it come back). Absent on older API versions.
  as_of?: string;
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
