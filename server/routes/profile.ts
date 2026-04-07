import { Router } from 'express';
import { db, schema } from '../db';
import { eq, desc, sql } from 'drizzle-orm';
import OpenAI from 'openai';

const router = Router();

// ── GET /api/profile/me ──────────────────────────────────────────────────────

router.get('/api/profile/me', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
    if (!user) return res.status(404).json({ error: 'User not found' });

    const chatCountResult = await db.execute(
      sql`SELECT COUNT(*) as count FROM chats WHERE user_id = ${userId}`
    );
    const jobCountResult = await db.execute(
      sql`SELECT COUNT(*) as count FROM bench_jobs WHERE user_id = ${userId}`
    );

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
      hasCustomApiKey: !!user.customApiKey,
      chatCount: parseInt((chatCountResult.rows[0] as any)?.count || '0'),
      jobCount: parseInt((jobCountResult.rows[0] as any)?.count || '0'),
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
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

    await db.update(schema.users)
      .set({ customApiKey: apiKey || null })
      .where(eq(schema.users.id, userId));

    res.json({ success: true, hasCustomApiKey: !!apiKey });
  } catch (error) {
    console.error('Error updating API key:', error);
    res.status(500).json({ error: 'Failed to update API key' });
  }
});

export default router;
