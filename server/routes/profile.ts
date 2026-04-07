import { Router } from 'express';
import { db, schema } from '../db';
import { eq, sql } from 'drizzle-orm';
import OpenAI from 'openai';
import { encryptSecret } from '../lib/crypto';

const router = Router();

// ── GET /api/profile/me ──────────────────────────────────────────────────────

router.get('/api/profile/me', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const [user] = await db.select({
      id: schema.users.id,
      email: schema.users.email,
      firstName: schema.users.firstName,
      lastName: schema.users.lastName,
      profileImageUrl: schema.users.profileImageUrl,
      isAdmin: schema.users.isAdmin,
      totalTokensUsed: schema.users.totalTokensUsed,
    }).from(schema.users).where(eq(schema.users.id, userId));
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Count chats and jobs with separate safe queries
    let chatCount = 0;
    let jobCount = 0;
    try {
      const chatResult = await db.execute(sql`SELECT COUNT(*)::int as count FROM chats WHERE user_id = ${userId}`);
      chatCount = (chatResult.rows[0] as any)?.count ?? 0;
    } catch { /* non-fatal */ }
    try {
      const jobResult = await db.execute(sql`SELECT COUNT(*)::int as count FROM bench_jobs WHERE user_id = ${userId}`);
      jobCount = (jobResult.rows[0] as any)?.count ?? 0;
    } catch { /* non-fatal */ }

    const COST_PER_TOKEN = 5 / 1_000_000;
    const tokens = user.totalTokensUsed || 0;

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
      isAdmin: user.isAdmin,
      totalTokensUsed: tokens,
      estimatedCostUsd: tokens * COST_PER_TOKEN,
      hasCustomApiKey: false,
      chatCount,
      jobCount,
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// ── PATCH /api/profile/me ────────────────────────────────────────────────────

router.patch('/api/profile/me', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { firstName, lastName } = req.body;
    await db.update(schema.users)
      .set({ firstName, lastName, updatedAt: new Date() })
      .where(eq(schema.users.id, userId));

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ── DELETE /api/profile/me ───────────────────────────────────────────────────

router.delete('/api/profile/me', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // Cascade: delete all user data
    await db.execute(sql`
      DELETE FROM chat_messages
      WHERE chat_id IN (SELECT id FROM chats WHERE user_id = ${userId});
    `);
    await db.execute(sql`DELETE FROM chats WHERE user_id = ${userId}`);
    await db.execute(sql`
      DELETE FROM measurements
      WHERE bench_job_id IN (SELECT id FROM bench_jobs WHERE user_id = ${userId});
    `);
    await db.execute(sql`
      DELETE FROM repair_actions
      WHERE bench_job_id IN (SELECT id FROM bench_jobs WHERE user_id = ${userId});
    `);
    await db.execute(sql`
      DELETE FROM symptoms
      WHERE bench_job_id IN (SELECT id FROM bench_jobs WHERE user_id = ${userId});
    `);
    await db.execute(sql`DELETE FROM bench_jobs WHERE user_id = ${userId}`);
    await db.execute(sql`DELETE FROM sessions WHERE sess->>'userId' = ${userId}`);
    await db.delete(schema.users).where(eq(schema.users.id, userId));

    // Destroy the session
    req.session?.destroy?.(() => {});

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// ── PATCH /api/profile/api-key ───────────────────────────────────────────────

router.patch('/api/profile/api-key', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { apiKey } = req.body;

    // Validate the key works before saving (quick models/list call)
    if (apiKey) {
      try {
        const testClient = new OpenAI({ apiKey });
        await testClient.models.list();
      } catch {
        return res.status(400).json({ error: 'Invalid API key — could not authenticate with OpenAI' });
      }
    }

    const encrypted = apiKey ? encryptSecret(apiKey) : null;
    await db.update(schema.users)
      .set({ customApiKey: encrypted })
      .where(eq(schema.users.id, userId));

    res.json({ success: true, hasCustomApiKey: !!apiKey });
  } catch (error) {
    console.error('Error updating API key:', error);
    res.status(500).json({ error: 'Failed to update API key' });
  }
});

export default router;
