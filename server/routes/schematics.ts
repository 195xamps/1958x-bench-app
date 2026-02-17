import { Router } from 'express';
import { db, schema } from '../db';
import { eq, ilike, or, and } from 'drizzle-orm';

const router = Router();

router.get('/api/schematics', async (req, res) => {
  try {
    const schematics = await db.select().from(schema.schematics);
    res.json(schematics);
  } catch (error) {
    console.error('Error fetching schematics:', error);
    res.status(500).json({ error: 'Failed to fetch schematics' });
  }
});

router.post('/api/schematics', async (req, res) => {
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

router.get('/api/schematics/search', async (req, res) => {
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

router.patch('/api/schematics/:id', async (req, res) => {
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

router.post('/api/schematics/:id/attachments', async (req, res) => {
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

router.delete('/api/schematics/:id/attachments/:attachmentId', async (req, res) => {
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

router.delete('/api/schematics/:id', async (req, res) => {
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
