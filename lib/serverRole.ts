// ── TEMPORARY testing helper — see lib/devRole.ts ──────────────
import { cookies } from 'next/headers';
import { Session } from 'next-auth';
import { Role } from '@/config/roles';
import { DEV_ROLE_COOKIE, DEV_ROLE_SWITCH_ENABLED, applyDevOverride } from '@/lib/devRole';

// Server-side equivalent of the client's useRole(): returns the dev
// override (if the switch is enabled and the override is not higher than
// the real role), else the real role from the session.
export async function getEffectiveRole(session: Session): Promise<Role> {
  if (!DEV_ROLE_SWITCH_ENABLED) return session.user.role;
  const override = (await cookies()).get(DEV_ROLE_COOKIE)?.value;
  return applyDevOverride(session.user.role, override) ?? session.user.role;
}
