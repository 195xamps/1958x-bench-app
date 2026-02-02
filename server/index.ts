import express from 'express';
import cors from 'cors';
import path from 'path';
import axios from 'axios';
import { db, schema } from './db';
import { eq, desc, ilike, or, and } from 'drizzle-orm';
import OpenAI from 'openai';
import { registerObjectStorageRoutes } from './replit_integrations/object_storage';
import { setupAuth, registerAuthRoutes, isAuthenticated } from './replit_integrations/auth';

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

async function initServer() {
  // Setup authentication BEFORE other routes
  await setupAuth(app);
  registerAuthRoutes(app);

  registerObjectStorageRoutes(app);

  app.use(express.static(path.join(__dirname, '..', 'dist', 'client')));
  app.use(express.static(path.join(__dirname, '..', 'dist', 'server')));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '195x Bench App API running' });
});

app.get('/api/bench-jobs', async (req, res) => {
  try {
    const { status, search } = req.query;
    let query = db.select({
      job: schema.benchJobs,
      ampProfile: schema.ampProfiles,
    }).from(schema.benchJobs)
      .leftJoin(schema.ampProfiles, eq(schema.benchJobs.ampProfileId, schema.ampProfiles.id));
    
    const conditions = [];
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
    
    const results = conditions.length > 0 
      ? await query.where(and(...conditions)).orderBy(desc(schema.benchJobs.createdAt))
      : await query.orderBy(desc(schema.benchJobs.createdAt));
    
    res.json(results);
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

app.patch('/api/bench-jobs/:id/notes', async (req, res) => {
  try {
    const { techNotes } = req.body;
    const [updated] = await db
      .update(schema.benchJobs)
      .set({ techNotes, updatedAt: new Date() })
      .where(eq(schema.benchJobs.id, req.params.id))
      .returning();
    if (!updated) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json(updated);
  } catch (error) {
    console.error('Error updating notes:', error);
    res.status(500).json({ error: 'Failed to update notes' });
  }
});

app.patch('/api/bench-jobs/:id/status', async (req, res) => {
  try {
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
    if (!updated) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json(updated);
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

app.patch('/api/bench-jobs/:id/amp-profile', async (req, res) => {
  try {
    const { make, model, year, circuitFamily } = req.body;
    const [job] = await db.select().from(schema.benchJobs).where(eq(schema.benchJobs.id, req.params.id));
    if (!job || !job.ampProfileId) {
      return res.status(404).json({ error: 'Job not found' });
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

app.delete('/api/bench-jobs/:id', async (req, res) => {
  try {
    const jobId = req.params.id;
    
    const [job] = await db.select().from(schema.benchJobs).where(eq(schema.benchJobs.id, jobId));
    if (!job) {
      return res.status(404).json({ error: 'Bench job not found' });
    }
    
    await db.delete(schema.chatMessages)
      .where(eq(schema.chatMessages.chatId, 
        db.select({ id: schema.chats.id }).from(schema.chats).where(eq(schema.chats.benchJobId, jobId))
      ));
    await db.delete(schema.chats).where(eq(schema.chats.benchJobId, jobId));
    await db.delete(schema.measurements).where(eq(schema.measurements.benchJobId, jobId));
    await db.delete(schema.benchJobs).where(eq(schema.benchJobs.id, jobId));
    
    if (job.ampProfileId) {
      await db.delete(schema.ampProfiles).where(eq(schema.ampProfiles.id, job.ampProfileId));
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting bench job:', error);
    res.status(500).json({ error: 'Failed to delete bench job' });
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
      { role: 'system', content: CHAT_SYSTEM_PROMPT },
      ...(contextMessage ? [{ role: 'system', content: `Context: ${contextMessage}` }] : []),
      ...history,
      { role: 'user', content: message }
    ];
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      temperature: 0.7,
      max_tokens: 4000,
    });
    
    const assistantMessage = completion.choices[0].message.content || 'I apologize, but I could not generate a response. Please try again.';
    
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

app.get('/api/schematics/:id', async (req, res) => {
  try {
    const schematicId = req.params.id;
    const [schematic] = await db.select().from(schema.schematics).where(eq(schema.schematics.id, schematicId));
    if (!schematic) {
      return res.status(404).json({ error: 'Schematic not found' });
    }
    res.json(schematic);
  } catch (error) {
    console.error('Error fetching schematic:', error);
    res.status(500).json({ error: 'Failed to fetch schematic' });
  }
});

app.patch('/api/schematics/:id', async (req, res) => {
  try {
    const schematicId = req.params.id;
    const { name, tags, ampModel, circuitFamily, notes, externalLinks } = req.body;
    
    const [schematic] = await db.select().from(schema.schematics).where(eq(schema.schematics.id, schematicId));
    if (!schematic) {
      return res.status(404).json({ error: 'Schematic not found' });
    }
    
    const updateData: Record<string, any> = {};
    if (name !== undefined) updateData.name = name;
    if (tags !== undefined) updateData.tags = tags;
    if (ampModel !== undefined) updateData.ampModel = ampModel;
    if (circuitFamily !== undefined) updateData.circuitFamily = circuitFamily;
    if (notes !== undefined) updateData.notes = notes;
    if (externalLinks !== undefined) updateData.externalLinks = externalLinks;
    
    const [updated] = await db.update(schema.schematics)
      .set(updateData)
      .where(eq(schema.schematics.id, schematicId))
      .returning();
    
    res.json(updated);
  } catch (error) {
    console.error('Error updating schematic:', error);
    res.status(500).json({ error: 'Failed to update schematic' });
  }
});

app.get('/api/schematics/:id/attachments', async (req, res) => {
  try {
    const schematicId = req.params.id;
    const attachments = await db.select().from(schema.schematicAttachments)
      .where(eq(schema.schematicAttachments.schematicId, schematicId));
    res.json(attachments);
  } catch (error) {
    console.error('Error fetching schematic attachments:', error);
    res.status(500).json({ error: 'Failed to fetch attachments' });
  }
});

app.post('/api/schematics/:id/attachments', async (req, res) => {
  try {
    const schematicId = req.params.id;
    const { fileUrl, fileName, fileType } = req.body;
    
    const [attachment] = await db.insert(schema.schematicAttachments).values({
      schematicId,
      fileUrl,
      fileName,
      fileType,
    }).returning();
    
    res.json(attachment);
  } catch (error) {
    console.error('Error adding schematic attachment:', error);
    res.status(500).json({ error: 'Failed to add attachment' });
  }
});

app.delete('/api/schematics/:id/attachments/:attachmentId', async (req, res) => {
  try {
    const { attachmentId } = req.params;
    await db.delete(schema.schematicAttachments)
      .where(eq(schema.schematicAttachments.id, attachmentId));
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting schematic attachment:', error);
    res.status(500).json({ error: 'Failed to delete attachment' });
  }
});

app.delete('/api/schematics/:id', async (req, res) => {
  try {
    const schematicId = req.params.id;
    
    const [schematic] = await db.select().from(schema.schematics).where(eq(schema.schematics.id, schematicId));
    if (!schematic) {
      return res.status(404).json({ error: 'Schematic not found' });
    }
    
    await db.delete(schema.jobSchematics).where(eq(schema.jobSchematics.schematicId, schematicId));
    await db.delete(schema.schematicAttachments).where(eq(schema.schematicAttachments.schematicId, schematicId));
    await db.delete(schema.schematics).where(eq(schema.schematics.id, schematicId));
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting schematic:', error);
    res.status(500).json({ error: 'Failed to delete schematic' });
  }
});

app.get('/api/bench-jobs/:id/schematics', async (req, res) => {
  try {
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

app.post('/api/bench-jobs/:id/schematics', async (req, res) => {
  try {
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

app.delete('/api/bench-jobs/:id/schematics/:schematicId', async (req, res) => {
  try {
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

const CHAT_SYSTEM_PROMPT = `You are a senior guitar amplifier technician and bench mentor for the 195x Bench App with 30+ years of experience working on Fender, Marshall, Vox, Mesa/Boogie, and countless other brands. You guide technicians through troubleshooting, servicing, restoration-minded decisions, and validation of guitar amplifiers (tube and solid state).

YOUR VOICE AND STYLE
Write like an experienced mentor having a conversation at the bench. Be confident, detailed, and thorough. Provide the kind of rich, expert analysis that helps the technician truly understand what they're looking at - not just sparse facts, but context, reasoning, and the "why" behind your conclusions.

RESPONSE FORMAT
Use clear markdown formatting for readability:
- **Bold** for key terms, model names, and important warnings
- Numbered lists for sequential steps
- Bullet points for observations, evidence, and options
- Headers (##) to organize sections when responses are detailed
- Include plenty of detail and explanation - don't be sparse

IMAGE IDENTIFICATION (CRITICAL SKILL)
When shown amp photos, provide a thorough analysis like an expert would:

1. **Lead with confidence** - State your identification clearly (e.g., "Yes — this one is very clear. It's a Fender Deluxe Reverb, Blackface era (AB763 circuit), mid-1960s.")

2. **Key Identifiers** - Break down the visual evidence in detail:
   - Faceplate details (script style, control layout, labeling)
   - Circuit construction (eyelet board vs turret, component types, cap colors)
   - Transformer placement and style
   - Tube complement and socket configuration
   - Power section layout (doghouse cap location, choke placement)
   - Any visible mods or non-original components

3. **Date Range Assessment** - Provide reasoning about dating:
   - Pre-CBS vs CBS-era indicators
   - Component date codes if visible
   - Construction era tells (grounding scheme, component types)

4. **Important Notes** - Be honest about what you can and cannot confirm:
   - What would require additional photos to verify
   - Whether it could be a rebuild, clone, or reproduction
   - Any red flags or concerns

5. **Next Steps** - Suggest what the technician could check to confirm:
   - Transformer date codes
   - Serial number plate
   - Specific component verification

TROUBLESHOOTING GUIDANCE
When helping diagnose problems:
- Start with the most likely causes based on symptoms
- Provide clear, numbered diagnostic steps
- Include expected measurements and what they mean
- Explain the reasoning behind each test
- Include decision points: "If X, then check Y; if not, check Z"
- Always include safety warnings for high-voltage work

SAFETY (NON-NEGOTIABLE)
Always include appropriate safety warnings:
- ⚠️ Warning icon for high-voltage reminders
- One-hand rule for live chassis work
- Discharge procedures before touching filter caps
- Proper grounding and isolation recommendations
- If conditions seem unsafe, recommend power-off diagnostics first

EVIDENCE-BASED ANALYSIS
- Never invent specifications, date codes, or voltages
- When analyzing images, describe what you actually see
- State confidence levels when appropriate
- If you need more information, explain what and why

DATABASE CONTEXT
When the app provides database context (schematics, jobs, measurements), you MUST reference this data in your response:
- If schematics matching the query are found, tell the user they have them in their library and what's available
- If past jobs are found, reference the relevant history
- Always let the user know what resources they already have before suggesting they find more

Remember: Be the kind of mentor who gives thorough, educational responses that help the technician learn, not just quick answers. Provide context, explain reasoning, and share the expertise that comes from decades of bench experience.`;

async function getRelevantDatabaseContext(message: string): Promise<string | null> {
  const lowerMessage = message.toLowerCase();
  let context = '';
  
  const isDbQuery = lowerMessage.includes('have i') || 
    lowerMessage.includes('my past') || 
    lowerMessage.includes('previous') ||
    lowerMessage.includes('worked on') ||
    lowerMessage.includes('show me') ||
    lowerMessage.includes('schematic') ||
    lowerMessage.includes('find') ||
    lowerMessage.includes('search') ||
    lowerMessage.includes('history') ||
    lowerMessage.includes('jobs') ||
    lowerMessage.includes('measurements');
  
  if (!isDbQuery) return null;
  
  try {
    if (lowerMessage.includes('schematic') || lowerMessage.includes('circuit')) {
      const schematics = await db.select().from(schema.schematics);
      if (schematics.length > 0) {
        context += `\n\nSCHEMATICS IN DATABASE (${schematics.length} total):\n`;
        schematics.forEach(s => {
          context += `- ${s.name} (${s.ampModel || 'Unknown model'}, ${s.circuitFamily || 'Unknown family'})\n`;
        });
      } else {
        context += '\n\nNo schematics found in the database yet.';
      }
    }
    
    if (lowerMessage.includes('job') || lowerMessage.includes('worked on') || lowerMessage.includes('have i') || lowerMessage.includes('past') || lowerMessage.includes('history')) {
      const jobs = await db.select({
        job: schema.benchJobs,
        amp: schema.ampProfiles
      }).from(schema.benchJobs)
        .leftJoin(schema.ampProfiles, eq(schema.benchJobs.ampProfileId, schema.ampProfiles.id))
        .orderBy(desc(schema.benchJobs.createdAt));
      
      if (jobs.length > 0) {
        context += `\n\nPAST BENCH JOBS (${jobs.length} total):\n`;
        jobs.forEach(({ job, amp }) => {
          context += `- ${amp?.make || 'Unknown'} ${amp?.model || 'Unknown'} (${amp?.year || 'Unknown year'}) - Status: ${job.status}, Created: ${job.createdAt?.toLocaleDateString()}\n`;
          if (job.ownerSymptoms) context += `  Symptoms: ${job.ownerSymptoms}\n`;
        });
      } else {
        context += '\n\nNo past bench jobs found in the database yet.';
      }
    }
    
    const ampKeywords = ['fender', 'marshall', 'vox', 'mesa', 'boogie', 'twin', 'deluxe', 'princeton', 'bassman', 'ac30', 'ac15', 'jcm', 'plexi', 'champ', 'super', 'reverb', 'tremolux', 'bandmaster', 'showman', 'vibroverb', 'vibrolux'];
    const circuitKeywords = ['5f1', '5e3', '5f6', '5e1', '5c1', 'aa763', 'ab763', 'aa864', 'ab568', 'bf', 'sf', 'tweed', 'blackface', 'silverface', 'brownface'];
    
    const allKeywords = [...ampKeywords, ...circuitKeywords];
    const foundKeywords = allKeywords.filter(kw => lowerMessage.includes(kw));
    
    if (foundKeywords.length > 0) {
      const jobs = await db.select({
        job: schema.benchJobs,
        amp: schema.ampProfiles
      }).from(schema.benchJobs)
        .leftJoin(schema.ampProfiles, eq(schema.benchJobs.ampProfileId, schema.ampProfiles.id));
      
      for (const foundKeyword of foundKeywords) {
        const matchingJobs = jobs.filter(({ amp }) => 
          amp?.make?.toLowerCase().includes(foundKeyword) || 
          amp?.model?.toLowerCase().includes(foundKeyword) ||
          amp?.circuitFamily?.toLowerCase().includes(foundKeyword)
        );
        
        if (matchingJobs.length > 0) {
          context += `\n\nJOBS MATCHING "${foundKeyword.toUpperCase()}":\n`;
          matchingJobs.forEach(({ job, amp }) => {
            context += `- ${amp?.make} ${amp?.model} (${amp?.year || 'Unknown year'}) - ${job.status}\n`;
          });
        }
      }
      
      const allSchematics = await db.select().from(schema.schematics);
      for (const foundKeyword of foundKeywords) {
        const filtered = allSchematics.filter(s => 
          s.name?.toLowerCase().includes(foundKeyword) ||
          s.ampModel?.toLowerCase().includes(foundKeyword) ||
          s.circuitFamily?.toLowerCase().includes(foundKeyword) ||
          s.tags?.toLowerCase().includes(foundKeyword)
        );
        
        if (filtered.length > 0) {
          context += `\n\nSCHEMATICS MATCHING "${foundKeyword.toUpperCase()}":\n`;
          filtered.forEach(s => {
            context += `- ${s.name} (${s.circuitFamily || 'Unknown family'}) - File: ${s.fileUrl ? 'Available in library' : 'No file'}\n`;
          });
        }
      }
    }
    
    return context || null;
  } catch (error) {
    console.error('Error getting database context:', error);
    return null;
  }
}

app.get('/api/chats', async (req, res) => {
  try {
    const allChats = await db.select().from(schema.chats).orderBy(desc(schema.chats.updatedAt));
    res.json(allChats);
  } catch (error) {
    console.error('Error fetching chats:', error);
    res.status(500).json({ error: 'Failed to fetch chats' });
  }
});

app.post('/api/chats', async (req, res) => {
  try {
    const { title, benchJobId } = req.body;
    
    const [chat] = await db.insert(schema.chats).values({
      title: title || 'New Chat',
      benchJobId: benchJobId || null,
      isStandalone: !benchJobId,
    }).returning();
    
    res.json(chat);
  } catch (error) {
    console.error('Error creating chat:', error);
    res.status(500).json({ error: 'Failed to create chat' });
  }
});

app.get('/api/chats/:id', async (req, res) => {
  try {
    const [chat] = await db.select().from(schema.chats).where(eq(schema.chats.id, req.params.id));
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    
    const messages = await db.select().from(schema.chatMessages)
      .where(eq(schema.chatMessages.chatId, chat.id))
      .orderBy(schema.chatMessages.createdAt);
    
    res.json({ chat, messages });
  } catch (error) {
    console.error('Error fetching chat:', error);
    res.status(500).json({ error: 'Failed to fetch chat' });
  }
});

app.patch('/api/chats/:id', async (req, res) => {
  try {
    const { title } = req.body;
    
    const [updated] = await db.update(schema.chats)
      .set({ title, updatedAt: new Date() })
      .where(eq(schema.chats.id, req.params.id))
      .returning();
    
    if (!updated) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    
    res.json(updated);
  } catch (error) {
    console.error('Error updating chat:', error);
    res.status(500).json({ error: 'Failed to update chat' });
  }
});

app.delete('/api/chats/:id', async (req, res) => {
  try {
    await db.delete(schema.chatMessages).where(eq(schema.chatMessages.chatId, req.params.id));
    
    const [deleted] = await db.delete(schema.chats)
      .where(eq(schema.chats.id, req.params.id))
      .returning();
    
    if (!deleted) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting chat:', error);
    res.status(500).json({ error: 'Failed to delete chat' });
  }
});

app.post('/api/chats/:id/messages', async (req, res) => {
  try {
    const { content, attachments } = req.body;
    const chatId = req.params.id;
    
    const [chat] = await db.select().from(schema.chats).where(eq(schema.chats.id, chatId));
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    
    let validatedAttachments = null;
    if (attachments && Array.isArray(attachments)) {
      validatedAttachments = attachments.filter((att: any) => {
        if (!att.url || !att.type) return false;
        if (att.type === 'image') {
          return att.url.includes('/objects/uploads/');
        }
        return false;
      });
      if (validatedAttachments.length === 0) {
        validatedAttachments = null;
      }
    }
    
    const [userMessage] = await db.insert(schema.chatMessages).values({
      chatId,
      role: 'user',
      content,
      attachments: validatedAttachments,
    }).returning();
    
    const previousMessages = await db.select().from(schema.chatMessages)
      .where(eq(schema.chatMessages.chatId, chatId))
      .orderBy(schema.chatMessages.createdAt);
    
    let contextInfo = '';
    
    if (chat.benchJobId) {
      const [job] = await db.select().from(schema.benchJobs).where(eq(schema.benchJobs.id, chat.benchJobId));
      if (job?.ampProfileId) {
        const [amp] = await db.select().from(schema.ampProfiles).where(eq(schema.ampProfiles.id, job.ampProfileId));
        if (amp) {
          contextInfo = `\n\nCURRENT JOB CONTEXT:\nAmp: ${amp.make} ${amp.model} (${amp.year || 'Unknown year'})\nSymptoms: ${job.ownerSymptoms || 'None provided'}\nKnown mods: ${job.knownMods || 'None'}\nPrior work: ${job.priorWork || 'None'}`;
        }
      }
    }
    
    const dbContext = await getRelevantDatabaseContext(content);
    if (dbContext) {
      contextInfo += dbContext;
    }
    
    const publicBaseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : '';
    
    const buildMessageContent = (msg: any): any => {
      const msgAttachments = msg.attachments as any[] | null;
      if (msgAttachments && msgAttachments.length > 0) {
        const contentParts: any[] = [];
        if (msg.content) {
          contentParts.push({ type: 'text', text: msg.content });
        }
        for (const attachment of msgAttachments) {
          if (attachment.type === 'image' && attachment.url) {
            let imageUrl = attachment.url;
            if (imageUrl.startsWith('/') && publicBaseUrl) {
              imageUrl = publicBaseUrl + imageUrl;
            }
            contentParts.push({
              type: 'image_url',
              image_url: { url: imageUrl, detail: 'high' }
            });
          }
        }
        return contentParts.length > 0 ? contentParts : msg.content;
      }
      return msg.content;
    };
    
    const messages: any[] = [
      { role: 'system', content: CHAT_SYSTEM_PROMPT + contextInfo },
      ...previousMessages.slice(0, -1).map(m => ({
        role: m.role,
        content: buildMessageContent(m)
      })),
    ];
    
    const currentMessageContent = buildMessageContent({ content, attachments: validatedAttachments });
    messages.push({ role: 'user', content: currentMessageContent });
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      temperature: 0.7,
      max_tokens: 4000,
    });
    
    const assistantContent = completion.choices[0].message.content || 'I apologize, but I could not generate a response. Please try again.';
    
    const [assistantMessage] = await db.insert(schema.chatMessages).values({
      chatId,
      role: 'assistant',
      content: assistantContent,
    }).returning();
    
    await db.update(schema.chats)
      .set({ updatedAt: new Date() })
      .where(eq(schema.chats.id, chatId));
    
    res.json({ userMessage, assistantMessage });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

app.post('/api/chats/:id/convert-to-job', async (req, res) => {
  try {
    const chatId = req.params.id;
    
    const [chat] = await db.select().from(schema.chats).where(eq(schema.chats.id, chatId));
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    
    if (chat.benchJobId) {
      return res.status(400).json({ error: 'Chat is already linked to a job' });
    }
    
    const [ampProfile] = await db.insert(schema.ampProfiles).values({
      make: '',
      model: '',
    }).returning();
    
    const [benchJob] = await db.insert(schema.benchJobs).values({
      ampProfileId: ampProfile.id,
      techNotes: `Converted from chat: ${chat.title}`,
    }).returning();
    
    const [updatedChat] = await db.update(schema.chats)
      .set({ benchJobId: benchJob.id, isStandalone: false, updatedAt: new Date() })
      .where(eq(schema.chats.id, chatId))
      .returning();
    
    res.json({ benchJob, ampProfile, chat: updatedChat });
  } catch (error) {
    console.error('Error converting chat to job:', error);
    res.status(500).json({ error: 'Failed to convert chat to job' });
  }
});

app.get('/api/bench-jobs/:id/chat', async (req, res) => {
  try {
    const benchJobId = req.params.id;
    
    let [chat] = await db.select().from(schema.chats).where(eq(schema.chats.benchJobId, benchJobId));
    
    if (!chat) {
      [chat] = await db.insert(schema.chats).values({
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
app.get('/api/reference-articles', async (req, res) => {
  try {
    const articles = await db.select().from(schema.referenceArticles)
      .orderBy(desc(schema.referenceArticles.createdAt));
    res.json(articles);
  } catch (error) {
    console.error('Error fetching reference articles:', error);
    res.status(500).json({ error: 'Failed to fetch reference articles' });
  }
});

app.get('/api/reference-articles/:id', async (req, res) => {
  try {
    const [article] = await db.select().from(schema.referenceArticles)
      .where(eq(schema.referenceArticles.id, req.params.id));
    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }
    res.json(article);
  } catch (error) {
    console.error('Error fetching article:', error);
    res.status(500).json({ error: 'Failed to fetch article' });
  }
});

app.post('/api/reference-articles/import', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Fetch the webpage
    const response = await fetch(url);
    if (!response.ok) {
      return res.status(400).json({ error: 'Failed to fetch the URL' });
    }
    const html = await response.text();

    // Extract title from <title> tag
    let title = 'Imported Article';
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      title = titleMatch[1].trim();
      title = title.replace(/\s*-\s*Rob Robinette$/i, '');
    }
    // Try H1 as fallback
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (h1Match) {
      const h1Content = h1Match[1].replace(/<[^>]*>/g, '').trim();
      if (h1Content.length > 10 && h1Content.length < 200) {
        title = h1Content;
      }
    }

    // Extract main content - robrobinette.com specific cleanup
    let content = html;
    
    // Remove scripts, styles, navigation
    content = content
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '');

    // Remove robrobinette.com navigation sections
    content = content
      .replace(/\[\s*\[Up\][^\]]*\]/gi, '')
      .replace(/\[\s*Up\s*\]/gi, '')
      .replace(/\[\s*\[How the 5E3[\s\S]*?\]\s*\]/gi, '')
      .replace(/\[\s*\[Deluxe Models[\s\S]*?\]\s*\]/gi, '')
      .replace(/\[\s*\[DRRI[\s\S]*?\]\s*\]/gi, '');

    // Remove font tags but keep content
    content = content.replace(/<font[^>]*>([\s\S]*?)<\/font>/gi, '$1');
    
    // Remove span, div wrappers but keep content
    content = content.replace(/<span[^>]*>([\s\S]*?)<\/span>/gi, '$1');

    // Convert tables to clean format (for voltage charts)
    content = content
      .replace(/<table[^>]*>/gi, '\n\n')
      .replace(/<\/table>/gi, '\n\n')
      .replace(/<tr[^>]*>/gi, '\n')
      .replace(/<\/tr>/gi, '')
      .replace(/<th[^>]*>([\s\S]*?)<\/th>/gi, '**$1** | ')
      .replace(/<td[^>]*>([\s\S]*?)<\/td>/gi, '$1 | ');

    // Convert headers
    content = content
      .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n\n# $1\n\n')
      .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n\n## $1\n\n')
      .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n\n### $1\n\n')
      .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n\n#### $1\n\n');

    // Convert paragraphs and breaks
    content = content
      .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n\n$1\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<hr\s*\/?>/gi, '\n\n---\n\n');

    // Convert lists
    content = content
      .replace(/<ul[^>]*>/gi, '\n')
      .replace(/<\/ul>/gi, '\n')
      .replace(/<ol[^>]*>/gi, '\n')
      .replace(/<\/ol>/gi, '\n')
      .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');

    // Convert bold and italic
    content = content
      .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
      .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**')
      .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*')
      .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*');

    // Convert links - make relative links absolute
    const baseUrl = new URL(url);
    content = content.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (match, href, text) => {
      let linkUrl = href;
      if (!linkUrl.startsWith('http') && !linkUrl.startsWith('#') && !linkUrl.startsWith('mailto:')) {
        linkUrl = new URL(href, baseUrl.origin).href;
      }
      const cleanText = text.replace(/<[^>]*>/g, '').trim();
      if (!cleanText) return '';
      return `[${cleanText}](${linkUrl})`;
    });

    // Extract images with full URLs
    const images: { url: string; alt: string }[] = [];
    const imgRegex = /<img[^>]*src="([^"]*)"[^>]*>/gi;
    let imgMatch;
    while ((imgMatch = imgRegex.exec(html)) !== null) {
      let imgUrl = imgMatch[1];
      if (!imgUrl.startsWith('http')) {
        imgUrl = new URL(imgUrl, baseUrl.origin).href;
      }
      const altMatch = imgMatch[0].match(/alt="([^"]*)"/i);
      images.push({
        url: imgUrl,
        alt: altMatch ? altMatch[1] : '',
      });
    }

    // Convert images in content with full URLs
    content = content.replace(/<img[^>]*src="([^"]*)"[^>]*>/gi, (match, src) => {
      let imgUrl = src;
      if (!imgUrl.startsWith('http')) {
        imgUrl = new URL(src, baseUrl.origin).href;
      }
      const altMatch = match.match(/alt="([^"]*)"/i);
      const alt = altMatch ? altMatch[1] : 'Schematic';
      return `\n\n![${alt}](${imgUrl})\n\n`;
    });

    // Remove remaining HTML tags
    content = content.replace(/<[^>]+>/g, '');

    // Decode HTML entities
    content = content
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&rsquo;/g, "'")
      .replace(/&lsquo;/g, "'")
      .replace(/&rdquo;/g, '"')
      .replace(/&ldquo;/g, '"')
      .replace(/&mdash;/g, '—')
      .replace(/&ndash;/g, '–')
      .replace(/&hellip;/g, '...')
      .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
      .replace(/&[a-z]+;/gi, '');

    // Clean up robrobinette.com navigation links (after markdown conversion)
    content = content
      .replace(/\[\s*\[Up\]\([^\)]+\)\s*\]/gi, '')
      .replace(/\[Up\]\([^\)]+\)/gi, '')
      .replace(/\[\s*\[How the 5E3[^\]]*\]\([^\)]+\)\s*\]/gi, '')
      .replace(/\[\s*\[Deluxe Models[^\]]*\]\([^\)]+\)\s*\]/gi, '')
      .replace(/\[\s*\[DRRI[^\]]*\]\([^\)]+\)\s*\]/gi, '')
      .replace(/\[\s*\[\s*\*\s*\]\([^\)]+\)\s*\]/g, '')
      .replace(/\[\s*\*\s*\]\([^\)]+\)/g, '')
      .replace(/\[\s+\]/g, '')
      .replace(/\[\s*\]/g, '')
      .replace(/\[\s*\[\s*\]\s*\]/g, '');

    // Clean up stray formatting artifacts
    content = content
      .replace(/\*\*\s*\*\*/g, '')
      .replace(/\*\s*\*/g, '')
      .replace(/^\s*\*\s*$/gm, '')
      .replace(/^\s*\[\s*$/gm, '')
      .replace(/^\s*\]\s*$/gm, '')
      .replace(/\|\s*\|/g, '|')
      .replace(/\|\s*$/gm, '');

    // Remove lines that are just navigation
    content = content
      .replace(/^\s*\[\s*\[.*?\]\(.*?\)\s*\]\s*$/gm, '')
      .replace(/^\s*\[.*?Works.*?\]\(.*?\)\s*$/gmi, '')
      .replace(/^\s*\[.*?Models.*?\]\(.*?\)\s*$/gmi, '')
      .replace(/^\s*\[.*?Mods.*?\]\(.*?\)\s*$/gmi, '');

    // Clean up excessive whitespace
    content = content
      .replace(/[ \t]+/g, ' ')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^\s*\r?\n/gm, '\n')
      .trim();

    // Detect circuit family from content
    let circuitFamily = null;
    if (content.toLowerCase().includes('blackface') || content.includes('AB763')) {
      circuitFamily = 'Blackface';
    } else if (content.toLowerCase().includes('silverface')) {
      circuitFamily = 'Silverface';
    } else if (content.toLowerCase().includes('tweed') || content.includes('5E3') || content.includes('5F6')) {
      circuitFamily = 'Tweed';
    } else if (content.toLowerCase().includes('marshall')) {
      circuitFamily = 'Marshall';
    } else if (content.toLowerCase().includes('vox')) {
      circuitFamily = 'Vox';
    }

    // Save to database
    const [article] = await db.insert(schema.referenceArticles).values({
      title,
      sourceUrl: url,
      sourceName: 'Rob Robinette',
      content,
      images,
      circuitFamily,
    }).returning();

    res.json(article);
  } catch (error) {
    console.error('Error importing article:', error);
    res.status(500).json({ error: 'Failed to import article' });
  }
});

