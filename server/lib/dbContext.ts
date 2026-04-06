import { db, schema } from '../db';
import { eq, desc, ilike, or } from 'drizzle-orm';

// Maximum characters of article content to inject per article
const MAX_ARTICLE_CHARS = 2000;
// Maximum total articles to inject
const MAX_ARTICLES = 3;

/**
 * Search reference articles for content relevant to the user's message.
 * Returns a context string with article excerpts, or null if nothing found.
 */
/**
 * Normalize a string for fuzzy keyword matching:
 * - lowercase
 * - collapse dashes/spaces between alphanumeric chars (AC-30 → ac30, filter cap → filtercap)
 */
function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/[-\s]+/g, '');
}

/**
 * Check if a keyword appears in a message, handling:
 * - punctuation variants (AC-30 vs AC30 vs AC 30)
 * - simple plurals (cap → caps, tube → tubes)
 */
function keywordMatches(kw: string, normalizedMessage: string, originalMessage: string): boolean {
  const normKw = normalizeForMatch(kw);
  if (normalizedMessage.includes(normKw)) return true;
  // Also check plural form in original lowercased message
  if (originalMessage.includes(kw + 's') || originalMessage.includes(kw + 'es')) return true;
  return false;
}

async function getRelevantArticleContext(message: string): Promise<string | null> {
  const lowerMessage = message.toLowerCase();
  const normalizedMessage = normalizeForMatch(lowerMessage);

  // Extract meaningful keywords for article search
  const ampKeywords = ['fender', 'marshall', 'vox', 'mesa', 'boogie', 'twin', 'deluxe', 'princeton', 'bassman', 'ac30', 'ac15', 'jcm', 'plexi', 'champ', 'super', 'reverb', 'tremolux', 'bandmaster', 'showman', 'vibroverb', 'vibrolux'];
  const circuitKeywords = ['5f1', '5e3', '5f6', '5e1', '5c1', 'aa763', 'ab763', 'aa864', 'ab568', 'bf', 'sf', 'tweed', 'blackface', 'silverface', 'brownface'];
  const topicKeywords = ['bias', 'recap', 'filter cap', 'coupling cap', 'cathode', 'plate voltage', 'screen voltage', 'power tube', 'preamp tube', 'rectifier', 'transformer', 'output transformer', 'choke', 'reverb', 'tremolo', 'negative feedback', 'grounding', 'hum', 'noise', 'oscillation', 'motorboating', 'red plate', 'crossover', 'distortion', 'mod', 'modification', 'speaker', 'impedance', 'standby', 'death cap', 'safety'];

  const allKeywords = [...ampKeywords, ...circuitKeywords, ...topicKeywords];
  const foundKeywords = allKeywords.filter(kw => keywordMatches(kw, normalizedMessage, lowerMessage));

  if (foundKeywords.length === 0) return null;

  try {
    // Search articles by keyword matches in title, content, circuit family, and tags
    const searchConditions = foundKeywords.slice(0, 5).map(kw => {
      const term = `%${kw}%`;
      return or(
        ilike(schema.referenceArticles.title, term),
        ilike(schema.referenceArticles.content, term),
        ilike(schema.referenceArticles.circuitFamily, term),
        ilike(schema.referenceArticles.tags, term)
      );
    });

    const articles = await db.select({
      id: schema.referenceArticles.id,
      title: schema.referenceArticles.title,
      content: schema.referenceArticles.content,
      sourceUrl: schema.referenceArticles.sourceUrl,
      circuitFamily: schema.referenceArticles.circuitFamily,
    }).from(schema.referenceArticles)
      .where(or(...searchConditions))
      .limit(MAX_ARTICLES * 2); // Fetch extra, then rank

    if (articles.length === 0) return null;

    // Score articles by keyword hit count for basic ranking
    const scored = articles.map(article => {
      const combined = `${article.title} ${article.content}`.toLowerCase();
      const score = foundKeywords.reduce((s, kw) => s + (combined.includes(kw) ? 1 : 0), 0);
      return { ...article, score };
    }).sort((a, b) => b.score - a.score).slice(0, MAX_ARTICLES);

    let context = '\n\nREFERENCE ARTICLE CONTEXT (from the app\'s imported reference library):';
    for (const article of scored) {
      // Extract the most relevant section of the article content
      const excerpt = extractRelevantExcerpt(article.content, foundKeywords, MAX_ARTICLE_CHARS);
      context += `\n\n--- ARTICLE: "${article.title}" (${article.sourceUrl}) ---\n${excerpt}`;
    }
    context += '\n\nWhen relevant, reference these articles by name and tell the user they have them in their reference library.';

    return context;
  } catch (error) {
    console.error('Error fetching article context:', error);
    return null;
  }
}

