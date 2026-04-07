import { Router } from 'express';
import { db, schema } from '../db';
import { eq, desc, sql, and } from 'drizzle-orm';
import { openai } from '../lib/openai';
import OpenAI from 'openai';
import { CHAT_SYSTEM_PROMPT } from '../lib/systemPrompt';
import { getRelevantDatabaseContext } from '../lib/dbContext';
import { tryDecryptSecret } from '../lib/crypto';

const router = Router();

router.get('/api/chats', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = parseInt(req.query.offset as string) || 0;
    
    const where = and(eq(schema.chats.userId, userId), eq(schema.chats.isStandalone, true));
    
    const [{ count: total }] = await db.select({ count: sql<number>`count(*)::int` })
      .from(schema.chats)
      .where(where);
    
    const chats = await db.select().from(schema.chats)
      .where(where)
      .orderBy(desc(schema.chats.updatedAt))
      .limit(limit)
      .offset(offset);
    
    res.json({ data: chats, total, hasMore: offset + chats.length < total });
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

    // Use user's custom API key if set, otherwise fall back to system key
    const [userRecord] = userId
      ? await db.select({ customApiKey: schema.users.customApiKey, tokenQuota: schema.users.tokenQuota, totalTokensUsed: schema.users.totalTokensUsed }).from(schema.users).where(eq(schema.users.id, userId))
      : [null];
    const decryptedKey = tryDecryptSecret(userRecord?.customApiKey);
    const aiClient = decryptedKey
      ? new OpenAI({ apiKey: decryptedKey })
      : openai;

    // Enforce token quota (only when using system key)
    if (!decryptedKey && userRecord?.tokenQuota != null) {
      const used = userRecord.totalTokensUsed || 0;
      if (used >= userRecord.tokenQuota) {
        return res.status(429).json({
          error: 'Token quota exceeded',
          quotaExceeded: true,
          tokensUsed: used,
          tokenQuota: userRecord.tokenQuota,
        });
      }
    }

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
    
    // Fetch only the last 30 messages directly from DB — avoids loading full history into memory
    const recentMessages = await db.select().from(schema.chatMessages)
      .where(eq(schema.chatMessages.chatId, chatId))
      .orderBy(desc(schema.chatMessages.createdAt))
      .limit(30)
      .then(msgs => msgs.reverse());
    
    let contextInfo = '';
    
    if (chat.benchJobId) {
      // Fetch job context in parallel — amp profile, recent measurements, repair actions
      const [[row], measurements, repairActions] = await Promise.all([
        db.select({ job: schema.benchJobs, amp: schema.ampProfiles })
          .from(schema.benchJobs)
          .leftJoin(schema.ampProfiles, eq(schema.benchJobs.ampProfileId, schema.ampProfiles.id))
          .where(eq(schema.benchJobs.id, chat.benchJobId)),
        db.select().from(schema.measurements)
          .where(eq(schema.measurements.benchJobId, chat.benchJobId))
          .orderBy(desc(schema.measurements.createdAt))
          .limit(20),
        db.select().from(schema.repairActions)
          .where(eq(schema.repairActions.benchJobId, chat.benchJobId))
          .orderBy(desc(schema.repairActions.createdAt))
          .limit(10),
      ]);

      if (row?.job) {
        const { job, amp } = row;
        contextInfo = `\n\nCURRENT JOB CONTEXT:`;
        contextInfo += `\nAmp: ${amp?.make || 'Unknown'} ${amp?.model || 'Unknown'} (${amp?.year || 'Unknown year'})`;
        if (amp?.circuitFamily) contextInfo += ` — Circuit: ${amp.circuitFamily}`;
        contextInfo += `\nStatus: ${job.status || 'active'}`;
        if (job.ownerSymptoms) contextInfo += `\nOwner symptoms: ${job.ownerSymptoms}`;
        if (job.knownMods) contextInfo += `\nKnown mods: ${job.knownMods}`;
        if (job.priorWork) contextInfo += `\nPrior work: ${job.priorWork}`;
        if (job.techNotes) contextInfo += `\nTech notes: ${job.techNotes}`;

        if (measurements.length > 0) {
          contextInfo += `\n\nMEASUREMENTS RECORDED (${measurements.length}):`;
          for (const m of measurements) {
            const range = (m.expectedMin != null && m.expectedMax != null)
              ? ` (expected ${m.expectedMin}–${m.expectedMax} ${m.unit || ''})`
              : '';
            const status = m.status ? ` [${m.status}]` : '';
            contextInfo += `\n- ${m.nodeName}: ${m.recordedValue != null ? `${m.recordedValue} ${m.unit || ''}` : 'not yet recorded'}${range}${status}`;
            if (m.notes) contextInfo += ` — ${m.notes}`;
          }
        }

        if (repairActions.length > 0) {
          contextInfo += `\n\nREPAIR ACTIONS LOGGED (${repairActions.length}):`;
          for (const r of repairActions) {
            contextInfo += `\n- ${r.description}`;
            if (r.partReplaced) {
              contextInfo += ` (replaced: ${r.partReplaced}`;
              if (r.partValue) contextInfo += ` ${r.partValue}`;
              if (r.partBrand) contextInfo += `, ${r.partBrand}`;
              contextInfo += `)`;
            }
            if (r.notes) contextInfo += ` — ${r.notes}`;
          }
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
    
    // ── Feature flag: Responses API vs Chat Completions ────────────────
    const useResponsesApi = process.env.USE_RESPONSES_API !== 'false';
    
    if (useResponsesApi) {
      // ═══════════════════════════════════════════════════════════════════
      // RESPONSES API PATH (with web_search)
      // ═══════════════════════════════════════════════════════════════════
      
      const buildResponsesInput = (msg: any): any => {
        const msgAttachments = msg.attachments as any[] | null;
        if (msgAttachments && msgAttachments.length > 0) {
          const contentParts: any[] = [];
          if (msg.content) {
            contentParts.push({ type: 'input_text', text: msg.content });
          }
          for (const attachment of msgAttachments) {
            if (attachment.type === 'image' && attachment.url) {
              let imageUrl = attachment.url;
              if (imageUrl.startsWith('/') && publicBaseUrl) {
                imageUrl = publicBaseUrl + imageUrl;
              }
              contentParts.push({ type: 'input_image', image_url: imageUrl });
            }
          }
          return contentParts.length > 0 ? contentParts : msg.content;
        }
        return msg.content;
      };
      
      const input: any[] = [
        { role: 'developer', content: CHAT_SYSTEM_PROMPT + contextInfo },
        ...recentMessages.slice(0, -1).map(m => ({
          role: m.role,
          content: buildResponsesInput(m)
        })),
      ];
      
      const currentMessageContent = buildResponsesInput({ content, attachments: validatedAttachments });
      input.push({ role: 'user', content: currentMessageContent });
      
      if (wantStream) {
        // ── Streaming with Responses API ────────────────────────────────
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();
        
        res.write(`data: ${JSON.stringify({ type: 'userMessage', message: userMessage })}\n\n`);

        // Initial status: tell the user what we're doing before the first token arrives
        const hasAttachments = validatedAttachments && validatedAttachments.length > 0;
        const hasJobContext = !!chat.benchJobId;
        const initialStatus = hasAttachments
          ? 'Analyzing image...'
          : hasJobContext
            ? 'Reading job context...'
            : 'Thinking...';
        res.write(`data: ${JSON.stringify({ type: 'status', status: initialStatus })}\n\n`);

        let assistantContent = '';
        let searchingNotified = false;
        let firstTokenSent = false;

        const stream = await aiClient.responses.create({
          model: 'gpt-4o',
          input,
          tools: [{ type: 'web_search' }],
          temperature: 0.7,
          max_output_tokens: 4000,
          stream: true,
        } as any);

        for await (const event of stream as any) {
          if (event.type === 'response.web_search_call.searching' && !searchingNotified) {
            res.write(`data: ${JSON.stringify({ type: 'status', status: 'Searching the web...' })}\n\n`);
            searchingNotified = true;
          } else if (event.type === 'response.web_search_call.completed' && searchingNotified) {
            res.write(`data: ${JSON.stringify({ type: 'status', status: 'Composing response...' })}\n\n`);
          } else if (event.type === 'response.output_text.delta') {
            const token = event.delta;
            if (token) {
              if (!firstTokenSent) {
                // Clear the status indicator once text starts flowing
                res.write(`data: ${JSON.stringify({ type: 'status', status: '' })}\n\n`);
                firstTokenSent = true;
              }
              assistantContent += token;
              res.write(`data: ${JSON.stringify({ type: 'token', token })}\n\n`);
            }
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
        
        if (userId) {
          const estimatedTokens = Math.ceil((content.length + assistantContent.length) / 4);
          await db.execute(sql`UPDATE users SET total_tokens_used = COALESCE(total_tokens_used, 0) + ${estimatedTokens} WHERE id = ${userId}`);
        }
        
        res.write(`data: ${JSON.stringify({ type: 'done', message: assistantMessage })}\n\n`);
        res.end();
        
      } else {
        // ── Non-streaming with Responses API ────────────────────────────
        const response = await aiClient.responses.create({
          model: 'gpt-4o',
          input,
          tools: [{ type: 'web_search' }],
          temperature: 0.7,
          max_output_tokens: 4000,
        } as any);
        
        const assistantContent = (response as any).output_text || 'I apologize, but I could not generate a response. Please try again.';

        if (userId) {
          const estimatedTokens = Math.ceil((content.length + assistantContent.length) / 4);
          await db.execute(sql`UPDATE users SET total_tokens_used = COALESCE(total_tokens_used, 0) + ${estimatedTokens} WHERE id = ${userId}`);
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
      }
      
    } else {
      // ═══════════════════════════════════════════════════════════════════
      // LEGACY CHAT COMPLETIONS PATH (fallback — set USE_RESPONSES_API=false)
      // ═══════════════════════════════════════════════════════════════════
      
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
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();
        
        res.write(`data: ${JSON.stringify({ type: 'userMessage', message: userMessage })}\n\n`);
        
        let assistantContent = '';
        
        const stream = await aiClient.chat.completions.create({
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
        
        if (userId) {
          const estimatedTokens = Math.ceil((content.length + assistantContent.length) / 4);
          await db.execute(sql`UPDATE users SET total_tokens_used = COALESCE(total_tokens_used, 0) + ${estimatedTokens} WHERE id = ${userId}`);
        }
        
        res.write(`data: ${JSON.stringify({ type: 'done', message: assistantMessage })}\n\n`);
        res.end();
        
      } else {
        const completion = await aiClient.chat.completions.create({
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
      model: chat.title || '',
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
