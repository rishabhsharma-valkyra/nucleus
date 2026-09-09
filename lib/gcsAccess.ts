// Server-only. Authorization for the GCS proxy routes.
//
// /api/proxy/image and /api/proxy/text take a caller-supplied gs:// path and
// fetch it with the shared internal key attached. Authentication alone is not
// enough there: a signed-in patient could hand the proxy any other patient's
// object path and read their wound imagery and Gemini report, which is
// exactly the boundary app/api/patients/[sessionId]/route.ts enforces for the
// structured record. This module applies the same rule to the bytes.
import { Session } from 'next-auth';
import { hasPermission, PERMISSIONS } from '@/lib/rbac';
import { getEffectiveRole } from '@/lib/serverRole';
import { forwardToBackend } from '@/lib/backend';

const UUID_RE = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i;

// Object layout is gs://<bucket>/processed/<session_id>/frame_NNNN/...
export function sessionIdFromGcsPath(path: string): string | null {
  const m = path.match(UUID_RE);
  return m ? m[0] : null;
}

// A patient opening one session pulls ~8 objects (crop, masks, overlays,
// figures, report), and each would otherwise re-ask the backend the same
// ownership question. Cache the answer briefly, keyed by both the caller and
// the session so one user's grant can never satisfy another's request.
const OWNERSHIP_TTL_MS = 60_000;
const ownershipCache = new Map<string, { allowed: boolean; at: number }>();

// ⚠️ THIS CHECK IS ONLY AS STRONG AS THE BACKEND'S patientEmail FILTER.
//
// As of this writing the deployed Hospital API (v3.0.0) IGNORES the
// patientEmail query parameter: /patients, /patients/summary and
// /patient/:id all return the full dataset for any email, including one
// that matches no user at all. Sessions don't even carry a patient identity
// field in the response. While that is true, every ownership probe below
// succeeds and this gate cannot actually keep one patient out of another
// patient's imagery — the same is true of /api/my-sessions and
// /api/patients/[sessionId], which rely on the same filter.
//
// The code here is written against the intended contract so it starts
// enforcing the moment the backend honours the filter. Until then the probe
// below detects the no-op and warns, rather than leaving the gap silent.
let filterProbeState: 'unchecked' | 'checking' | 'done' = 'unchecked';

async function warnIfOwnershipFilterIsNoOp(sessionId: string) {
  if (filterProbeState !== 'unchecked') return;
  filterProbeState = 'checking';
  try {
    // An address no account can hold. If the backend still returns the row,
    // it is not filtering by patient at all.
    const { status, data } = await forwardToBackend(
      `/patient/${encodeURIComponent(sessionId)}?patientEmail=${encodeURIComponent('__no_such_patient__@invalid.invalid')}`
    );
    if (status === 200 && (data as any)?.session_id) {
      console.error(
        '[SECURITY] Backend ignores the patientEmail filter — per-patient data isolation is NOT being enforced ' +
        'for /api/proxy/*, /api/my-sessions or /api/patients/[sessionId]. Fix the Hospital API before treating ' +
        'any patient-scoped route as a real boundary.'
      );
    }
  } catch {
    // Probe is diagnostics only — never let it affect the access decision.
  } finally {
    filterProbeState = 'done';
  }
}

async function ownsSession(email: string, sessionId: string): Promise<boolean> {
  const key = `${email}::${sessionId}`;
  const hit = ownershipCache.get(key);
  if (hit && Date.now() - hit.at < OWNERSHIP_TTL_MS) return hit.allowed;

  // The backend is supposed to apply the patient_email filter itself, so a
  // session the caller doesn't own comes back empty rather than as someone
  // else's row. See the warning above about the deployed backend.
  const { status, data } = await forwardToBackend(
    `/patient/${encodeURIComponent(sessionId)}?patientEmail=${encodeURIComponent(email)}`
  );
  const allowed = status === 200 && !!data && !!(data as any).session_id;

  if (allowed) void warnIfOwnershipFilterIsNoOp(sessionId);

  ownershipCache.set(key, { allowed, at: Date.now() });
  return allowed;
}

export type GcsAccessResult = { ok: true } | { ok: false; status: number; message: string };

export async function authorizeGcsPath(
  session: Session,
  path: string
): Promise<GcsAccessResult> {
  // The backend only serves gs:// objects; reject anything else up front so a
  // malformed path never reaches it with our internal key attached.
  if (!path.startsWith('gs://')) {
    return { ok: false, status: 400, message: 'Invalid path' };
  }

  if (hasPermission(getEffectiveRole(session), PERMISSIONS.OPERATIONS_VIEW)) {
    return { ok: true };
  }

  const email = session.user?.email;
  if (!email) return { ok: false, status: 403, message: 'Forbidden' };

  const sessionId = sessionIdFromGcsPath(path);
  // No session id in the path means we cannot prove ownership — deny rather
  // than fall open.
  if (!sessionId) return { ok: false, status: 403, message: 'Forbidden' };

  return (await ownsSession(email, sessionId))
    ? { ok: true }
    : { ok: false, status: 403, message: 'Forbidden — not your session' };
}
