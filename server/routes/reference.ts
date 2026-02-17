import { Router } from 'express';
import { db, schema } from '../db';
import { eq, ilike, or, desc, sql } from 'drizzle-orm';
import axios from 'axios';

const router = Router();

router.get('/api/reference-articles', async (req, res) => {
  try {
    const articles = await db.select().from(schema.referenceArticles)
      .orderBy(desc(schema.referenceArticles.createdAt));
    res.json(articles);
  } catch (error) {
    console.error('Error fetching reference articles:', error);
    res.status(500).json({ error: 'Failed to fetch reference articles' });
  }
});

router.get('/api/reference-articles/:id', async (req, res) => {
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

router.post('/api/reference-articles/import', async (req, res) => {
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

router.patch('/api/reference-articles/:id', async (req, res) => {
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

router.delete('/api/reference-articles/:id', async (req, res) => {
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
router.get('/api/podcast/episodes', async (req, res) => {
  try {
    const episodes = await db.select().from(schema.podcastEpisodes).orderBy(schema.podcastEpisodes.episodeNumber);
    res.json(episodes);
  } catch (error) {
    console.error('Error fetching episodes:', error);
    res.status(500).json({ error: 'Failed to fetch episodes' });
  }
});

router.get('/api/podcast/topics', async (req, res) => {
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

router.get('/api/podcast/search', async (req, res) => {
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

router.post('/api/podcast/import', async (req, res) => {
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

router.post('/api/podcast/sync', async (req, res) => {
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

// Admin API Endpoints

export default router;