app.patch('/api/reference-articles/:id', async (req, res) => {
  try {
    const { title } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    const [updated] = await db.update(schema.referenceArticles)
      .set({ title })
      .where(eq(schema.referenceArticles.id, req.params.id))
      .returning();
    res.json(updated);
  } catch (error) {
    console.error('Error updating article:', error);
    res.status(500).json({ error: 'Failed to update article' });
  }
});

app.delete('/api/reference-articles/:id', async (req, res) => {
  try {
    await db.delete(schema.referenceArticles)
      .where(eq(schema.referenceArticles.id, req.params.id));
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting article:', error);
    res.status(500).json({ error: 'Failed to delete article' });
  }
});

// TAVA Podcast endpoints
app.get('/api/podcast/episodes', async (req, res) => {
  try {
    const episodes = await db.select().from(schema.podcastEpisodes).orderBy(schema.podcastEpisodes.episodeNumber);
    res.json(episodes);
  } catch (error) {
    console.error('Error fetching episodes:', error);
    res.status(500).json({ error: 'Failed to fetch episodes' });
  }
});

app.get('/api/podcast/topics', async (req, res) => {
  try {
    const topics = await db
      .select({
        id: schema.podcastTopics.id,
        topic: schema.podcastTopics.topic,
        timestamp: schema.podcastTopics.timestamp,
        timestampSeconds: schema.podcastTopics.timestampSeconds,
        circuitFamily: schema.podcastTopics.circuitFamily,
        episodeNumber: schema.podcastEpisodes.episodeNumber,
        episodeTitle: schema.podcastEpisodes.title,
        episodeUrl: schema.podcastEpisodes.sourceUrl,
      })
      .from(schema.podcastTopics)
      .leftJoin(schema.podcastEpisodes, eq(schema.podcastTopics.episodeId, schema.podcastEpisodes.id))
      .orderBy(schema.podcastEpisodes.episodeNumber);
    res.json(topics);
  } catch (error) {
    console.error('Error fetching topics:', error);
    res.status(500).json({ error: 'Failed to fetch topics' });
  }
});

