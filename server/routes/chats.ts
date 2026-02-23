import { Router } from 'express';
import { db, schema } from '../db';
import { eq, desc, sql, and } from 'drizzle-orm';
import { openai } from '../lib/openai';
import { CHAT_SYSTEM_PROMPT } from '../lib/systemPrompt';
import { getRelevantDatabaseContext } from '../lib/dbContext';

const router = Router();

router.get('/api/chats', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const allChats = await db.select().from(schema.chats)
      .where(and(eq(schema.chats.userId, userId), eq(schema.chats.isStandalone, true)))
      .orderBy(desc(schema.chats.updatedAt));
    res.json(allChats);
  } catch (error) {
    console.error('Error fetching chats:', error);
    res.status(500).json({ error: 'Failed to fetch chats' });
  }
});

router.post('/api/chats', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { title, benchJobId } = req.body;
    
    const [chat] = await db.insert(schema.chats).values({
      userId,
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

router.get('/api/chats/:id', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    const isAdmin = req.user?.isAdmin;
    
    const [chat] = await db.select().from(schema.chats).where(eq(schema.chats.id, req.params.id));
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    if (chat.userId !== userId && !isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
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

router.patch('/api/chats/:id', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    const isAdmin = req.user?.isAdmin;
    
    const [chat] = await db.select().from(schema.chats).where(eq(schema.chats.id, req.params.id));
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    if (chat.userId !== userId && !isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const { title } = req.body;
    const [updated] = await db.update(schema.chats)
      .set({ title, updatedAt: new Date() })
      .where(eq(schema.chats.id, req.params.id))
      .returning();
    
    res.json(updated);
  } catch (error) {
    console.error('Error updating chat:', error);
    res.status(500).json({ error: 'Failed to update chat' });
  }
});

router.delete('/api/chats/:id', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    const isAdmin = req.user?.isAdmin;
    
    const [chat] = await db.select().from(schema.chats).where(eq(schema.chats.id, req.params.id));
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    if (chat.userId !== userId && !isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    await db.delete(schema.chatMessages).where(eq(schema.chatMessages.chatId, req.params.id));
    await db.delete(schema.chats).where(eq(schema.chats.id, req.params.id));
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting chat:', error);
    res.status(500).json({ error: 'Failed to delete chat' });
  }
});

router.post('/api/chats/:id/messages', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    const isAdmin = req.user?.isAdmin;
    const { content, attachments } = req.body;
    const chatId = req.params.id;
    const wantStream = req.query.stream === 'true';
    
    const [chat] = await db.select().from(schema.chats).where(eq(schema.chats.id, chatId));
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    if (chat.userId !== userId && !isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
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
    
    // Truncate to last 30 messages to control token usage and latency
    const recentMessages = previousMessages.slice(-30);
    
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
    
    const dbContext = await getRelevantDatabaseContext(content, userId);
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
      ...recentMessages.slice(0, -1).map(m => ({
        role: m.role,
        content: buildMessageContent(m)
      })),
    ];
    
    const currentMessageContent = buildMessageContent({ content, attachments: validatedAttachments });
    messages.push({ role: 'user', content: currentMessageContent });
    
    if (wantStream) {
      // ── Streaming response ──────────────────────────────────────────
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();
      
      // Send user message immediately so client can display it
      res.write(`data: ${JSON.stringify({ type: 'userMessage', message: userMessage })}\n\n`);
      
      let assistantContent = '';
      
      const stream = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        temperature: 0.7,
        max_tokens: 4000,
        stream: true,
      });
      
      for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta?.content;
        if (token) {
          assistantContent += token;
          res.write(`data: ${JSON.stringify({ type: 'token', token })}\n\n`);
        }
      }
      
      if (!assistantContent) {
        assistantContent = 'I apologize, but I could not generate a response. Please try again.';
      }
      
      const [assistantMessage] = await db.insert(schema.chatMessages).values({
        chatId,
        role: 'assistant',
        content: assistantContent,
      }).returning();
      
      await db.update(schema.chats)
        .set({ updatedAt: new Date() })
        .where(eq(schema.chats.id, chatId));
      
      // Token tracking (no usage info in streaming mode, estimate from content)
      if (userId) {
        const estimatedTokens = Math.ceil((content.length + assistantContent.length) / 4);
        await db.execute(sql`UPDATE users SET total_tokens_used = COALESCE(total_tokens_used, 0) + ${estimatedTokens} WHERE id = ${userId}`);
      }
      
      res.write(`data: ${JSON.stringify({ type: 'done', message: assistantMessage })}\n\n`);
      res.end();
      
    } else {
      // ── Non-streaming response (backward compatible) ────────────────
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
    }
  } catch (error) {
    console.error('Error sending message:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to send message' });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Failed to generate response' })}\n\n`);
      res.end();
    }
  }
});

router.post('/api/chats/:id/convert-to-job', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    const isAdmin = req.user?.isAdmin;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const chatId = req.params.id;
    
    const [chat] = await db.select().from(schema.chats).where(eq(schema.chats.id, chatId));
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    if (chat.userId !== userId && !isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    if (chat.benchJobId) {
      return res.status(400).json({ error: 'Chat is already linked to a job' });
    }
    
    const [ampProfile] = await db.insert(schema.ampProfiles).values({
      make: '',
      model: '',
    }).returning();
    
    const [benchJob] = await db.insert(schema.benchJobs).values({
      userId,
      ampProfileId: ampProfile.id,
      techNotes: `Converted from chat: ${chat.title}`,
    }).returning();
    
    const [jobChat] = await db.insert(schema.chats).values({
      userId,
      benchJobId: benchJob.id,
      title: chat.title,
      isStandalone: false,
    }).returning();
    
    await db.update(schema.chatMessages)
      .set({ chatId: jobChat.id })
      .where(eq(schema.chatMessages.chatId, chatId));
    
    await db.delete(schema.chats).where(eq(schema.chats.id, chatId));
    
    res.json({ benchJob, ampProfile, deletedChatId: chatId, jobChat });
  } catch (error) {
    console.error('Error converting chat to job:', error);
    res.status(500).json({ error: 'Failed to convert chat to job' });
  }
});

export default router;
