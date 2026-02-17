import { db, schema } from '../db';
import { eq, desc } from 'drizzle-orm';

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
      let jobQuery = db.select({
        job: schema.benchJobs,
        amp: schema.ampProfiles
      }).from(schema.benchJobs)
        .leftJoin(schema.ampProfiles, eq(schema.benchJobs.ampProfileId, schema.ampProfiles.id))
        .orderBy(desc(schema.benchJobs.createdAt));
      
      const jobs = userId 
        ? await jobQuery.where(eq(schema.benchJobs.userId, userId))
        : await jobQuery;
      
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
    
    const ampKeywords = ['fender', 'marshall', 'vox', 'mesa', 'boogie', 'twin', 'deluxe', 'princeton', 'bassman', 'ac30', 'ac15', 'jcm', 'plexi', 'champ', 'super', 'reverb', 'tremolux', 'bandmaster', 'showman', 'vibroverb', 'vibrolux'];
    const circuitKeywords = ['5f1', '5e3', '5f6', '5e1', '5c1', 'aa763', 'ab763', 'aa864', 'ab568', 'bf', 'sf', 'tweed', 'blackface', 'silverface', 'brownface'];
    
    const allKeywords = [...ampKeywords, ...circuitKeywords];
    const foundKeywords = allKeywords.filter(kw => lowerMessage.includes(kw));
    
    if (foundKeywords.length > 0) {
      let kwJobQuery = db.select({
        job: schema.benchJobs,
        amp: schema.ampProfiles
      }).from(schema.benchJobs)
        .leftJoin(schema.ampProfiles, eq(schema.benchJobs.ampProfileId, schema.ampProfiles.id));
      
      const jobs = userId 
        ? await kwJobQuery.where(eq(schema.benchJobs.userId, userId))
        : await kwJobQuery;
      
      for (const foundKeyword of foundKeywords) {
        const matchingJobs = jobs.filter(({ amp }) => 
          amp?.make?.toLowerCase().includes(foundKeyword) || 
          amp?.model?.toLowerCase().includes(foundKeyword) ||
          amp?.circuitFamily?.toLowerCase().includes(foundKeyword)
        );
        
        if (matchingJobs.length > 0) {
          context += `\n\nJOBS MATCHING "${foundKeyword.toUpperCase()}":\n`;
          matchingJobs.forEach(({ job, amp }) => {
            context += `- ${amp?.make} ${amp?.model} (${amp?.year || 'Unknown year'}) - ${job.status}\n`;
          });
        }
      }
      
      const allSchematics = await db.select().from(schema.schematics);
      for (const foundKeyword of foundKeywords) {
        const filtered = allSchematics.filter(s => 
          s.name?.toLowerCase().includes(foundKeyword) ||
          s.ampModel?.toLowerCase().includes(foundKeyword) ||
          s.circuitFamily?.toLowerCase().includes(foundKeyword) ||
          s.tags?.toLowerCase().includes(foundKeyword)
        );
        
        if (filtered.length > 0) {
          context += `\n\nSCHEMATICS MATCHING "${foundKeyword.toUpperCase()}":\n`;
          filtered.forEach(s => {
            context += `- ${s.name} (${s.circuitFamily || 'Unknown family'}) - File: ${s.fileUrl ? 'Available in library' : 'No file'}\n`;
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
