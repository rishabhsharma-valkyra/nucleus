// Patient (Google-login) access to case data.
//
// Disabled: Nucleus patient accounts are Google emails, but wound records are
// keyed by the headset's face-login patient id, and nothing links the two
// yet. Until that link exists, a patient login must not see any case data —
// the routes below deny it server-side (and the Hospital API also answers
// patientEmail-scoped calls with nothing).
//
// Gated here: app/api/my-sessions, app/api/patients/[sessionId] (non-admin
// path) and lib/gcsAccess (non-admin path). Flip to true only once the
// email ↔ patient_id link is in place and the backend filters by it.
export const PATIENT_ACCESS_ENABLED = false;

export const PATIENT_ACCESS_DISABLED_MESSAGE =
  'Patient access is not available yet — ask your care team for your records.';
