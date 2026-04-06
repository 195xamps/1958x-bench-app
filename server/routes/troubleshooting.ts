import { Router } from 'express';
import { db, schema } from '../db';
import { eq, sql } from 'drizzle-orm';
import { openai } from '../lib/openai';
import { CHAT_SYSTEM_PROMPT } from '../lib/systemPrompt';

const router = Router();

router.post('/api/troubleshooting/start', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    const isAdmin = req.user?.isAdmin;
    const { benchJobId, mode = 'guided' } = req.body;
    
    // If a benchJobId is provided, verify ownership and safety checklist
    if (benchJobId) {
      const [benchJob] = await db.select().from(schema.benchJobs).where(eq(schema.benchJobs.id, benchJobId));
      if (!benchJob) {
        return res.status(404).json({ error: 'Bench job not found' });
      }
      if (benchJob.userId !== userId && !isAdmin) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      if (!benchJob.safetyChecklistCompleted) {
        return res.status(403).json({ 
          error: 'Safety checklist must be completed before starting troubleshooting',
          safetyRequired: true
        });
      }
    }
    
    const [session] = await db.insert(schema.troubleshootingSessions).values({
      benchJobId: benchJobId || null,
      mode,
      aiConversationHistory: [],
    }).returning();
    
    res.json(session);
  } catch (error) {
    console.error('Error starting troubleshooting session:', error);
    res.status(500).json({ error: 'Failed to start troubleshooting session' });
  }
});

router.post('/api/troubleshooting/chat', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    const isAdmin = req.user?.isAdmin;
    const { sessionId, message, benchJobContext } = req.body;
    
    const [session] = await db.select().from(schema.troubleshootingSessions).where(eq(schema.troubleshootingSessions.id, sessionId));
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    if (session.benchJobId) {
      const [benchJob] = await db.select().from(schema.benchJobs).where(eq(schema.benchJobs.id, session.benchJobId));
      if (benchJob && benchJob.userId !== userId && !isAdmin) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }
    
    const history = (session.aiConversationHistory as any[]) || [];

    const contextMessage = benchJobContext
      ? `Current amp: ${benchJobContext.make || 'Unknown'} ${benchJobContext.model || 'Unknown'} (${benchJobContext.year || 'Unknown year'}). Owner symptoms: ${benchJobContext.ownerSymptoms || 'None provided'}. Known mods: ${benchJobContext.knownMods || 'None'}. Prior work: ${benchJobContext.priorWork || 'None'}.`
      : '';

    const modeInstruction = session.mode === 'expert'
      ? '\n\nEXPERT MODE: The technician is experienced. Be direct and technical. Skip basic explanations and hand-holding. Lead with the most likely diagnosis and specific test points. Use component-level language (grid, cathode, plate, B+). Assume they know safety procedures.'
      : '\n\nGUIDED MODE: Walk the technician through the diagnosis step by step. Ask one clarifying question at a time before proceeding. Explain your reasoning at each step. Include expected measurements and what each result means. Be methodical — do not jump ahead. Check for understanding before moving to the next step.';

    const messages: any[] = [
      { role: 'system', content: CHAT_SYSTEM_PROMPT + modeInstruction },
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
    
    const tokensUsed = completion.usage?.total_tokens || 0;
    if (userId && tokensUsed > 0) {
      await db.execute(sql`UPDATE users SET total_tokens_used = COALESCE(total_tokens_used, 0) + ${tokensUsed} WHERE id = ${userId}`);
    }
    
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

export default router;
