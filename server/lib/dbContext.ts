import { db, schema } from '../db';
import { eq, desc, ilike, or } from 'drizzle-orm';

export async function getRelevantDatabaseContext(message: string, userId?: string): Promise<string | null> {
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
    // Extract amp/circuit keywords from message
    const ampKeywords = ['fender', 'marshall', 'vox', 'mesa', 'boogie', 'twin', 'deluxe', 'princeton', 'bassman', 'ac30', 'ac15', 'jcm', 'plexi', 'champ', 'super', 'reverb', 'tremolux', 'bandmaster', 'showman', 'vibroverb', 'vibrolux'];
    const circuitKeywords = ['5f1', '5e3', '5f6', '5e1', '5c1', 'aa763', 'ab763', 'aa864', 'ab568', 'bf', 'sf', 'tweed', 'blackface', 'silverface', 'brownface'];
    const allKeywords = [...ampKeywords, ...circuitKeywords];
    const foundKeywords = allKeywords.filter(kw => lowerMessage.includes(kw));
    
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
    
    return context || null;
  } catch (error) {
    console.error('Error getting database context:', error);
    return null;
  }
}
