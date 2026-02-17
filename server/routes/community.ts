import { Router } from 'express';
import { db, schema } from '../db';
import { eq, desc, ilike, or, and } from 'drizzle-orm';

const router = Router();

router.get('/api/community/jobs', async (req: any, res) => {
  try {
    const { search, circuitFamily, make } = req.query;
    
    let query = db.select({
      job: schema.benchJobs,
      ampProfile: schema.ampProfiles,
      user: schema.users,
    }).from(schema.benchJobs)
      .leftJoin(schema.ampProfiles, eq(schema.benchJobs.ampProfileId, schema.ampProfiles.id))
      .leftJoin(schema.users, eq(schema.benchJobs.userId, schema.users.id))
      .where(eq(schema.benchJobs.isPublic, true))
      .orderBy(desc(schema.benchJobs.updatedAt));
    
    const results = await query;
    
    let filteredResults = results;
    
    if (search) {
      const searchLower = (search as string).toLowerCase();
      filteredResults = filteredResults.filter(({ job, ampProfile }) => 
        ampProfile?.make?.toLowerCase().includes(searchLower) ||
        ampProfile?.model?.toLowerCase().includes(searchLower) ||
        ampProfile?.circuitFamily?.toLowerCase().includes(searchLower) ||
        job.ownerSymptoms?.toLowerCase().includes(searchLower)
      );
    }
    
    if (circuitFamily) {
      filteredResults = filteredResults.filter(({ ampProfile }) => 
        ampProfile?.circuitFamily?.toLowerCase() === (circuitFamily as string).toLowerCase()
      );
    }
    
    if (make) {
      filteredResults = filteredResults.filter(({ ampProfile }) => 
        ampProfile?.make?.toLowerCase() === (make as string).toLowerCase()
      );
    }
    
    const publicJobs = filteredResults.map(({ job, ampProfile, user }) => ({
      id: job.id,
      status: job.status,
      ownerSymptoms: job.ownerSymptoms,
      techNotes: job.techNotes,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      shareAnonymously: job.shareAnonymously,
      ampProfile: ampProfile ? {
        make: ampProfile.make,
        model: ampProfile.model,
        year: ampProfile.year,
        circuitFamily: ampProfile.circuitFamily,
      } : null,
      owner: job.shareAnonymously ? null : {
        firstName: user?.firstName,
        lastName: user?.lastName,
        profileImageUrl: user?.profileImageUrl,
      },
    }));
    
    res.json(publicJobs);
  } catch (error) {
    console.error('Error fetching community jobs:', error);
    res.status(500).json({ error: 'Failed to fetch community jobs' });
  }
});

router.get('/api/community/jobs/:id', async (req: any, res) => {
  try {
    const { id } = req.params;
    
    const [result] = await db.select({
      job: schema.benchJobs,
      ampProfile: schema.ampProfiles,
      user: schema.users,
    }).from(schema.benchJobs)
      .leftJoin(schema.ampProfiles, eq(schema.benchJobs.ampProfileId, schema.ampProfiles.id))
      .leftJoin(schema.users, eq(schema.benchJobs.userId, schema.users.id))
      .where(and(
        eq(schema.benchJobs.id, id),
        eq(schema.benchJobs.isPublic, true)
      ));
    
    if (!result) {
      return res.status(404).json({ error: 'Job not found or not public' });
    }
    
    const { job, ampProfile, user } = result;
    
    const measurements = await db.select().from(schema.measurements)
      .where(eq(schema.measurements.benchJobId, id))
      .orderBy(schema.measurements.createdAt);
    
    const jobSchematics = await db
      .select({ schematic: schema.schematics })
      .from(schema.jobSchematics)
      .innerJoin(schema.schematics, eq(schema.jobSchematics.schematicId, schema.schematics.id))
      .where(eq(schema.jobSchematics.benchJobId, id));
    
    // Get chat messages for this job
    const [jobChat] = await db.select().from(schema.chats)
      .where(eq(schema.chats.benchJobId, id));
    
    let chatMessages: any[] = [];
    if (jobChat) {
      const messages = await db.select().from(schema.chatMessages)
        .where(eq(schema.chatMessages.chatId, jobChat.id))
        .orderBy(schema.chatMessages.createdAt);
      chatMessages = messages.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        attachments: m.attachments,
        createdAt: m.createdAt,
      }));
    }
    
    const publicJob = {
      id: job.id,
      status: job.status,
      ownerSymptoms: job.ownerSymptoms,
      techNotes: job.techNotes,
      priorWork: job.priorWork,
      knownMods: job.knownMods,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      shareAnonymously: job.shareAnonymously,
      ampProfile: ampProfile ? {
        make: ampProfile.make,
        model: ampProfile.model,
        year: ampProfile.year,
        circuitFamily: ampProfile.circuitFamily,
      } : null,
      owner: job.shareAnonymously ? null : {
        firstName: user?.firstName,
        lastName: user?.lastName,
        profileImageUrl: user?.profileImageUrl,
      },
      measurements: measurements.map(m => ({
        nodeName: m.nodeName,
        recordedValue: m.recordedValue,
        expectedMin: m.expectedMin,
        expectedMax: m.expectedMax,
        unit: m.unit,
        status: m.status,
        notes: m.notes,
      })),
      schematics: jobSchematics.map(js => ({
        id: js.schematic.id,
        name: js.schematic.name,
        ampModel: js.schematic.ampModel,
        circuitFamily: js.schematic.circuitFamily,
      })),
      chatMessages,
    };
    
    res.json(publicJob);
  } catch (error) {
    console.error('Error fetching community job:', error);
    res.status(500).json({ error: 'Failed to fetch community job' });
  }
});

export default router;
