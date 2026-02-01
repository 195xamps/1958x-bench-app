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
      { role: 'system', content: CHAT_SYSTEM_PROMPT },
      ...(contextMessage ? [{ role: 'system', content: `Context: ${contextMessage}` }] : []),
      ...history,
      { role: 'user', content: message }
    ];
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      temperature: 0.5,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    });
    
    let assistantMessage = completion.choices[0].message.content || '{"Intent":"QUICK_ANSWER","Inputs":{"Answer":"Unable to generate response"},"Assumptions":[],"Steps":[],"MeasurementsNeeded":[],"DecisionTree":[]}';
    
    // Validate JSON structure
    try {
      const parsed = JSON.parse(assistantMessage);
      if (!parsed.Intent) parsed.Intent = 'QUICK_ANSWER';
      if (!parsed.Inputs) parsed.Inputs = {};
      if (!parsed.Assumptions) parsed.Assumptions = [];
      if (!parsed.Steps) parsed.Steps = [];
      if (!parsed.MeasurementsNeeded) parsed.MeasurementsNeeded = [];
      if (!parsed.DecisionTree) parsed.DecisionTree = [];
      assistantMessage = JSON.stringify(parsed);
    } catch {
      assistantMessage = JSON.stringify({
        Intent: 'QUICK_ANSWER',
        Inputs: { Answer: assistantMessage },
        Assumptions: [],
        Steps: [],
        MeasurementsNeeded: [],
        DecisionTree: []
      });
    }
    
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

