import { Router } from 'express';
import { db, schema } from '../db';
import { eq, and } from 'drizzle-orm';

const router = Router();

router.post('/api/measurements', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    const isAdmin = req.user?.isAdmin;
    const { benchJobId, nodeName, expectedMin, expectedMax, recordedValue, unit, meterTool, meterMode, notes, testStepId } = req.body;
    
    if (!benchJobId) {
      return res.status(400).json({ error: 'Bench job ID is required' });
    }
    
    if (!nodeName || recordedValue === null || recordedValue === undefined) {
      return res.status(400).json({ error: 'Node name and recorded value are required' });
    }
    
    const [benchJob] = await db.select().from(schema.benchJobs).where(eq(schema.benchJobs.id, benchJobId));
    if (!benchJob) {
      return res.status(404).json({ error: 'Bench job not found' });
    }
    if (benchJob.userId !== userId && !isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    if (!benchJob.safetyChecklistCompleted) {
      return res.status(403).json({ 
        error: 'Safety checklist must be completed before recording measurements',
        safetyRequired: true
      });
    }
    
    let status = 'unknown';
    if (recordedValue !== null && recordedValue !== undefined) {
      if (expectedMin !== null && expectedMax !== null) {
        if (recordedValue >= expectedMin && recordedValue <= expectedMax) {
          status = 'green';
        } else if (recordedValue >= expectedMin * 0.8 && recordedValue <= expectedMax * 1.2) {
          status = 'yellow';
        } else {
          status = 'red';
        }
      }
    }
    
    const [measurement] = await db.insert(schema.measurements).values({
      benchJobId,
      testStepId,
      nodeName,
      expectedMin,
      expectedMax,
      recordedValue,
      unit,
      meterTool,
      meterMode,
      status,
      notes,
    }).returning();
    
    res.json(measurement);
  } catch (error) {
    console.error('Error creating measurement:', error);
    res.status(500).json({ error: 'Failed to create measurement' });
  }
});

router.get('/api/measurements/:benchJobId', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    const isAdmin = req.user?.isAdmin;

    const [benchJob] = await db.select().from(schema.benchJobs).where(eq(schema.benchJobs.id, req.params.benchJobId));
    if (!benchJob) {
      return res.status(404).json({ error: 'Bench job not found' });
    }
    if (benchJob.userId !== userId && !isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const measurements = await db.select().from(schema.measurements).where(eq(schema.measurements.benchJobId, req.params.benchJobId));
    res.json(measurements);
  } catch (error) {
    console.error('Error fetching measurements:', error);
    res.status(500).json({ error: 'Failed to fetch measurements' });
  }
});

router.delete('/api/measurements/:id', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    const isAdmin = req.user?.isAdmin;

    const [measurement] = await db.select().from(schema.measurements)
      .where(eq(schema.measurements.id, req.params.id));
    if (!measurement) {
      return res.status(404).json({ error: 'Measurement not found' });
    }

    if (measurement.benchJobId) {
      const [benchJob] = await db.select().from(schema.benchJobs)
        .where(eq(schema.benchJobs.id, measurement.benchJobId));
      if (benchJob && benchJob.userId !== userId && !isAdmin) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    await db.delete(schema.measurements).where(eq(schema.measurements.id, req.params.id));
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting measurement:', error);
    res.status(500).json({ error: 'Failed to delete measurement' });
  }
});

export default router;
