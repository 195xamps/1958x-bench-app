import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import path from 'path';
import { registerObjectStorageRoutes } from './replit_integrations/object_storage';
import { setupAuth, registerAuthRoutes, tokenAuth } from './replit_integrations/auth';

// ── Env var validation ──────────────────────────────────────────────────────
const REQUIRED_ENV = ['DATABASE_URL', 'OPENAI_API_KEY'] as const;
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

const app = express();
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : undefined;
app.use(cors({
  origin: ALLOWED_ORIGINS || true,
  credentials: true,
}));
app.use(compression());
app.use(express.json({ limit: '5mb' }));

async function initServer() {
  await setupAuth(app);
  registerAuthRoutes(app);
  app.use(tokenAuth); // JWT fallback for mobile when sessions aren't available
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
