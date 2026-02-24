import { Router } from 'express';
import { db, schema } from '../db';
import { eq, desc, ilike, or, and, sql } from 'drizzle-orm';

const router = Router();

router.get('/api/bench-jobs', async (req: any, res) => {
  try {
    const { status, search, limit: limitStr, offset: offsetStr } = req.query;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const limit = Math.min(parseInt(limitStr as string) || 20, 50);
    const offset = parseInt(offsetStr as string) || 0;
    
    let query = db.select({
      job: schema.benchJobs,
      ampProfile: schema.ampProfiles,
    }).from(schema.benchJobs)
      .leftJoin(schema.ampProfiles, eq(schema.benchJobs.ampProfileId, schema.ampProfiles.id));
    
    const conditions = [eq(schema.benchJobs.userId, userId)];
    if (status && status !== 'all') {
      conditions.push(eq(schema.benchJobs.status, status as string));
    }
    if (search) {
      const searchTerm = `%${(search as string).toLowerCase()}%`;
      conditions.push(
        or(
          ilike(schema.ampProfiles.make, searchTerm),
          ilike(schema.ampProfiles.model, searchTerm),
          ilike(schema.benchJobs.ownerSymptoms, searchTerm),
          ilike(schema.benchJobs.techNotes, searchTerm)
        )
      );
    }
    
    const where = and(...conditions);
    
    // Get total count
    const [{ count: total }] = await db.select({ count: sql<number>`count(*)::int` })
      .from(schema.benchJobs)
      .leftJoin(schema.ampProfiles, eq(schema.benchJobs.ampProfileId, schema.ampProfiles.id))
      .where(where);
    
    const results = await query.where(where)
      .orderBy(desc(schema.benchJobs.createdAt))
      .limit(limit)
      .offset(offset);
    
    res.json({ data: results, total, hasMore: offset + results.length < total });
  } catch (error) {
    console.error('Error fetching bench jobs:', error);
    res.status(500).json({ error: 'Failed to fetch bench jobs' });
  }
});

router.post('/api/bench-jobs', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { ampMake, ampModel, ampYear, ownerSymptoms, techNotes, priorWork, knownMods, circuitFamily, serialNumber, photoUrl } = req.body;
    
    if (!ampMake || !ampModel) {
      return res.status(400).json({ error: 'Amp make and model are required' });
    }
    
    const [ampProfile] = await db.insert(schema.ampProfiles).values({
      make: ampMake,
      model: ampModel,
      year: ampYear,
      circuitFamily,
      serialNumber,
      photoUrl,
    }).returning();

    const [benchJob] = await db.insert(schema.benchJobs).values({
      userId,
      ampProfileId: ampProfile.id,
      ownerSymptoms,
      techNotes,
      priorWork,
      knownMods,
    }).returning();

    res.json({ benchJob, ampProfile });
  } catch (error) {
    console.error('Error creating bench job:', error);
    res.status(500).json({ error: 'Failed to create bench job' });
  }
});

router.get('/api/bench-jobs/:id', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    const isAdmin = req.user?.isAdmin;
    
    const [job] = await db.select().from(schema.benchJobs).where(eq(schema.benchJobs.id, req.params.id));
    if (!job) {
      return res.status(404).json({ error: 'Bench job not found' });
    }
    
    if (job.userId !== userId && !isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const [ampProfile] = job.ampProfileId 
      ? await db.select().from(schema.ampProfiles).where(eq(schema.ampProfiles.id, job.ampProfileId))
      : [null];
    
    const measurements = await db.select().from(schema.measurements).where(eq(schema.measurements.benchJobId, job.id));
    const sessions = await db.select().from(schema.troubleshootingSessions).where(eq(schema.troubleshootingSessions.benchJobId, job.id));
    const repairActions = await db.select().from(schema.repairActions).where(eq(schema.repairActions.benchJobId, job.id));
    
    res.json({ job, ampProfile, measurements, sessions, repairActions });
  } catch (error) {
    console.error('Error fetching bench job:', error);
    res.status(500).json({ error: 'Failed to fetch bench job' });
  }
});

router.patch('/api/bench-jobs/:id/safety-checklist', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    const isAdmin = req.user?.isAdmin;
    
    const [job] = await db.select().from(schema.benchJobs).where(eq(schema.benchJobs.id, req.params.id));
    if (!job) {
      return res.status(404).json({ error: 'Bench job not found' });
    }
    if (job.userId !== userId && !isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const [updated] = await db.update(schema.benchJobs)
      .set({ safetyChecklistCompleted: true, updatedAt: new Date() })
      .where(eq(schema.benchJobs.id, req.params.id))
      .returning();
    res.json(updated);
  } catch (error) {
    console.error('Error updating safety checklist:', error);
    res.status(500).json({ error: 'Failed to update safety checklist' });
  }
});

