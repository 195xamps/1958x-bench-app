import rateLimit from 'express-rate-limit';

// Key by authenticated user id when present, otherwise IP. This protects
// behind-proxy deployments where many users share an egress IP.
function keyByUserOrIp(req: any): string {
  return req.user?.id || req.ip || 'unknown';
}

// Global limiter — broad protection against abuse on any route.
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 600,                 // 600 requests / 15 min / user
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
  message: { error: 'Too many requests. Please slow down.' },
});

// Stricter limiter for AI chat — these are the expensive routes.
export const chatLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hr
  max: 100,                 // 100 chat msgs / hr / user
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
  message: { error: 'Chat rate limit exceeded. Try again in an hour.' },
});

// Auth limiter — prevent brute force on the login/token exchange routes.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => req.ip || 'unknown',
  message: { error: 'Too many auth attempts. Please wait.' },
});
