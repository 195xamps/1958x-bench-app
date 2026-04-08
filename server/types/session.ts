// Shape of the JSON blob stored in the `sessions.sess` column by
// connect-pg-simple. Passport stores the serialized user under
// `passport.user` — we serialize only the id (see auth/googleAuth.ts).
//
// Use this type whenever you read from `schema.sessions.sess` so we don't
// need ad-hoc `as any` casts.
export interface SessionPayload {
  cookie?: {
    originalMaxAge?: number;
    expires?: string;
    secure?: boolean;
    httpOnly?: boolean;
    path?: string;
    sameSite?: string;
  };
  passport?: {
    user?: { id: string };
  };
}

/** Safely extract the user id from a session payload. */
export function getSessionUserId(sess: unknown): string | null {
  const payload = sess as SessionPayload | null | undefined;
  return payload?.passport?.user?.id || null;
}
