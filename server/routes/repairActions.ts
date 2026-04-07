import { Router } from 'express';
import { db, schema } from '../db';
import { eq, desc } from 'drizzle-orm';

const router = Router();

// ── List repair actions for a job ───────────────────────────────────────────

router.get('/api/repair-actions/:benchJobId', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    const isAdmin = req.user?.isAdmin;

    const [benchJob] = await db.select().from(schema.benchJobs)
      .where(eq(schema.benchJobs.id, req.params.benchJobId));
    if (!benchJob) {
      return res.status(404).json({ error: 'Bench job not found' });
    }
    if (benchJob.userId !== userId && !isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const actions = await db.select().from(schema.repairActions)
      .where(eq(schema.repairActions.benchJobId, req.params.benchJobId))
      .orderBy(desc(schema.repairActions.createdAt));

    res.json(actions);
  } catch (error) {
    console.error('Error fetching repair actions:', error);
    res.status(500).json({ error: 'Failed to fetch repair actions' });
  }
});

// ── Create a repair action ──────────────────────────────────────────────────

router.post('/api/repair-actions', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    const isAdmin = req.user?.isAdmin;
    const {
      benchJobId,
      description,
      partReplaced,
      partValue,
      partBrand,
      voltageRating,
      dateCode,
      beforeMeasurement,
      afterMeasurement,
      notes,
      photoUrl,
    } = req.body;

    if (!benchJobId) {
      return res.status(400).json({ error: 'Bench job ID is required' });
    }
    if (!description) {
      return res.status(400).json({ error: 'Description is required' });
    }

    const [benchJob] = await db.select().from(schema.benchJobs)
      .where(eq(schema.benchJobs.id, benchJobId));
    if (!benchJob) {
      return res.status(404).json({ error: 'Bench job not found' });
    }
    if (benchJob.userId !== userId && !isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [action] = await db.insert(schema.repairActions).values({
      benchJobId,
      description,
      partReplaced: partReplaced || null,
      partValue: partValue || null,
      partBrand: partBrand || null,
      voltageRating: voltageRating || null,
      dateCode: dateCode || null,
      beforeMeasurement: beforeMeasurement || null,
      afterMeasurement: afterMeasurement || null,
      notes: notes || null,
      photoUrl: photoUrl || null,
    }).returning();

    // Touch parent job's updatedAt
    await db.update(schema.benchJobs)
      .set({ updatedAt: new Date() })
      .where(eq(schema.benchJobs.id, benchJobId));

    res.json(action);
  } catch (error) {
    console.error('Error creating repair action:', error);
    res.status(500).json({ error: 'Failed to create repair action' });
  }
});

// ── Update a repair action ──────────────────────────────────────────────────

router.patch('/api/repair-actions/:id', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    const isAdmin = req.user?.isAdmin;

    const [action] = await db.select().from(schema.repairActions)
      .where(eq(schema.repairActions.id, req.params.id));
    if (!action) {
      return res.status(404).json({ error: 'Repair action not found' });
    }

    // Auth check via parent job
    if (action.benchJobId) {
      const [benchJob] = await db.select().from(schema.benchJobs)
        .where(eq(schema.benchJobs.id, action.benchJobId));
      if (benchJob && benchJob.userId !== userId && !isAdmin) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const {
      description,
      partReplaced,
      partValue,
      partBrand,
      voltageRating,
      dateCode,
      beforeMeasurement,
      afterMeasurement,
      notes,
      photoUrl,
    } = req.body;

    const updates: Record<string, any> = {};
    if (description !== undefined) updates.description = description;
    if (partReplaced !== undefined) updates.partReplaced = partReplaced || null;
    if (partValue !== undefined) updates.partValue = partValue || null;
    if (partBrand !== undefined) updates.partBrand = partBrand || null;
    if (voltageRating !== undefined) updates.voltageRating = voltageRating || null;
    if (dateCode !== undefined) updates.dateCode = dateCode || null;
    if (beforeMeasurement !== undefined) updates.beforeMeasurement = beforeMeasurement || null;
    if (afterMeasurement !== undefined) updates.afterMeasurement = afterMeasurement || null;
    if (notes !== undefined) updates.notes = notes || null;
    if (photoUrl !== undefined) updates.photoUrl = photoUrl || null;

    const [updated] = await db.update(schema.repairActions)
      .set(updates)
      .where(eq(schema.repairActions.id, req.params.id))
      .returning();

    // Touch parent job
    if (action.benchJobId) {
      await db.update(schema.benchJobs)
        .set({ updatedAt: new Date() })
        .where(eq(schema.benchJobs.id, action.benchJobId));
    }

    res.json(updated);
  } catch (error) {
    console.error('Error updating repair action:', error);
    res.status(500).json({ error: 'Failed to update repair action' });
  }
});

// ── Delete a repair action ──────────────────────────────────────────────────

router.delete('/api/repair-actions/:id', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    const isAdmin = req.user?.isAdmin;

    const [action] = await db.select().from(schema.repairActions)
      .where(eq(schema.repairActions.id, req.params.id));
    if (!action) {
      return res.status(404).json({ error: 'Repair action not found' });
    }

    if (action.benchJobId) {
      const [benchJob] = await db.select().from(schema.benchJobs)
        .where(eq(schema.benchJobs.id, action.benchJobId));
      if (benchJob && benchJob.userId !== userId && !isAdmin) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    await db.delete(schema.repairActions)
      .where(eq(schema.repairActions.id, req.params.id));

    // Touch parent job
    if (action.benchJobId) {
      await db.update(schema.benchJobs)
        .set({ updatedAt: new Date() })
        .where(eq(schema.benchJobs.id, action.benchJobId));
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting repair action:', error);
    res.status(500).json({ error: 'Failed to delete repair action' });
  }
});

export default router;
