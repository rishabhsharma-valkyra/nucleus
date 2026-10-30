'use client';

import { usePatientPhoto } from '@/hooks';
import { gcsImageUrl } from '@/lib/api';

// Registered face photo (gs://facial-info) with an initial-letter fallback
// when none was registered or it fails to load.
export default function PatientPhoto({ patientId, name, size = 48 }: { patientId: string | null; name: string; size?: number }) {
  const { data, isLoading } = usePatientPhoto(patientId);
  const box: React.CSSProperties = {
    width: size, height: size, flexShrink: 0, borderRadius: size >= 120 ? 12 : 8, overflow: 'hidden',
    background: 'black', border: '1px solid rgba(255,255,255,0.1)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };

  if (patientId && isLoading) return <div className="skeleton" style={box} />;

  return (
    <div style={box}>
      {data?.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={gcsImageUrl(data.photo)}
          alt={`${name} — registered face`}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      ) : (
        <span style={{ fontSize: Math.round(size * 0.4), fontWeight: 700, color: 'var(--text3)' }}>
          {(name || '?').charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  );
}