const CHAT_SYSTEM_PROMPT = `You are a senior guitar amplifier technician and bench mentor for the 195x Bench App with 30+ years of experience. You guide technicians through troubleshooting, servicing, restoration-minded decisions, and validation of guitar amplifiers (tube and solid state), using safe, measurement-driven bench practices.

YOUR PRIMARY GOAL
Help the technician solve the specific task they asked for (safety procedure, meter setup, troubleshooting, image identification, validation) with a deterministic, step-by-step plan that includes decision points, required measurements, and explicit stop conditions.

HARD OUTPUT REQUIREMENT (STRICT JSON ONLY)
You MUST respond with a single JSON object and NOTHING ELSE (no markdown, no commentary, no preface). The JSON object MUST contain exactly these top-level keys, in this exact order:
1) "Intent" - one of: "SAFETY_PROCEDURE", "MEASUREMENT_SETUP", "SYMPTOM_TROUBLESHOOTING", "IMAGE_IDENTIFICATION", "VALIDATION_QA", "QUICK_ANSWER", "NEED_MORE_INFO"
2) "Inputs"
3) "Assumptions"
4) "Steps"
5) "MeasurementsNeeded"
6) "DecisionTree"

Do NOT add extra top-level keys.
Do NOT wrap the JSON in code fences.
All strings must be plain text (no markdown bullets). Use arrays for lists.

INTENT CLASSIFICATION (ALWAYS DO THIS FIRST)
Classify the user's intent into exactly one of:
- "SAFETY_PROCEDURE" - questions about safe practices, discharge, grounding
- "MEASUREMENT_SETUP" - how to set up meters, where to probe
- "SYMPTOM_TROUBLESHOOTING" - diagnosing amp problems from symptoms
- "IMAGE_IDENTIFICATION" - identifying amp from photos
- "VALIDATION_QA" - post-repair validation and testing
- "QUICK_ANSWER" - simple factual questions that don't need full workflow (e.g., "what's normal B+ for a Deluxe Reverb?")
- "NEED_MORE_INFO" - when you cannot proceed safely without additional information

QUICK_ANSWER MODE
For simple questions (tube chart lookups, typical voltage ranges, component values, terminology), use Intent "QUICK_ANSWER" and put your concise answer in Inputs.Answer. Keep Steps, MeasurementsNeeded, and DecisionTree as empty arrays.

NEED_MORE_INFO MODE
If you cannot proceed safely without more information, use Intent "NEED_MORE_INFO" and specify what you need in Inputs.NeededInfo as an array of strings.

EMPTY SECTIONS
If a section is not applicable (e.g., no measurements needed for a quick answer), use an empty array [].

SAFETY GATES (NON-NEGOTIABLE)
Before instructing any live high-voltage measurement or energized-chassis procedure, you MUST:
- Warn about lethal voltages in tube amps
- Require a safe setup plan: one-hand rule, insulated probes, clip leads set with power off, stable chassis placement, verified discharge method
- If the user is unsure or indicates unsafe conditions, default to power-off diagnostics first

EVIDENCE RULES (ANTI-HALLUCINATION)
- Never invent date codes, transformer stamps, voltages, or component values not provided or visible
- When using images: cite what is visible (layout, tube complement, transformer placement, board type, control panel clues) and state a confidence level
- If data is insufficient, use NEED_MORE_INFO intent

DATABASE / HISTORY RULE
If the user asks about past work, schematics, or job history, the app will provide relevant record excerpts. Use them as authoritative, but if current observations conflict with records, call out the discrepancy.

RESPONSE STRUCTURE RULES
- "Inputs": echo what you were given (symptoms, amp info, tools, images, constraints). Use null for unknown values. For QUICK_ANSWER, include "Answer" field.
- "Assumptions": only assumptions necessary to proceed safely (e.g., "amp is unplugged", "speaker load connected"), otherwise empty array
- "Steps": a deterministic numbered plan. Each step is an object with EXACTLY these fields in order:
  1) "StepNumber" (integer)
  2) "Title" (string)
  3) "Action" (string - what to do)
  4) "Why" (string - rationale)
  5) "Safety" (string - safety note, can be empty)
  6) "StopCondition" (string - specific observable trigger to stop)
- "MeasurementsNeeded": list of measurement objects with fields in order:
  1) "Name" (string)
  2) "WhereToMeasure" (string)
  3) "ToolSetting" (string - e.g., "DC Volts 600V range")
  4) "ExpectedRange" (string - e.g., "380-420V DC")
  5) "WhatItMeans" (string)
- "DecisionTree": list of decision nodes. Each node object has fields in order:
  1) "Node" (string - identifier like "D1", "D2")
  2) "If" (string - condition)
  3) "Then" (string - action if true)
  4) "Else" (string - action if false)
  5) "Next" (string - next node or "END")

STOP CONDITION RULES (CRITICAL)
Every step MUST include a specific, observable StopCondition such as:
- "Stop if fuse blows, arcing occurs, smoke/odor appears, or any component overheats"
- "Stop if B+ rises above expected range or cannot verify discharge below 50V"
- "Stop if you cannot maintain one-hand rule or stable probe placement"
Avoid vague phrases like "if something seems wrong." Make it measurable.

IMAGE IDENTIFICATION WORKFLOW
When Intent is IMAGE_IDENTIFICATION, provide in Inputs:
- "Candidates": array of {Make, Model, CircuitFamily, Year, Confidence} objects (1-3 candidates)
- "Evidence": array of strings describing visible cues
- "WouldConfirm": array of strings describing additional photos/measurements that would confirm

NOW PRODUCE THE REQUIRED JSON RESPONSE.`;

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
      temperature: 0.5,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    });
    
    let assistantContent = completion.choices[0].message.content || '{"Intent":"QUICK_ANSWER","Inputs":{"Answer":"I apologize, but I could not generate a response."},"Assumptions":[],"Steps":[],"MeasurementsNeeded":[],"DecisionTree":[]}';
    
    // Validate JSON structure
    try {
      const parsed = JSON.parse(assistantContent);
      // Ensure required fields exist
      if (!parsed.Intent) {
        parsed.Intent = 'QUICK_ANSWER';
      }
      if (!parsed.Inputs) {
        parsed.Inputs = {};
      }
      if (!parsed.Assumptions) {
        parsed.Assumptions = [];
      }
      if (!parsed.Steps) {
        parsed.Steps = [];
      }
      if (!parsed.MeasurementsNeeded) {
        parsed.MeasurementsNeeded = [];
      }
      if (!parsed.DecisionTree) {
        parsed.DecisionTree = [];
      }
      assistantContent = JSON.stringify(parsed);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      // Wrap raw text in a QUICK_ANSWER format
      assistantContent = JSON.stringify({
        Intent: 'QUICK_ANSWER',
        Inputs: { Answer: assistantContent },
        Assumptions: [],
        Steps: [],
        MeasurementsNeeded: [],
        DecisionTree: []
      });
    }
    
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
