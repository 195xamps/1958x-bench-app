import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import crypto from "crypto";
import { authStorage } from "./storage";

// Store mobile auth tokens temporarily (in production, use Redis or DB)
const mobileAuthTokens = new Map<string, { userId: string; expires: number }>();

// Clean up expired tokens periodically
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of mobileAuthTokens.entries()) {
    if (data.expires < now) {
      mobileAuthTokens.delete(token);
    }
  }
}, 60000); // Clean up every minute

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: sessionTtl,
    },
  });
}

export async function setupGoogleAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  
  if (!clientID || !clientSecret) {
    console.warn("Google OAuth credentials not configured. Authentication disabled.");
    return;
  }

  // Production URL takes priority, then dev domain, then localhost
  let callbackURL: string;
  if (process.env.PRODUCTION_URL) {
    callbackURL = `${process.env.PRODUCTION_URL}/api/auth/google/callback`;
  } else if (process.env.REPLIT_DEV_DOMAIN) {
    callbackURL = `https://${process.env.REPLIT_DEV_DOMAIN}/api/auth/google/callback`;
  } else {
    callbackURL = `http://localhost:5000/api/auth/google/callback`;
  }
  console.log("Google OAuth callback URL:", callbackURL);

  passport.use(
    new GoogleStrategy(
      {
        clientID,
        clientSecret,
        callbackURL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value || null;
          const user = await authStorage.upsertUser({
            id: profile.id,
            email,
            firstName: profile.name?.givenName || null,
            lastName: profile.name?.familyName || null,
            profileImageUrl: profile.photos?.[0]?.value || null,
          });
          done(null, user);
        } catch (error) {
          done(error as Error);
        }
      }
    )
  );

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await authStorage.getUser(id);
      done(null, user || null);
    } catch (error) {
      done(error);
    }
  });

  app.get("/api/login", (req, res, next) => {
    const isMobile = req.query.mobile === 'true';
    const state = JSON.stringify({ mobile: isMobile, nonce: Date.now().toString() });
    const encodedState = Buffer.from(state).toString('base64url');
    console.log("Login initiated, isMobile:", isMobile, "state:", encodedState);
    passport.authenticate("google", { 
      scope: ["profile", "email"],
      prompt: "select_account",
      state: encodedState
    })(req, res, next);
  });

  app.get(
    "/api/auth/google/callback",
    passport.authenticate("google", { 
      failureRedirect: "/login?error=auth_failed"
    }),
    (req, res) => {
      console.log("Google OAuth callback - user authenticated:", req.user);
      let isMobile = false;
      try {
        const stateParam = req.query.state as string;
        if (stateParam) {
          const decoded = Buffer.from(stateParam, 'base64url').toString('utf-8');
          const state = JSON.parse(decoded);
          isMobile = state.mobile === true;
          console.log("Decoded state:", state, "isMobile:", isMobile);
        }
      } catch (e) {
        console.error("Failed to decode state:", e);
      }
      
      if (isMobile) {
        // Generate a short-lived token for mobile auth
        const token = crypto.randomBytes(32).toString('hex');
        const userId = (req.user as any).id;
        mobileAuthTokens.set(token, {
          userId,
          expires: Date.now() + 5 * 60 * 1000 // 5 minutes
        });
        
        const mobileRedirectUrl = `benchapp195x://auth-complete?token=${token}`;
        console.log("Redirecting to mobile app with token");
        res.redirect(mobileRedirectUrl);
      } else {
        res.redirect("/");
      }
    }
  );

  // Exchange mobile auth token for session
  app.post("/api/auth/mobile-token", async (req, res) => {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: "Token required" });
    }
    
    const tokenData = mobileAuthTokens.get(token);
    if (!tokenData) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    
    if (tokenData.expires < Date.now()) {
      mobileAuthTokens.delete(token);
      return res.status(401).json({ error: "Token expired" });
    }
    
    // Delete token after use (one-time use)
    mobileAuthTokens.delete(token);
    
    // Get user and log them in
    const user = await authStorage.getUser(tokenData.userId);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }
    
    // Log the user in by setting up the session
    req.login(user, (err) => {
      if (err) {
        console.error("Mobile login error:", err);
        return res.status(500).json({ error: "Login failed" });
      }
      console.log("Mobile user logged in:", user.email);
      res.json({ success: true, user });
    });
  });

  app.get("/api/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        console.error("Logout error:", err);
      }
      res.redirect("/");
    });
  });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ message: "Unauthorized" });
};
