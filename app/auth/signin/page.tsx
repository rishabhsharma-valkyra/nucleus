'use client';
import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { Role } from '@/config/roles';
import { ROLE_LABELS } from '@/lib/rbac';
import { DEV_ROLE_SWITCH_ENABLED, setDevRoleCookie, clearDevRoleCookie } from '@/lib/devRole';

export default function SignInPage() {
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    setLoading(true);
    clearDevRoleCookie(); // normal sign-in uses the real role, not a test override
    await signIn('google', { callbackUrl: '/overview' });
  };

  const handleTestSignIn = async (role: Role) => {
    setLoading(true);
    setDevRoleCookie(role);
    await signIn('google', { callbackUrl: '/overview' });
  };

  return (
    <>
      <div className="bg-canvas" />
      <div className="bg-grid" />
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="signin-page" style={{ position: 'relative', zIndex: 1 }}>
        <div className="signin-card">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
            <div className="logo-mark" style={{ width: 56, height: 56, borderRadius: 14 }}>
              <svg width="28" height="28" viewBox="0 0 16 16" fill="none">
                <path d="M8 2L13 5.5V10.5L8 14L3 10.5V5.5L8 2Z" fill="rgba(255,255,255,0.35)" />
                <path d="M8 5L11 7V9L8 11L5 9V7L8 5Z" fill="#fff" />
              </svg>
            </div>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 4, textTransform: 'uppercase', fontFamily: 'var(--mono)', marginBottom: 8 }}>
            Valkyra · Nucleus
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5, marginBottom: 8 }}>
            Command Center
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 36, lineHeight: 1.6 }}>
            Valkyra Nucleus Command Dashboard · Authorized Personnel Only
          </p>
          <button
            className="btn btn-accent"
            onClick={handleSignIn}
            disabled={loading}
            style={{ width: '100%', padding: '12px 24px', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M17.64 9.2a9.85 9.85 0 00-.16-1.7H9v3.2h4.84a4.14 4.14 0 01-1.8 2.72v2.26h2.9a8.78 8.78 0 002.7-6.48z" />
              <path fill="#34A853" d="M9 18a8.6 8.6 0 005.96-2.18l-2.9-2.26a5.43 5.43 0 01-8.08-2.85H.98v2.34A9 9 0 009 18z" />
              <path fill="#FBBC05" d="M3.98 10.71a5.35 5.35 0 010-3.42V4.95H.98a9 9 0 000 8.1l3-2.34z" />
              <path fill="#EA4335" d="M9 3.58a4.87 4.87 0 013.44 1.35l2.58-2.58A8.65 8.65 0 009 0 9 9 0 00.98 4.95l3 2.34A5.36 5.36 0 019 3.58z" />
            </svg>
            {loading ? 'Connecting...' : 'Continue with Google'}
          </button>
          <p style={{ fontSize: 10, color: 'var(--text3)', marginTop: 24, fontFamily: 'var(--mono)' }}>
            Access restricted to authorized personnel
          </p>

          {DEV_ROLE_SWITCH_ENABLED && (
            <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px dashed rgba(255,255,255,0.15)' }}>
              <div style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--mono)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>
                Testing only — pick a role
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['admin', 'doctor', 'patient'] as Role[]).map((role) => (
                  <button
                    key={role}
                    className="btn"
                    disabled={loading}
                    onClick={() => handleTestSignIn(role)}
                    style={{ flex: 1, fontSize: 11, padding: '8px 0' }}
                  >
                    {ROLE_LABELS[role]}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 9, color: 'var(--text3)', marginTop: 10, fontFamily: 'var(--mono)', lineHeight: 1.5 }}>
                Bypasses the real role lookup for this browser only. Remove before real launch.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