/**
 * Extract the most relevant excerpt from article content around keyword matches.
 */
function extractRelevantExcerpt(content: string, keywords: string[], maxChars: number): string {
  if (content.length <= maxChars) return content;

  const lowerContent = content.toLowerCase();

  // Find the position of the first keyword match
  let bestPos = 0;
  let bestScore = 0;

  // Slide a window across the content and find the highest-density region
  const windowSize = maxChars;
  const step = Math.floor(maxChars / 4);
  for (let i = 0; i < content.length - windowSize; i += step) {
    const window = lowerContent.substring(i, i + windowSize);
    const score = keywords.reduce((s, kw) => {
      const idx = window.indexOf(kw);
      return s + (idx >= 0 ? 1 : 0);
    }, 0);
    if (score > bestScore) {
      bestScore = score;
      bestPos = i;
    }
  }

  // Snap to paragraph boundary
  const start = content.lastIndexOf('\n', bestPos) + 1;
  let excerpt = content.substring(start, start + maxChars);

  // Trim to last complete sentence or paragraph
  const lastPeriod = excerpt.lastIndexOf('.');
  const lastNewline = excerpt.lastIndexOf('\n');
  const cutPoint = Math.max(lastPeriod, lastNewline);
  if (cutPoint > maxChars * 0.5) {
    excerpt = excerpt.substring(0, cutPoint + 1);
  }

  return (start > 0 ? '...' : '') + excerpt.trim() + (start + maxChars < content.length ? '...' : '');
}

