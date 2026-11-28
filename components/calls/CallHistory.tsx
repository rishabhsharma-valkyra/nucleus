'use client';
// Calls with one patient, newest first (doctors and admins).
import { useQuery } from '@tanstack/react-query';
import { usePermission } from '@/hooks';
import { PERMISSIONS } from '@/lib/rbac';
import { fetchCallHistory, formatDuration, statusLabel } from '@/lib/calls';

export default function CallHistory({ patientId }: { patientId: string }) {
  const canSee = usePermission(PERMISSIONS.CALLS_ANSWER);
  const { data, isLoading, isError } = useQuery({
    queryKey: ['calls', 'history', patientId],
    queryFn: () => fetchCallHistory(patientId),
    enabled: canSee && !!patientId,
    refetchInterval: 15_000,
  });
  if (!canSee) return null;
  const calls = data?.calls ?? [];
  return (
    <section className="card" aria-label="Calls with this patient" style={{ marginBottom: 18 }}>
      <div className="card-header">
        <div className="card-title">Calls</div>
        <span className="section-title" style={{ letterSpacing: 2 }}>Video calls from the headset</span>
      </div>
      {isLoading ? (
        <p className="call-mono-dim" style={{ padding: 18 }}>Loading calls…</p>
      ) : isError ? (
        <p className="call-mono-dim" style={{ padding: 18 }}>Calls couldn&apos;t be loaded.</p>
      ) : calls.length === 0 ? (
        <p className="call-mono-dim" style={{ padding: 18 }}>No calls with this patient yet.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="call-table">
            <thead>
              <tr><th>Started</th><th>Duration</th><th>Answered by</th><th>Status</th></tr>
            </thead>
            <tbody>
              {calls.map((c) => (
                <tr key={c.call_id}>
                  <td>{c.created_at ? new Date(c.created_at).toLocaleString() : '—'}</td>
                  <td>{c.answered_at ? formatDuration(c.duration_s) : '—'}</td>
                  <td>{c.doctors.length ? c.doctors.map((d) => d.name || 'Doctor').join(', ') : '—'}</td>
                  <td className={`call-status call-status-${c.status}`}>{statusLabel(c)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
