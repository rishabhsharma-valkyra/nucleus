// ── TEMPORARY testing helper — remove before real launch ──────
// Lets whoever's signing in pick which role to test as (admin/doctor/
// patient), instead of relying on the real config/roles.ts allowlist.
// Fully gated behind NEXT_PUBLIC_ENABLE_DEV_ROLE_SWITCH so it does
// nothing unless explicitly turned on. To remove this feature later:
// delete this file, lib/serverRole.ts, and the "Testing" block in
// app/auth/signin/page.tsx, then revert the call sites that swapped
// session.user.role for getEffectiveRole()/useRole().
import { Role } from '@/config/roles';

export const DEV_ROLE_COOKIE = 'nucleus_dev_role';

export const DEV_ROLE_SWITCH_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_DEV_ROLE_SWITCH === 'true';

const VALID_ROLES: readonly string[] = ['admin', 'doctor', 'patient'];

export function isValidRole(value: string | undefined | null): value is Role {
  return !!value && VALID_ROLES.includes(value);
}

// Client-side only — reads the plain (non-httpOnly) override cookie.
export function readDevRoleCookie(): Role | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(/(?:^|; )nucleus_dev_role=([^;]*)/);
  const value = match ? decodeURIComponent(match[1]) : undefined;
  return isValidRole(value) ? value : undefined;
}

export function setDevRoleCookie(role: Role) {
  document.cookie = `${DEV_ROLE_COOKIE}=${role}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`;
}

export function clearDevRoleCookie() {
  document.cookie = `${DEV_ROLE_COOKIE}=; path=/; max-age=0`;
}

// The role to act as: the dev override only when it is the same as or LOWER
// than the real sign-in role. The switch exists to preview what a lower role
// sees; it must never let a patient account act as a doctor or admin.
const ROLE_RANK: Record<Role, number> = { patient: 0, doctor: 1, admin: 2 };

export function applyDevOverride(realRole: Role | undefined, override: string | undefined | null): Role | undefined {
  if (!DEV_ROLE_SWITCH_ENABLED || !isValidRole(override) || !realRole) return realRole;
  return ROLE_RANK[override] <= (ROLE_RANK[realRole] ?? -1) ? override : realRole;
}
