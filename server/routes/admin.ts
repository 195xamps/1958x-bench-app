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

export default router;
