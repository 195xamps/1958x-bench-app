import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

// Key by authenticated user id when present, otherwise IP. The ipKeyGenerator
// helper handles IPv6 normalization correctly (required by v7+).
function keyByUserOrIp(req: any): string {
  if (req.user?.id) return `u:${req.user.id}`;
  return `ip:${ipKeyGenerator(req.ip || '')}`;
}

// v8 of express-rate-limit runs strict validation that throws errors on
// some hosted proxies (Replit's X-Forwarded-For chain trips it). Disable
// validation explicitly — we provide our own keyGenerator that handles it.
const sharedOpts = {
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
};

// Global limiter — broad protection against abuse on any route.
export const globalLimiter = rateLimit({
  ...sharedOpts,
  windowMs: 15 * 60 * 1000, // 15 min
  max: 600,                 // 600 requests / 15 min / user
  keyGenerator: keyByUserOrIp,
  message: { error: 'Too many requests. Please slow down.' },
});

// Stricter limiter for AI chat — these are the expensive routes.
export const chatLimiter = rateLimit({
  ...sharedOpts,
  windowMs: 60 * 60 * 1000, // 1 hr
  max: 100,                 // 100 chat msgs / hr / user
  keyGenerator: keyByUserOrIp,
  message: { error: 'Chat rate limit exceeded. Try again in an hour.' },
});

// Auth limiter — prevent brute force on the login/token exchange routes.
export const authLimiter = rateLimit({
  ...sharedOpts,
  windowMs: 15 * 60 * 1000,
  max: 30,
  keyGenerator: (req: any) => `ip:${ipKeyGenerator(req.ip || '')}`,
  message: { error: 'Too many auth attempts. Please wait.' },
});