export async function getRelevantDatabaseContext(message: string, userId?: string): Promise<string | null> {
  const lowerMessage = message.toLowerCase();
  const normalizedMessage = normalizeForMatch(lowerMessage);
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

  if (!isDbQuery) {
    // Even if not a db query, still check for article RAG
    const articleContext = await getRelevantArticleContext(message);
    return articleContext || null;
  }

  try {
    // Extract amp/circuit keywords from message
    const ampKeywords = ['fender', 'marshall', 'vox', 'mesa', 'boogie', 'twin', 'deluxe', 'princeton', 'bassman', 'ac30', 'ac15', 'jcm', 'plexi', 'champ', 'super', 'reverb', 'tremolux', 'bandmaster', 'showman', 'vibroverb', 'vibrolux'];
    const circuitKeywords = ['5f1', '5e3', '5f6', '5e1', '5c1', 'aa763', 'ab763', 'aa864', 'ab568', 'bf', 'sf', 'tweed', 'blackface', 'silverface', 'brownface'];
    const allKeywords = [...ampKeywords, ...circuitKeywords];
    const foundKeywords = allKeywords.filter(kw => keywordMatches(kw, normalizedMessage, lowerMessage));
    
    // If specific keywords found, do targeted search
    if (foundKeywords.length > 0) {
      const searchConditions = foundKeywords.map(kw => {
        const term = `%${kw}%`;
        return or(
          ilike(schema.ampProfiles.make, term),
          ilike(schema.ampProfiles.model, term),
          ilike(schema.ampProfiles.circuitFamily, term)
        );
      });
      
      const jobs = await db.select({
        job: schema.benchJobs,
        amp: schema.ampProfiles
      }).from(schema.benchJobs)
        .leftJoin(schema.ampProfiles, eq(schema.benchJobs.ampProfileId, schema.ampProfiles.id))
        .where(userId ? eq(schema.benchJobs.userId, userId) : undefined as any)
        .orderBy(desc(schema.benchJobs.createdAt))
        .limit(20);
      
      const matchingJobs = jobs.filter(({ amp }) => 
        foundKeywords.some(kw => 
          amp?.make?.toLowerCase().includes(kw) || 
          amp?.model?.toLowerCase().includes(kw) ||
          amp?.circuitFamily?.toLowerCase().includes(kw)
        )
      );
      
      if (matchingJobs.length > 0) {
        context += `\n\nMATCHING JOBS (${matchingJobs.length}):\n`;
        matchingJobs.forEach(({ job, amp }) => {
          context += `- ${amp?.make || 'Unknown'} ${amp?.model || 'Unknown'} (${amp?.year || 'Unknown year'}) - ${job.status}\n`;
          if (job.ownerSymptoms) context += `  Symptoms: ${job.ownerSymptoms}\n`;
        });
      }
      
      // Search schematics by keyword using SQL
      for (const kw of foundKeywords.slice(0, 3)) {
        const term = `%${kw}%`;
        const matchingSchematics = await db.select().from(schema.schematics)
          .where(or(
            ilike(schema.schematics.name, term),
            ilike(schema.schematics.ampModel, term),
            ilike(schema.schematics.circuitFamily, term),
            ilike(schema.schematics.tags, term)
          ))
          .limit(10);
        
        if (matchingSchematics.length > 0) {
          context += `\n\nSCHEMATICS MATCHING "${kw.toUpperCase()}":\n`;
          matchingSchematics.forEach(s => {
            context += `- ${s.name} (${s.circuitFamily || 'Unknown family'}) - File: ${s.fileUrl ? 'Available in library' : 'No file'}\n`;
          });
        }
      }
    } else {
      // General query — return recent jobs summary (limited)
      if (lowerMessage.includes('job') || lowerMessage.includes('worked on') || lowerMessage.includes('have i') || lowerMessage.includes('past') || lowerMessage.includes('history')) {
        const jobs = await db.select({
          job: schema.benchJobs,
          amp: schema.ampProfiles
        }).from(schema.benchJobs)
          .leftJoin(schema.ampProfiles, eq(schema.benchJobs.ampProfileId, schema.ampProfiles.id))
          .where(userId ? eq(schema.benchJobs.userId, userId) : undefined as any)
          .orderBy(desc(schema.benchJobs.createdAt))
          .limit(15);
        
        if (jobs.length > 0) {
          context += `\n\nRECENT BENCH JOBS (${jobs.length}):\n`;
          jobs.forEach(({ job, amp }) => {
            context += `- ${amp?.make || 'Unknown'} ${amp?.model || 'Unknown'} (${amp?.year || 'Unknown year'}) - Status: ${job.status}\n`;
            if (job.ownerSymptoms) context += `  Symptoms: ${job.ownerSymptoms}\n`;
          });
        }
      }
      
      if (lowerMessage.includes('schematic') || lowerMessage.includes('circuit')) {
        const schematics = await db.select().from(schema.schematics).limit(20);
        if (schematics.length > 0) {
          context += `\n\nSCHEMATICS IN DATABASE (${schematics.length}):\n`;
          schematics.forEach(s => {
            context += `- ${s.name} (${s.ampModel || 'Unknown model'}, ${s.circuitFamily || 'Unknown family'})\n`;
          });
        }
      }
    }
    
    // Always attempt article RAG regardless of whether db context was found
    const articleContext = await getRelevantArticleContext(message);
    if (articleContext) {
      context += articleContext;
    }
    
    return context || null;
  } catch (error) {
    console.error('Error getting database context:', error);
    return null;
  }
}
