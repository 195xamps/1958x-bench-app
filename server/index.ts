import express from 'express';
import cors from 'cors';
import { db, schema } from './db';
import { eq } from 'drizzle-orm';
import OpenAI from 'openai';

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: "https://ai.replit.dev/v1",
});

const SYSTEM_PROMPT = `You are a senior guitar amplifier technician and bench mentor for the 195X Bench App. Your role is to guide technicians step-by-step through troubleshooting, servicing, and validating guitar amplifiers (vintage and modern), including blackface/silverface Fender-style circuits and beyond.

CRITICAL SAFETY RULES:
1. Always start with a safety gate for any high voltage procedure
2. Require explicit safety confirmations during high-voltage steps
3. Never recommend unsafe procedures
4. Include "stop conditions" (when to halt and reassess)

BEHAVIOR:
- Be calm and methodical like a bench mentor
- Ask only for info required to choose the next test
- Provide step order, exact meter settings, where to place probes
- Explain what "normal" looks like, what anomalies suggest, and what to do next
- Prioritize safety and verified service practices over internet lore

FOR EACH TEST STEP PROVIDE:
- Exact meter mode (AC/DC, V, mV, ohms, diode test)
- Probe placement guidance
- What could go wrong and how to avoid it
- Normal ranges and what deviations imply

Common symptoms you can help diagnose:
- Hum after recap
- No sound
- Red plating
- Motorboating
- Volume drop
- Reverb not working
- Tremolo weak
- Fuse blows
- Scratchy pots
- Pops when toggling standby

Format your responses with clear step numbers and safety warnings prominently displayed.`;

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '195X Bench App API running' });
});

app.get('/api/bench-jobs', async (req, res) => {
  try {
    const jobs = await db.select().from(schema.benchJobs);
    res.json(jobs);
  } catch (error) {
    console.error('Error fetching bench jobs:', error);
    res.status(500).json({ error: 'Failed to fetch bench jobs' });
  }
});