router.patch('/api/bench-jobs/:id/notes', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    const isAdmin = req.user?.isAdmin;
    
    const [job] = await db.select().from(schema.benchJobs).where(eq(schema.benchJobs.id, req.params.id));
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    if (job.userId !== userId && !isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const { techNotes } = req.body;
    const [updated] = await db
      .update(schema.benchJobs)
      .set({ techNotes, updatedAt: new Date() })
      .where(eq(schema.benchJobs.id, req.params.id))
      .returning();
    res.json(updated);
  } catch (error) {
    console.error('Error updating notes:', error);
    res.status(500).json({ error: 'Failed to update notes' });
  }
});

router.patch('/api/bench-jobs/:id/status', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    const isAdmin = req.user?.isAdmin;
    
    const [job] = await db.select().from(schema.benchJobs).where(eq(schema.benchJobs.id, req.params.id));
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    if (job.userId !== userId && !isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const { status } = req.body;
    const validStatuses = ['active', 'in_progress', 'waiting_parts', 'completed', 'archived'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const [updated] = await db
      .update(schema.benchJobs)
      .set({ status, updatedAt: new Date() })
      .where(eq(schema.benchJobs.id, req.params.id))
      .returning();
    res.json(updated);
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

router.patch('/api/bench-jobs/:id/amp-profile', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    const isAdmin = req.user?.isAdmin;
    
    const { make, model, year, circuitFamily } = req.body;
    const [job] = await db.select().from(schema.benchJobs).where(eq(schema.benchJobs.id, req.params.id));
    if (!job || !job.ampProfileId) {
      return res.status(404).json({ error: 'Job not found' });
    }
    if (job.userId !== userId && !isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const [updated] = await db
      .update(schema.ampProfiles)
      .set({ make, model, year, circuitFamily })
      .where(eq(schema.ampProfiles.id, job.ampProfileId))
      .returning();
    await db.update(schema.benchJobs).set({ updatedAt: new Date() }).where(eq(schema.benchJobs.id, req.params.id));
    res.json(updated);
  } catch (error) {
    console.error('Error updating amp profile:', error);
    res.status(500).json({ error: 'Failed to update amp profile' });
  }
});

router.delete('/api/bench-jobs/:id', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    const isAdmin = req.user?.isAdmin;
    const jobId = req.params.id;
    
    const [job] = await db.select().from(schema.benchJobs).where(eq(schema.benchJobs.id, jobId));
    if (!job) {
      return res.status(404).json({ error: 'Bench job not found' });
    }
    if (job.userId !== userId && !isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Transaction-based cascade delete
    await db.transaction(async (tx) => {
      // Delete chat messages via subquery on chats
      await tx.delete(schema.chatMessages)
        .where(eq(schema.chatMessages.chatId, 
          tx.select({ id: schema.chats.id }).from(schema.chats).where(eq(schema.chats.benchJobId, jobId))
        ));
      await tx.delete(schema.chats).where(eq(schema.chats.benchJobId, jobId));
      
      // Delete test steps via troubleshooting sessions
      const sessions = await tx.select({ id: schema.troubleshootingSessions.id })
        .from(schema.troubleshootingSessions)
        .where(eq(schema.troubleshootingSessions.benchJobId, jobId));
      for (const session of sessions) {
        await tx.delete(schema.testSteps).where(eq(schema.testSteps.sessionId, session.id));
      }
      await tx.delete(schema.troubleshootingSessions).where(eq(schema.troubleshootingSessions.benchJobId, jobId));
      
      await tx.delete(schema.measurements).where(eq(schema.measurements.benchJobId, jobId));
      await tx.delete(schema.repairActions).where(eq(schema.repairActions.benchJobId, jobId));
      await tx.delete(schema.symptoms).where(eq(schema.symptoms.benchJobId, jobId));
      await tx.delete(schema.jobSchematics).where(eq(schema.jobSchematics.benchJobId, jobId));
      await tx.delete(schema.media).where(eq(schema.media.benchJobId, jobId));
      await tx.delete(schema.benchJobs).where(eq(schema.benchJobs.id, jobId));
      
      if (job.ampProfileId) {
        await tx.delete(schema.ampProfiles).where(eq(schema.ampProfiles.id, job.ampProfileId));
      }
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting bench job:', error);
    res.status(500).json({ error: 'Failed to delete bench job' });
  }
});

router.get('/api/bench-jobs/:id/schematics', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    const isAdmin = req.user?.isAdmin;
    
    const [job] = await db.select().from(schema.benchJobs).where(eq(schema.benchJobs.id, req.params.id));
    if (!job) {
      return res.status(404).json({ error: 'Bench job not found' });
    }
    if (job.userId !== userId && !isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const jobSchematics = await db
      .select({ schematic: schema.schematics })
      .from(schema.jobSchematics)
      .innerJoin(schema.schematics, eq(schema.jobSchematics.schematicId, schema.schematics.id))
      .where(eq(schema.jobSchematics.benchJobId, req.params.id));
    res.json(jobSchematics.map(js => js.schematic));
  } catch (error) {
    console.error('Error fetching job schematics:', error);
    res.status(500).json({ error: 'Failed to fetch job schematics' });
  }
});

router.post('/api/bench-jobs/:id/schematics', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    const isAdmin = req.user?.isAdmin;
    
    const [job] = await db.select().from(schema.benchJobs).where(eq(schema.benchJobs.id, req.params.id));
    if (!job) {
      return res.status(404).json({ error: 'Bench job not found' });
    }
    if (job.userId !== userId && !isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const { schematicId } = req.body;
    const existing = await db.select()
      .from(schema.jobSchematics)
      .where(and(
        eq(schema.jobSchematics.benchJobId, req.params.id),
        eq(schema.jobSchematics.schematicId, schematicId)
      ));
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Schematic already attached' });
    }
    const [link] = await db.insert(schema.jobSchematics).values({
      benchJobId: req.params.id,
      schematicId,
    }).returning();
    res.json(link);
  } catch (error) {
    console.error('Error attaching schematic:', error);
    res.status(500).json({ error: 'Failed to attach schematic' });
  }
});