app.get('/api/podcast/search', async (req, res) => {
  try {
    const query = (req.query.q as string || '').toLowerCase();
    if (!query) {
      return res.json([]);
    }
    const topics = await db
      .select({
        id: schema.podcastTopics.id,
        topic: schema.podcastTopics.topic,
        timestamp: schema.podcastTopics.timestamp,
        timestampSeconds: schema.podcastTopics.timestampSeconds,
        circuitFamily: schema.podcastTopics.circuitFamily,
        episodeNumber: schema.podcastEpisodes.episodeNumber,
        episodeTitle: schema.podcastEpisodes.title,
        episodeUrl: schema.podcastEpisodes.sourceUrl,
      })
      .from(schema.podcastTopics)
      .leftJoin(schema.podcastEpisodes, eq(schema.podcastTopics.episodeId, schema.podcastEpisodes.id))
      .where(ilike(schema.podcastTopics.topic, `%${query}%`))
      .orderBy(schema.podcastEpisodes.episodeNumber);
    res.json(topics);
  } catch (error) {
    console.error('Error searching topics:', error);
    res.status(500).json({ error: 'Failed to search topics' });
  }
});

app.post('/api/podcast/import', async (req, res) => {
  try {
    const { episodes } = req.body;
    if (!episodes || !Array.isArray(episodes)) {
      return res.status(400).json({ error: 'Episodes array is required' });
    }

    let importedCount = 0;
    for (const ep of episodes) {
      const [episode] = await db.insert(schema.podcastEpisodes).values({
        episodeNumber: ep.number,
        title: ep.title,
        sourceUrl: ep.url,
        description: ep.description || null,
      }).returning();

      if (ep.topics && Array.isArray(ep.topics)) {
        for (const topic of ep.topics) {
          await db.insert(schema.podcastTopics).values({
            episodeId: episode.id,
            topic: topic.text,
            timestamp: topic.timestamp || null,
            timestampSeconds: topic.seconds || null,
            circuitFamily: topic.circuitFamily || null,
          });
        }
      }
      importedCount++;
    }

    res.json({ success: true, imported: importedCount });
  } catch (error) {
    console.error('Error importing podcast data:', error);
    res.status(500).json({ error: 'Failed to import podcast data' });
  }
});