app.post('/api/bench-jobs', async (req, res) => {
  try {
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

app.get('/api/bench-jobs/:id', async (req, res) => {
  try {
    const [job] = await db.select().from(schema.benchJobs).where(eq(schema.benchJobs.id, req.params.id));
    if (!job) {
      return res.status(404).json({ error: 'Bench job not found' });
    }
    
    const [ampProfile] = job.ampProfileId 
      ? await db.select().from(schema.ampProfiles).where(eq(schema.ampProfiles.id, job.ampProfileId))
      : [null];
    
    const measurements = await db.select().from(schema.measurements).where(eq(schema.measurements.benchJobId, job.id));
    const sessions = await db.select().from(schema.troubleshootingSessions).where(eq(schema.troubleshootingSessions.benchJobId, job.id));
    
    res.json({ job, ampProfile, measurements, sessions });
  } catch (error) {
    console.error('Error fetching bench job:', error);
    res.status(500).json({ error: 'Failed to fetch bench job' });
  }
});

app.patch('/api/bench-jobs/:id/safety-checklist', async (req, res) => {
  try {
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

app.post('/api/troubleshooting/start', async (req, res) => {
  try {
    const { benchJobId, mode = 'guided' } = req.body;
    
    if (!benchJobId) {
      return res.status(400).json({ error: 'Bench job ID is required to start troubleshooting' });
    }
    
    const [benchJob] = await db.select().from(schema.benchJobs).where(eq(schema.benchJobs.id, benchJobId));
    if (!benchJob) {
      return res.status(404).json({ error: 'Bench job not found' });
    }
    
    if (!benchJob.safetyChecklistCompleted) {
      return res.status(403).json({ 
        error: 'Safety checklist must be completed before starting troubleshooting',
        safetyRequired: true
      });
    }
    
    const [session] = await db.insert(schema.troubleshootingSessions).values({
      benchJobId,
      mode,
      aiConversationHistory: [],
    }).returning();
    
    res.json(session);
  } catch (error) {
    console.error('Error starting troubleshooting session:', error);
    res.status(500).json({ error: 'Failed to start troubleshooting session' });
  }
});

app.post('/api/troubleshooting/chat', async (req, res) => {
  try {
    const { sessionId, message, benchJobContext } = req.body;
    
    const [session] = await db.select().from(schema.troubleshootingSessions).where(eq(schema.troubleshootingSessions.id, sessionId));
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const history = (session.aiConversationHistory as any[]) || [];
    
    const contextMessage = benchJobContext 
      ? `Current amp: ${benchJobContext.make || 'Unknown'} ${benchJobContext.model || 'Unknown'} (${benchJobContext.year || 'Unknown year'}). Owner symptoms: ${benchJobContext.ownerSymptoms || 'None provided'}. Known mods: ${benchJobContext.knownMods || 'None'}. Prior work: ${benchJobContext.priorWork || 'None'}.`
      : '';
    
    const messages: any[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...(contextMessage ? [{ role: 'system', content: `Context: ${contextMessage}` }] : []),
      ...history,
      { role: 'user', content: message }
    ];
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      temperature: 0.7,
      max_tokens: 2000,
    });
    
    const assistantMessage = completion.choices[0].message.content;
    
    const updatedHistory = [
      ...history,
      { role: 'user', content: message },
      { role: 'assistant', content: assistantMessage }
    ];
    
    await db.update(schema.troubleshootingSessions)
      .set({ aiConversationHistory: updatedHistory, updatedAt: new Date() })
      .where(eq(schema.troubleshootingSessions.id, sessionId));
    
    res.json({ message: assistantMessage, sessionId });
  } catch (error) {
    console.error('Error in troubleshooting chat:', error);
    res.status(500).json({ error: 'Failed to get AI response' });
  }
});

app.post('/api/measurements', async (req, res) => {
  try {
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

app.get('/api/measurements/:benchJobId', async (req, res) => {
  try {
    const measurements = await db.select().from(schema.measurements).where(eq(schema.measurements.benchJobId, req.params.benchJobId));
    res.json(measurements);
  } catch (error) {
    console.error('Error fetching measurements:', error);
    res.status(500).json({ error: 'Failed to fetch measurements' });
  }
});

app.get('/api/schematics', async (req, res) => {
  try {
    const schematics = await db.select().from(schema.schematics);
    res.json(schematics);
  } catch (error) {
    console.error('Error fetching schematics:', error);
    res.status(500).json({ error: 'Failed to fetch schematics' });
  }
});

app.post('/api/schematics', async (req, res) => {
  try {
    const { name, ampModel, circuitFamily, fileUrl, tags, notes, isUserUploaded = true } = req.body;
    
    const [schematic] = await db.insert(schema.schematics).values({
      name,
      ampModel,
      circuitFamily,
      fileUrl,
      tags,
      notes,
      isUserUploaded,
    }).returning();
    
    res.json(schematic);
  } catch (error) {
    console.error('Error creating schematic:', error);
    res.status(500).json({ error: 'Failed to create schematic' });
  }
});

app.get('/api/schematics/search', async (req, res) => {
  try {
    const { q } = req.query;
    const allSchematics = await db.select().from(schema.schematics);
    
    if (!q) {
      return res.json(allSchematics);
    }
    
    const searchTerm = (q as string).toLowerCase();
    const filtered = allSchematics.filter(s => 
      s.name?.toLowerCase().includes(searchTerm) ||
      s.ampModel?.toLowerCase().includes(searchTerm) ||
      s.circuitFamily?.toLowerCase().includes(searchTerm) ||
      s.tags?.toLowerCase().includes(searchTerm)
    );
    
    res.json(filtered);
  } catch (error) {
    console.error('Error searching schematics:', error);
    res.status(500).json({ error: 'Failed to search schematics' });
  }
});

const PORT = parseInt(process.env.PORT || '3001', 10);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
