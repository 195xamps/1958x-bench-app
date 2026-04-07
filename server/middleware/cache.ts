import type { Request, Response, NextFunction } from 'express';

// HTTP cache control helpers for GET endpoints. Express's default behavior
// already adds weak ETags to JSON responses, so a properly cached client
// gets a free 304 Not Modified — we just need to set Cache-Control headers
// so the client knows it can revalidate / reuse the response at all.

interface CacheOptions {
  maxAge: number;             // seconds the response is "fresh"
  staleWhileRevalidate?: number; // seconds the client may keep serving stale while it refetches in background
  scope?: 'private' | 'public';  // private = per-user (default), public = shared (CDN-safe)
}

/** Build a single Cache-Control header value from options. */
function buildCacheControl(opts: CacheOptions): string {
  const parts: string[] = [opts.scope || 'private'];
  parts.push(`max-age=${opts.maxAge}`);
  if (opts.staleWhileRevalidate) {
    parts.push(`stale-while-revalidate=${opts.staleWhileRevalidate}`);
  }
  return parts.join(', ');
}

/**
 * Express middleware factory: sets Cache-Control on successful GET responses.
 * Skips non-GET requests and any 4xx/5xx so errors are never cached.
 */
export function cacheControl(opts: CacheOptions) {
  const headerValue = buildCacheControl(opts);
  return function (req: Request, res: Response, next: NextFunction) {
    if (req.method !== 'GET') return next();
    // Patch res to set the header just before sending — that way handlers
    // that explicitly set their own Cache-Control still win.
    const origJson = res.json.bind(res);
    res.json = function (body: any) {
      if (res.statusCode < 400 && !res.getHeader('Cache-Control')) {
        res.setHeader('Cache-Control', headerValue);
      }
      return origJson(body);
    };
    next();
  };
}

// Pre-built profiles for common cases.
export const cacheReference = cacheControl({
  maxAge: 300,                 // 5 min
  staleWhileRevalidate: 900,   // 15 min
  scope: 'private',
});

export const cacheSchematicLibrary = cacheControl({
  maxAge: 300,
  staleWhileRevalidate: 900,
  scope: 'private',
});