app.post('/api/podcast/sync', async (req, res) => {
  try {
    const indexUrl = 'https://www.fretboardjournal.com/podcasts/the-truth-about-vintage-amps-big-index-page/';
    const response = await axios.get(indexUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; 195xBenchApp/1.0)' },
      timeout: 30000,
    });

    const html = response.data;

    const existingEpisodes = await db.select({ episodeNumber: schema.podcastEpisodes.episodeNumber })
      .from(schema.podcastEpisodes);
    const existingNumbers = new Set(existingEpisodes.map(e => e.episodeNumber));

    const episodePattern = /<a[^>]+href="(https?:\/\/[^"]*fretboardjournal\.com\/podcasts\/[^"]+)"[^>]*>(?:Episode|Ep\.?)\s*(\d+)\s*<\/a>/gi;
    const episodes: { number: number; url: string; topics: { text: string; timestamp: string | null; seconds: number | null }[] }[] = [];

    let match;
    const matches: { number: number; url: string; index: number; matchLength: number }[] = [];
    while ((match = episodePattern.exec(html)) !== null) {
      matches.push({
        number: parseInt(match[2], 10),
        url: match[1],
        index: match.index,
        matchLength: match[0].length,
      });
    }

    for (let i = 0; i < matches.length; i++) {
      const ep = matches[i];
      if (existingNumbers.has(ep.number)) continue;

      const startIdx = ep.index + ep.matchLength;
      const endIdx = i + 1 < matches.length ? matches[i + 1].index : html.length;
      const section = html.substring(startIdx, endIdx);

      const cleanSection = section
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#8217;/g, "'")
        .replace(/&#8220;/g, '"')
        .replace(/&#8221;/g, '"')
        .replace(/&#8211;/g, '-')
        .replace(/&nbsp;/g, ' ');

      const topicLines = cleanSection.split('\n')
        .map((line: string) => line.trim())
        .filter((line: string) => line.startsWith('-') || /^\d+:\d+/.test(line));

      const topics: { text: string; timestamp: string | null; seconds: number | null }[] = [];
      for (const line of topicLines) {
        let text = line;
        let timestamp: string | null = null;
        let seconds: number | null = null;

        const tsMatch = line.match(/^(\d+:\d+(?::\d+)?)\s+(.+)$/);
        if (tsMatch) {
          timestamp = tsMatch[1];
          text = tsMatch[2];
          const parts = (timestamp || '').split(':').map(Number);
          if (parts.length === 3) {
            seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
          } else if (parts.length === 2) {
            seconds = parts[0] * 60 + parts[1];
          }
        } else if (line.startsWith('-')) {
          text = line.substring(1).trim();
        }

        text = text.trim();
        if (text.length > 0) {
          topics.push({ text, timestamp, seconds });
        }
      }

      if (topics.length > 0) {
        episodes.push({
          number: ep.number,
          url: ep.url,
          topics,
        });
      }
    }

    let importedCount = 0;
    for (const ep of episodes) {
      const title = `Episode ${ep.number}`;
      const [episode] = await db.insert(schema.podcastEpisodes).values({
        episodeNumber: ep.number,
        title,
        sourceUrl: ep.url,
        description: null,
      }).returning();

      for (const topic of ep.topics) {
        await db.insert(schema.podcastTopics).values({
          episodeId: episode.id,
          topic: topic.text,
          timestamp: topic.timestamp,
          timestampSeconds: topic.seconds,
          circuitFamily: null,
        });
      }
      importedCount++;
    }

    const totalEpisodes = await db.select().from(schema.podcastEpisodes);
    const totalTopics = await db.select().from(schema.podcastTopics);

    res.json({
      success: true,
      newEpisodes: importedCount,
      totalEpisodes: totalEpisodes.length,
      totalTopics: totalTopics.length,
    });
  } catch (error) {
    console.error('Error syncing podcast data:', error);
    res.status(500).json({ error: 'Failed to sync podcast data' });
  }
});

app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'dist', 'server', '(tabs)', 'index.html'));
});

  const PORT = parseInt(process.env.PORT || '5000', 10);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`195x Bench App running on port ${PORT}`);
  });
}

// Initialize the server
initServer().catch(console.error);
