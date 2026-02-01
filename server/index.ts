import express from 'express';
import cors from 'cors';
import path from 'path';
import { db, schema } from './db';
import { eq, desc, ilike, or } from 'drizzle-orm';
import OpenAI from 'openai';
import { registerObjectStorageRoutes } from './replit_integrations/object_storage';

const app = express();
app.use(cors());
app.use(express.json());

registerObjectStorageRoutes(app);

app.use(express.static(path.join(__dirname, '..', 'dist', 'client')));
app.use(express.static(path.join(__dirname, '..', 'dist', 'server')));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `You are a senior guitar amplifier technician and bench mentor for the 195x Bench App. Your role is to guide technicians step-by-step through troubleshooting, servicing, and validating guitar amplifiers (vintage and modern), including blackface/silverface Fender-style circuits and beyond.

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
  res.json({ status: 'ok', message: '195x Bench App API running' });
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

app.delete('/api/schematics/:id', async (req, res) => {
  try {
    const schematicId = req.params.id;
    
    const [schematic] = await db.select().from(schema.schematics).where(eq(schema.schematics.id, schematicId));
    if (!schematic) {
      return res.status(404).json({ error: 'Schematic not found' });
    }
    
    await db.delete(schema.schematics).where(eq(schema.schematics.id, schematicId));
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting schematic:', error);
    res.status(500).json({ error: 'Failed to delete schematic' });
  }
});

const CHAT_SYSTEM_PROMPT = `You are a senior guitar amplifier technician and bench mentor for the 195x Bench App with 30+ years of experience. You help technicians with troubleshooting, servicing, and validating guitar amplifiers.

CAPABILITIES:
1. **EXPERT AMP IDENTIFICATION FROM IMAGES**: When shown photos of amp chassis, gut shots, or components, you MUST provide confident, detailed identification. Analyze:
   - Circuit topology and layout (turret board, eyelet board, PCB)
   - Transformer placement and size
   - Power tube configuration
   - Filter cap arrangement
   - Control layout and knob positions
   - Date codes on components when visible
   - Identify the specific circuit family (AB763, AA764, 5E3, JTM45, etc.)
   - Estimate production year based on visible evidence
   
2. Answer general amp repair questions using your extensive expertise
3. Reference the user's database when they ask about past jobs, schematics, or history
4. Provide safety guidance for high-voltage work

WHEN ANALYZING IMAGES:
- Be confident and specific. You ARE able to identify amps from chassis photos.
- Look for telltale signs: transformer locations, tube layout, circuit board style, component spacing
- Identify the make, model, circuit family, and approximate year
- Point out specific visual evidence that led to your identification
- Note any modifications or non-original components you observe
- If multiple models are possible, explain the distinguishing features

CRITICAL SAFETY RULES:
- Always emphasize safety for high voltage procedures
- Remind about one-hand rule for HV measurements
- Include warnings about lethal voltages in tube amps

When the user asks about their past work or database, I will provide you with relevant data from their records.

Be helpful, detailed, and safety-conscious. Format responses clearly with headers and bullet points when appropriate.`;

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
    
    const ampKeywords = ['fender', 'marshall', 'vox', 'mesa', 'boogie', 'twin', 'deluxe', 'princeton', 'bassman', 'ac30', 'ac15', 'jcm', 'plexi'];
    const foundKeyword = ampKeywords.find(kw => lowerMessage.includes(kw));
    
    if (foundKeyword) {
      const jobs = await db.select({
        job: schema.benchJobs,
        amp: schema.ampProfiles
      }).from(schema.benchJobs)
        .leftJoin(schema.ampProfiles, eq(schema.benchJobs.ampProfileId, schema.ampProfiles.id));
      
      const matchingJobs = jobs.filter(({ amp }) => 
        amp?.make?.toLowerCase().includes(foundKeyword) || 
        amp?.model?.toLowerCase().includes(foundKeyword)
      );
      
      if (matchingJobs.length > 0) {
        context += `\n\nJOBS MATCHING "${foundKeyword.toUpperCase()}":\n`;
        matchingJobs.forEach(({ job, amp }) => {
          context += `- ${amp?.make} ${amp?.model} (${amp?.year || 'Unknown year'}) - ${job.status}\n`;
        });
      }
      
      const matchingSchematics = await db.select().from(schema.schematics);
      const filtered = matchingSchematics.filter(s => 
        s.name?.toLowerCase().includes(foundKeyword) ||
        s.ampModel?.toLowerCase().includes(foundKeyword)
      );
      
      if (filtered.length > 0) {
        context += `\n\nSCHEMATICS MATCHING "${foundKeyword.toUpperCase()}":\n`;
        filtered.forEach(s => {
          context += `- ${s.name} (${s.circuitFamily || 'Unknown family'})\n`;
        });
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
      max_tokens: 2000,
    });
    
    const assistantContent = completion.choices[0].message.content || 'I apologize, but I could not generate a response.';
    
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

app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'dist', 'server', '(tabs)', 'index.html'));
});

const PORT = parseInt(process.env.PORT || '5000', 10);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`195x Bench App running on port ${PORT}`);
});
