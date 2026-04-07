import { Router } from 'express';
import { db, schema } from '../db';
import { eq, desc, ilike, or, and, sql } from 'drizzle-orm';

const router = Router();

// Minimal owner projection for community feed — no email, no admin/quota
// data, no API key. Just what the UI shows.
const ownerCols = {
  firstName: schema.users.firstName,
  lastName: schema.users.lastName,
  profileImageUrl: schema.users.profileImageUrl,
};

router.get('/api/community/jobs', async (req: any, res) => {
  try {
    const { search, circuitFamily, make, limit: limitStr, offset: offsetStr } = req.query;
    
    const limit = Math.min(parseInt(limitStr as string) || 20, 50);
    const offset = parseInt(offsetStr as string) || 0;
    
    const conditions: any[] = [eq(schema.benchJobs.isPublic, true)];
    
    if (search) {
      const searchTerm = `%${(search as string).toLowerCase()}%`;
      conditions.push(
        or(
          ilike(schema.ampProfiles.make, searchTerm),
          ilike(schema.ampProfiles.model, searchTerm),
          ilike(schema.ampProfiles.circuitFamily, searchTerm),
          ilike(schema.benchJobs.ownerSymptoms, searchTerm)
        )
      );
    }
    
    if (circuitFamily) {
      conditions.push(ilike(schema.ampProfiles.circuitFamily, circuitFamily as string));
    }
    
    if (make) {
      conditions.push(ilike(schema.ampProfiles.make, make as string));
    }
    
    const where = and(...conditions);
    
    const [{ count: total }] = await db.select({ count: sql<number>`count(*)::int` })
      .from(schema.benchJobs)
      .leftJoin(schema.ampProfiles, eq(schema.benchJobs.ampProfileId, schema.ampProfiles.id))
      .where(where);
    
    const results = await db.select({
      job: schema.benchJobs,
      ampProfile: schema.ampProfiles,
      user: ownerCols,
    }).from(schema.benchJobs)
      .leftJoin(schema.ampProfiles, eq(schema.benchJobs.ampProfileId, schema.ampProfiles.id))
      .leftJoin(schema.users, eq(schema.benchJobs.userId, schema.users.id))
      .where(where)
      .orderBy(desc(schema.benchJobs.updatedAt))
      .limit(limit)
      .offset(offset);
    
    const publicJobs = results.map(({ job, ampProfile, user }) => ({
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
    
    res.json({ data: publicJobs, total, hasMore: offset + results.length < total });
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
      user: ownerCols,
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

    // Run the 4 detail queries in parallel — they're independent reads
    // and used to be serial, costing ~4x the latency they should.
    const [measurements, repairActions, jobSchematics, jobChats] = await Promise.all([
      db.select().from(schema.measurements)
        .where(eq(schema.measurements.benchJobId, id))
        .orderBy(schema.measurements.createdAt),
      db.select().from(schema.repairActions)
        .where(eq(schema.repairActions.benchJobId, id))
        .orderBy(desc(schema.repairActions.createdAt)),
      db.select({ schematic: schema.schematics })
        .from(schema.jobSchematics)
        .innerJoin(schema.schematics, eq(schema.jobSchematics.schematicId, schema.schematics.id))
        .where(eq(schema.jobSchematics.benchJobId, id)),
      db.select().from(schema.chats).where(eq(schema.chats.benchJobId, id)),
    ]);

    const jobChat = jobChats[0];
    let chatMessages: any[] = [];
    if (jobChat) {
      const messages = await db.select({
        id: schema.chatMessages.id,
        role: schema.chatMessages.role,
        content: schema.chatMessages.content,
        attachments: schema.chatMessages.attachments,
        createdAt: schema.chatMessages.createdAt,
      }).from(schema.chatMessages)
        .where(eq(schema.chatMessages.chatId, jobChat.id))
        .orderBy(schema.chatMessages.createdAt);
      chatMessages = messages;
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
      repairActions: repairActions.map(ra => ({
        description: ra.description,
        partReplaced: ra.partReplaced,
        partValue: ra.partValue,
        partBrand: ra.partBrand,
        voltageRating: ra.voltageRating,
        beforeMeasurement: ra.beforeMeasurement,
        afterMeasurement: ra.afterMeasurement,
        notes: ra.notes,
        createdAt: ra.createdAt,
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
