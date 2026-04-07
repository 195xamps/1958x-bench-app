import type { Response, NextFunction } from 'express';
import { authStorage } from '../replit_integrations/auth/storage';

// Routes that an authenticated-but-not-approved user is still allowed to hit
// (so they can see their pending state, edit profile, sign out, etc.)
const ALLOWED_PATH_PREFIXES = [
  '/api/auth',          // login/logout/user
  '/api/login',
  '/api/logout',
  '/api/health',
  '/api/profile/me',    // view + delete own account, edit name
];

function isAllowed(path: string): boolean {
  return ALLOWED_PATH_PREFIXES.some((p) => path === p || path.startsWith(p));
}

export async function requireApproved(req: any, res: Response, next: NextFunction) {
  // Unauthenticated requests pass through — individual routes will return 401
  if (!req.user) return next();

  // Non-API paths (web SPA) pass through
  if (!req.path.startsWith('/api')) return next();

  // Auth + own-profile paths pass through
  if (isAllowed(req.path)) return next();

  // ALWAYS read fresh from the DB. Session/JWT data can be stale if a user
  // was promoted/approved after their token was issued, and we want those
  // changes to take effect immediately.
  console.log(`[requireApproved v2] About to fetch fresh user ${req.user.id}`);
  const fresh = await authStorage.getUser(req.user.id);
  console.log(`[requireApproved v2] Fresh fetch result:`, fresh ? { id: fresh.id, email: fresh.email, isAdmin: fresh.isAdmin, isApproved: fresh.isApproved } : 'NOT FOUND');
  if (!fresh) {
    return res.status(401).json({ error: 'User not found' });
  }
  // Replace req.user with the canonical fresh row so downstream handlers
  // also see the correct values.
  req.user = fresh;

  if (fresh.isAdmin || fresh.isApproved) return next();

  console.warn(`[requireApproved v2] BLOCKED ${req.method} ${req.path} for user=${fresh.id} email=${fresh.email} isApproved=${fresh.isApproved} isAdmin=${fresh.isAdmin}`);
  return res.status(403).json({
    error: 'Account pending approval',
    pendingApproval: true,
  });
}