router.delete('/api/bench-jobs/:id/schematics/:schematicId', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    const isAdmin = req.user?.isAdmin;
    
    const [job] = await db.select().from(schema.benchJobs).where(eq(schema.benchJobs.id, req.params.id));
    if (!job) {
      return res.status(404).json({ error: 'Bench job not found' });
    }
    if (job.userId !== userId && !isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    await db.delete(schema.jobSchematics)
      .where(and(
        eq(schema.jobSchematics.benchJobId, req.params.id),
        eq(schema.jobSchematics.schematicId, req.params.schematicId)
      ));
    res.json({ success: true });
  } catch (error) {
    console.error('Error detaching schematic:', error);
    res.status(500).json({ error: 'Failed to detach schematic' });
  }
});

router.get('/api/bench-jobs/:id/chat', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    const isAdmin = req.user?.isAdmin;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const benchJobId = req.params.id;
    
    const [job] = await db.select().from(schema.benchJobs).where(eq(schema.benchJobs.id, benchJobId));
    if (!job) {
      return res.status(404).json({ error: 'Bench job not found' });
    }
    if (job.userId !== userId && !isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    let [chat] = await db.select().from(schema.chats).where(eq(schema.chats.benchJobId, benchJobId));
    
    if (!chat) {
      [chat] = await db.insert(schema.chats).values({
        userId,
        title: 'Job Chat',
        benchJobId,
        isStandalone: false,
      }).returning();
    }
    
    const messages = await db.select().from(schema.chatMessages)
      .where(eq(schema.chatMessages.chatId, chat.id))
      .orderBy(schema.chatMessages.createdAt);
    
    res.json({ chat, messages });
  } catch (error) {
    console.error('Error fetching job chat:', error);
    res.status(500).json({ error: 'Failed to fetch job chat' });
  }
});

// Reference Articles API

router.patch('/api/bench-jobs/:id/sharing', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    const isAdmin = req.user?.isAdmin;
    const { id } = req.params;
    const { isPublic, shareAnonymously } = req.body;
    
    const [job] = await db.select().from(schema.benchJobs).where(eq(schema.benchJobs.id, id));
    if (!job) {
      return res.status(404).json({ error: 'Bench job not found' });
    }
    if (job.userId !== userId && !isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const updates: any = { updatedAt: new Date() };
    if (isPublic !== undefined) updates.isPublic = isPublic;
    if (shareAnonymously !== undefined) updates.shareAnonymously = shareAnonymously;
    
    const [updated] = await db.update(schema.benchJobs)
      .set(updates)
      .where(eq(schema.benchJobs.id, id))
      .returning();
    
    res.json(updated);
  } catch (error) {
    console.error('Error updating job sharing:', error);
    res.status(500).json({ error: 'Failed to update job sharing' });
  }
});

export default router;
