import type { Request, Response, NextFunction } from 'express';

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

export function requireApproved(req: any, res: Response, next: NextFunction) {
  // Unauthenticated requests pass through — individual routes will return 401
  if (!req.user) return next();

  // Admins always pass
  if (req.user.isAdmin) return next();

  // Approved users always pass
  if (req.user.isApproved) return next();

  // Non-API paths (web SPA) pass through
  if (!req.path.startsWith('/api')) return next();

  // Auth + own-profile paths pass through
  if (isAllowed(req.path)) return next();

  console.warn(`[requireApproved] BLOCKED ${req.method} ${req.path} for user=${req.user.id} email=${req.user.email} isApproved=${req.user.isApproved} isAdmin=${req.user.isAdmin}`);
  return res.status(403).json({
    error: 'Account pending approval',
    pendingApproval: true,
  });
}
