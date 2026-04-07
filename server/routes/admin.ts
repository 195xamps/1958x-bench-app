import { Router } from 'express';
import { db, schema } from '../db';
import { eq, desc, sql } from 'drizzle-orm';

const router = Router();

router.get('/api/admin/users', async (req: any, res) => {
  try {
    const currentUser = req.user;
    if (!currentUser?.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const allUsers = await db.select().from(schema.users).orderBy(desc(schema.users.createdAt));
    
    const activeSessions = await db.select({ 
      sess: schema.sessions.sess 
    }).from(schema.sessions)
      .where(sql`expire > NOW()`);
    
    const activeUserIds = new Set(
      activeSessions
        .map(s => (s.sess as any)?.passport?.user)
        .filter(Boolean)
    );
    
    const chatCounts = await db.execute(sql`
      SELECT user_id, COUNT(*) as count 
      FROM chats 
      WHERE user_id IS NOT NULL 
      GROUP BY user_id
    `);
    const chatCountMap = new Map((chatCounts.rows as any[]).map(r => [r.user_id, parseInt(r.count)]));
    
    const jobCounts = await db.execute(sql`
      SELECT user_id, COUNT(*) as count 
      FROM bench_jobs 
      WHERE user_id IS NOT NULL 
      GROUP BY user_id
    `);
    const jobCountMap = new Map((jobCounts.rows as any[]).map(r => [r.user_id, parseInt(r.count)]));
    
    const usersWithStats = allUsers.map(user => ({
      ...user,
      chatCount: chatCountMap.get(user.id) || 0,
      jobCount: jobCountMap.get(user.id) || 0,
      isActive: activeUserIds.has(user.id),
    }));
    
    res.json(usersWithStats);
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
    const userChats = await db.select().from(schema.chats)
      .where(eq(schema.chats.userId, userId))
      .orderBy(desc(schema.chats.updatedAt));
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
    const userJobs = await db.select({
      job: schema.benchJobs,
      ampProfile: schema.ampProfiles,
    }).from(schema.benchJobs)
      .leftJoin(schema.ampProfiles, eq(schema.benchJobs.ampProfileId, schema.ampProfiles.id))
      .where(eq(schema.benchJobs.userId, userId))
      .orderBy(desc(schema.benchJobs.createdAt));
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
    
    const allChats = await db.select({
      chat: schema.chats,
      user: schema.users,
    }).from(schema.chats)
      .leftJoin(schema.users, eq(schema.chats.userId, schema.users.id))
      .orderBy(desc(schema.chats.updatedAt));
    res.json(allChats);
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
    
    const allJobs = await db.select({
      job: schema.benchJobs,
      ampProfile: schema.ampProfiles,
      user: schema.users,
    }).from(schema.benchJobs)
      .leftJoin(schema.ampProfiles, eq(schema.benchJobs.ampProfileId, schema.ampProfiles.id))
      .leftJoin(schema.users, eq(schema.benchJobs.userId, schema.users.id))
      .orderBy(desc(schema.benchJobs.createdAt));
    res.json(allJobs);
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
    const { isAdmin, tokenQuota } = req.body;

    const patch: Record<string, any> = {};
    if (typeof isAdmin === 'boolean') patch.isAdmin = isAdmin;
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
