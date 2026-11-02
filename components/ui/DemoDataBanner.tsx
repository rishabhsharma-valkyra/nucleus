// Shown on every page whose figures are NOT real data (static or generated
// demo sets). In a clinical tool a plausible-looking invented number is
// dangerous, so these pages say so up front, and the sidebar tags them too
// (DEMO_PAGES). Remove a page from the list when it moves to live data.

export const DEMO_PAGES = new Set([
  '/analytics', '/responders', '/devices', '/training-intel', '/ai-performance', '/escalations',
]);

export default function DemoDataBanner({ what }: { what?: string }) {
  return (
    <div
      role="note"
      style={{
        display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 20, padding: '10px 14px', borderRadius: 10,
        background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.35)', color: 'var(--text2)', fontSize: 12, lineHeight: 1.5,
      }}
    >
      <span style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, letterSpacing: 1, color: '#fbbf24', padding: '2px 6px', border: '1px solid rgba(251,191,36,0.5)', borderRadius: 4, flexShrink: 0 }}>
        DEMO DATA
      </span>
      <span>
        {what ?? 'The figures on this page are demonstration data, not real patients, responders or devices.'} Do not use them for
        clinical or operational decisions.
      </span>
    </div>
  );
}
