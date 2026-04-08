import { Router } from 'express';
import { db, schema } from '../db';
import { eq, desc, sql } from 'drizzle-orm';

const router = Router();

// Explicit projection for any user data we send to clients. NEVER includes
// customApiKey (encrypted but still secret material), and only the columns
// the UI actually renders. Used everywhere we expose user records.
const userPublicCols = {
  id: schema.users.id,
  email: schema.users.email,
  firstName: schema.users.firstName,
  lastName: schema.users.lastName,
  profileImageUrl: schema.users.profileImageUrl,
  isAdmin: schema.users.isAdmin,
  isApproved: schema.users.isApproved,
  totalTokensUsed: schema.users.totalTokensUsed,
  tokenQuota: schema.users.tokenQuota,
  createdAt: schema.users.createdAt,
};

// Pagination defaults — capped server-side so a client can't request a
// 10,000-row dump.
function parsePagination(req: any, defaultLimit = 50, maxLimit = 200) {
  const limit = Math.min(parseInt(req.query.limit as string) || defaultLimit, maxLimit);
  const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
  return { limit, offset };
}

router.get('/api/admin/users', async (req: any, res) => {
  try {
    const currentUser = req.user;
    if (!currentUser?.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { limit, offset } = parsePagination(req);

    // Run total + page query + side data in parallel — these are all
    // independent reads.
    const [totalResult, pageUsers, activeSessions, chatCounts, jobCounts] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(schema.users),
      db.select(userPublicCols).from(schema.users)
        .orderBy(desc(schema.users.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ sess: schema.sessions.sess }).from(schema.sessions)
        .where(sql`expire > NOW()`),
      db.execute(sql`SELECT user_id, COUNT(*)::int AS count FROM chats WHERE user_id IS NOT NULL GROUP BY user_id`),
      db.execute(sql`SELECT user_id, COUNT(*)::int AS count FROM bench_jobs WHERE user_id IS NOT NULL GROUP BY user_id`),
    ]);

    const total = totalResult[0]?.count ?? 0;
    const activeUserIds = new Set(
      activeSessions
        .map(s => (s.sess as any)?.passport?.user?.id || (s.sess as any)?.passport?.user)
        .filter(Boolean)
    );
    const chatCountMap = new Map((chatCounts.rows as any[]).map(r => [r.user_id, r.count]));
    const jobCountMap = new Map((jobCounts.rows as any[]).map(r => [r.user_id, r.count]));

    const data = pageUsers.map(user => ({
      ...user,
      chatCount: chatCountMap.get(user.id) || 0,
      jobCount: jobCountMap.get(user.id) || 0,
      isActive: activeUserIds.has(user.id),
    }));

    res.json({ data, total, hasMore: offset + data.length < total });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.get('/api/admin/users/:userId/chats', async (req: any, res) => {
  try {
    const currentUser = req.user;
    if (!currentUser?.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { userId } = req.params;
    const { limit, offset } = parsePagination(req, 100);
    const userChats = await db.select().from(schema.chats)
      .where(eq(schema.chats.userId, userId))
      .orderBy(desc(schema.chats.updatedAt))
      .limit(limit)
      .offset(offset);
    res.json(userChats);
  } catch (error) {
    console.error('Error fetching user chats:', error);
    res.status(500).json({ error: 'Failed to fetch user chats' });
  }
});

router.get('/api/admin/users/:userId/jobs', async (req: any, res) => {
  try {
    const currentUser = req.user;
    if (!currentUser?.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { userId } = req.params;
    const { limit, offset } = parsePagination(req, 100);
    const userJobs = await db.select({
      job: schema.benchJobs,
      ampProfile: schema.ampProfiles,
    }).from(schema.benchJobs)
      .leftJoin(schema.ampProfiles, eq(schema.benchJobs.ampProfileId, schema.ampProfiles.id))
      .where(eq(schema.benchJobs.userId, userId))
      .orderBy(desc(schema.benchJobs.createdAt))
      .limit(limit)
      .offset(offset);
    res.json(userJobs);
  } catch (error) {
    console.error('Error fetching user jobs:', error);
    res.status(500).json({ error: 'Failed to fetch user jobs' });
  }
});

router.get('/api/admin/all-chats', async (req: any, res) => {
  try {
    const currentUser = req.user;
    if (!currentUser?.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { limit, offset } = parsePagination(req);

    const [totalResult, page] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(schema.chats),
      db.select({
        chat: schema.chats,
        user: userPublicCols,
      }).from(schema.chats)
        .leftJoin(schema.users, eq(schema.chats.userId, schema.users.id))
        .orderBy(desc(schema.chats.updatedAt))
        .limit(limit)
        .offset(offset),
    ]);

    const total = totalResult[0]?.count ?? 0;
    res.json({ data: page, total, hasMore: offset + page.length < total });
  } catch (error) {
    console.error('Error fetching all chats:', error);
    res.status(500).json({ error: 'Failed to fetch all chats' });
  }
});

router.get('/api/admin/all-jobs', async (req: any, res) => {
  try {
    const currentUser = req.user;
    if (!currentUser?.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { limit, offset } = parsePagination(req);

    const [totalResult, page] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(schema.benchJobs),
      db.select({
        job: schema.benchJobs,
        ampProfile: schema.ampProfiles,
        user: userPublicCols,
      }).from(schema.benchJobs)
        .leftJoin(schema.ampProfiles, eq(schema.benchJobs.ampProfileId, schema.ampProfiles.id))
        .leftJoin(schema.users, eq(schema.benchJobs.userId, schema.users.id))
        .orderBy(desc(schema.benchJobs.createdAt))
        .limit(limit)
        .offset(offset),
    ]);

    const total = totalResult[0]?.count ?? 0;
    res.json({ data: page, total, hasMore: offset + page.length < total });
  } catch (error) {
    console.error('Error fetching all jobs:', error);
    res.status(500).json({ error: 'Failed to fetch all jobs' });
  }
});

router.patch('/api/admin/users/:userId', async (req: any, res) => {
  try {
    const currentUser = req.user;
    if (!currentUser?.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { userId } = req.params;
    const { isAdmin, tokenQuota, isApproved } = req.body;

    const patch: Record<string, any> = {};
    if (typeof isAdmin === 'boolean') patch.isAdmin = isAdmin;
    if (typeof isApproved === 'boolean') patch.isApproved = isApproved;
    if (tokenQuota !== undefined) patch.tokenQuota = tokenQuota === null ? null : parseInt(tokenQuota);

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const [updated] = await db.update(schema.users)
      .set(patch)
      .where(eq(schema.users.id, userId))
      .returning();

    if (!updated) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, user: updated });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

router.delete('/api/admin/users/:userId', async (req: any, res) => {
  try {
    const currentUser = req.user;
    if (!currentUser?.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { userId } = req.params;

    // Prevent self-deletion via admin route
    if (userId === currentUser.id) {
      return res.status(400).json({ error: 'Cannot delete your own account via admin' });
    }

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
    await db.delete(schema.users).where(eq(schema.users.id, userId));

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Sentry sanity-check endpoint — throws an error so we can verify the
// Sentry integration is capturing exceptions in production. Admin only.
router.get('/api/admin/sentry-test', (req: any, _res) => {
  if (!req.user?.isAdmin) {
    throw new Error('Sentry test must be called by an admin');
  }
  throw new Error(`Sentry test exception at ${new Date().toISOString()}`);
});

router.get('/api/admin/stats', async (req: any, res) => {
  try {
    const currentUser = req.user;
    if (!currentUser?.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Per-user token breakdown sorted by usage
    const userTokens = await db.select({
      id: schema.users.id,
      email: schema.users.email,
      firstName: schema.users.firstName,
      lastName: schema.users.lastName,
      totalTokensUsed: schema.users.totalTokensUsed,
    }).from(schema.users).orderBy(desc(schema.users.totalTokensUsed));

    const totalTokens = userTokens.reduce((sum, u) => sum + (u.totalTokensUsed || 0), 0);

    // GPT-4o blended rate: ~$5 / 1M tokens (70% input @ $2.50, 30% output @ $10)
    const COST_PER_TOKEN = 5 / 1_000_000;
    const estimatedCostUsd = totalTokens * COST_PER_TOKEN;

    const breakdown = userTokens
      .filter(u => (u.totalTokensUsed || 0) > 0)
      .map(u => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        tokens: u.totalTokensUsed || 0,
        estimatedCostUsd: (u.totalTokensUsed || 0) * COST_PER_TOKEN,
      }));

    // Total assistant message count as a proxy for API call count
    const msgCountResult = await db.execute(
      sql`SELECT COUNT(*) as count FROM chat_messages WHERE role = 'assistant'`
    );
    const totalAssistantMessages = parseInt((msgCountResult.rows[0] as any)?.count || '0');

    res.json({
      totalTokens,
      estimatedCostUsd,
      totalAssistantMessages,
      breakdown,
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
