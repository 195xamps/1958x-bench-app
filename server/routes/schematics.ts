import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { db, schema } from '../db';
import { eq, ilike, or, and } from 'drizzle-orm';
import { cacheSchematicLibrary } from '../middleware/cache';

const router = Router();

// Schematic catalog is read-mostly — cache GETs for 5 min.
router.use(cacheSchematicLibrary);

// Schematics are a curated library. Anyone can read them, but only admins
// can create/edit/delete entries — this prevents users from polluting the
// shared library with incorrect or low-quality data that could mislead
// other technicians.
function requireAdmin(req: any, res: Response, next: NextFunction) {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: 'Admin access required to modify schematics' });
  }
  next();
}

router.get('/api/schematics', async (req, res) => {
  try {
    const schematics = await db.select().from(schema.schematics);
    res.json(schematics);
  } catch (error) {
    console.error('Error fetching schematics:', error);
    res.status(500).json({ error: 'Failed to fetch schematics' });
  }
});

router.post('/api/schematics', requireAdmin, async (req, res) => {
  try {
    const {
      name, ampModel, circuitFamily,
      fileUrl, sourceUrl, sourceCredit, thumbnailUrl,
      tags, notes,
    } = req.body;

    if (!name) return res.status(400).json({ error: 'name is required' });

    const [schematic] = await db.insert(schema.schematics).values({
      name,
      ampModel,
      circuitFamily,
      fileUrl,
      sourceUrl,
      sourceCredit,
      thumbnailUrl,
      tags,
      notes,
      isUserUploaded: false,
    }).returning();

    res.json(schematic);
  } catch (error) {
    console.error('Error creating schematic:', error);
    res.status(500).json({ error: 'Failed to create schematic' });
  }
});

router.get('/api/schematics/search', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      const allSchematics = await db.select().from(schema.schematics);
      return res.json(allSchematics);
    }
    
    const searchTerm = `%${(q as string).toLowerCase()}%`;
    const filtered = await db.select().from(schema.schematics)
      .where(
        or(
          ilike(schema.schematics.name, searchTerm),
          ilike(schema.schematics.ampModel, searchTerm),
          ilike(schema.schematics.circuitFamily, searchTerm),
          ilike(schema.schematics.tags, searchTerm)
        )
      );
    
    res.json(filtered);
  } catch (error) {
    console.error('Error searching schematics:', error);
    res.status(500).json({ error: 'Failed to search schematics' });
  }
});

router.get('/api/schematics/:id', async (req, res) => {
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

router.patch('/api/schematics/:id', requireAdmin, async (req, res) => {
  try {
    const schematicId = req.params.id;
    const {
      name, tags, ampModel, circuitFamily, notes, externalLinks,
      sourceUrl, sourceCredit, thumbnailUrl, fileUrl,
    } = req.body;

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
    if (sourceUrl !== undefined) updateData.sourceUrl = sourceUrl;
    if (sourceCredit !== undefined) updateData.sourceCredit = sourceCredit;
    if (thumbnailUrl !== undefined) updateData.thumbnailUrl = thumbnailUrl;
    if (fileUrl !== undefined) updateData.fileUrl = fileUrl;

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

router.get('/api/schematics/:id/attachments', async (req, res) => {
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

router.post('/api/schematics/:id/attachments', requireAdmin, async (req, res) => {
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

router.delete('/api/schematics/:id/attachments/:attachmentId', requireAdmin, async (req, res) => {
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

router.delete('/api/schematics/:id', requireAdmin, async (req, res) => {
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

export default router;
