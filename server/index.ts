import 'dotenv/config';
// Sentry MUST be the first import after dotenv so its auto-instrumentation
// can wrap http/express/pg before they're loaded by anything else.
import { Sentry } from './lib/sentry';
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import { registerObjectStorageRoutes } from './replit_integrations/object_storage';
import { setupAuth, registerAuthRoutes, tokenAuth } from './replit_integrations/auth';
import { globalLimiter, chatLimiter, authLimiter } from './middleware/rateLimit';
import { requireApproved } from './middleware/requireApproved';
import { noStoreDefault } from './middleware/cache';

// ── Env var validation ──────────────────────────────────────────────────────
const REQUIRED_ENV = ['DATABASE_URL', 'OPENAI_API_KEY', 'API_KEY_ENCRYPTION_SECRET'] as const;
const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`\n❌  Missing required environment variables: ${missing.join(', ')}`);
  console.error('    Server cannot start without these. Check your .env file.\n');
  process.exit(1);
}

// Route modules
import jobRoutes from './routes/jobs';
import troubleshootingRoutes from './routes/troubleshooting';
import measurementRoutes from './routes/measurements';
import schematicRoutes from './routes/schematics';
import chatRoutes from './routes/chats';
import referenceRoutes from './routes/reference';
import adminRoutes from './routes/admin';
import communityRoutes from './routes/community';
import repairActionRoutes from './routes/repairActions';
import profileRoutes from './routes/profile';

const app = express();
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : undefined;
// Trust the first proxy hop (Replit) so req.ip resolves correctly for rate limiting
app.set('trust proxy', 1);

// API-only server — Helmet's default CSP/COEP can be locked down further
// since we don't serve any HTML, but the defaults are already strict enough.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({
  origin: ALLOWED_ORIGINS || true,
  credentials: true,
}));
app.use(compression());
app.use(express.json({ limit: '5mb' }));

async function initServer() {
  await setupAuth(app);

  // JWT fallback for mobile MUST run before any route handler that reads
  // req.user (including /api/auth/user). Register it ahead of route mounts.
  app.use(tokenAuth);

  // Tighter rate limit on auth routes (brute-force protection)
  app.use('/api/auth', authLimiter);
  app.use('/api/login', authLimiter);
  registerAuthRoutes(app);

  // Global rate limit for all /api routes
  app.use('/api', globalLimiter);
  // Stricter limit on the AI chat message route
  app.use('/api/chats/:id/messages', chatLimiter);

  // Default no-store cache headers for all dynamic API GETs. The
  // cacheReference / cacheSchematicLibrary middlewares mounted later on
  // specific routers will override this for read-only catalog data.
  app.use('/api', noStoreDefault);

  // Allowlist gate — block unapproved users from non-auth API routes
  app.use(requireApproved);

  registerObjectStorageRoutes(app);

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: '195x Bench Assistant API running' });
  });

  // Mount route modules
  app.use(jobRoutes);
  app.use(troubleshootingRoutes);
  app.use(measurementRoutes);
  app.use(schematicRoutes);
  app.use(chatRoutes);
  app.use(referenceRoutes);
  app.use(adminRoutes);
  app.use(communityRoutes);
  app.use(repairActionRoutes);
  app.use(profileRoutes);

  // Root + 404 — this is an API server, not a web host. Anything that
  // isn't a known /api/* route gets a small JSON response.
  app.get('/', (_req, res) => {
    res.json({ name: '195x Bench Assistant API', status: 'ok' });
  });
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Sentry's Express error handler — must be registered AFTER all routes
  // and BEFORE any other error-handling middleware. Captures any error
  // thrown from a route handler.
  Sentry.setupExpressErrorHandler(app);

  // Final fallback error handler — must accept 4 args to be recognized
  // as an error handler. Sentry has already captured the error by now.
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[unhandled]', err);
    if (res.headersSent) return;
    res.status(500).json({ error: 'Internal server error' });
  });

  // Catch unhandled promise rejections + uncaught exceptions, report to
  // Sentry, then let the process die so Replit restarts it cleanly.
  process.on('unhandledRejection', (reason) => {
    console.error('[unhandledRejection]', reason);
    Sentry.captureException(reason);
  });
  process.on('uncaughtException', (err) => {
    console.error('[uncaughtException]', err);
    Sentry.captureException(err);
    // Give Sentry a moment to flush, then exit so the process supervisor restarts us.
    setTimeout(() => process.exit(1), 1000);
  });

  const PORT = parseInt(process.env.PORT || '5000', 10);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`195x Bench Assistant running on port ${PORT}`);
  });
}

initServer().catch(console.error);
