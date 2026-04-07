import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import path from 'path';
import { registerObjectStorageRoutes } from './replit_integrations/object_storage';
import { setupAuth, registerAuthRoutes, tokenAuth } from './replit_integrations/auth';
import { globalLimiter, chatLimiter, authLimiter } from './middleware/rateLimit';
import { requireApproved } from './middleware/requireApproved';

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

app.use(helmet({
  contentSecurityPolicy: false, // SPA + inline styles need a custom CSP later
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

  // Allowlist gate — block unapproved users from non-auth API routes
  app.use(requireApproved);

  registerObjectStorageRoutes(app);

  app.use(express.static(path.join(__dirname, '..', 'dist', 'client')));
  app.use(express.static(path.join(__dirname, '..', 'dist', 'server')));

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: '195x Bench App API running' });
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

  // SPA fallback
  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'dist', 'server', '(tabs)', 'index.html'));
  });

  const PORT = parseInt(process.env.PORT || '5000', 10);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`195x Bench App running on port ${PORT}`);
  });
}

initServer().catch(console.error);
