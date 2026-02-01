import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrate() {
  const client = await pool.connect();
  
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        email TEXT,
        competency_confirmed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS amp_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        make TEXT,
        model TEXT,
        year TEXT,
        circuit_family TEXT,
        serial_number TEXT,
        notes TEXT,
        photo_url TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS bench_jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        amp_profile_id UUID REFERENCES amp_profiles(id),
        status TEXT DEFAULT 'active',
        owner_symptoms TEXT,
        tech_notes TEXT,
        prior_work TEXT,
        known_mods TEXT,
        safety_checklist_completed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS symptoms (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bench_job_id UUID REFERENCES bench_jobs(id),
        description TEXT NOT NULL,
        category TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS troubleshooting_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bench_job_id UUID REFERENCES bench_jobs(id),
        mode TEXT DEFAULT 'guided',
        status TEXT DEFAULT 'active',
        current_step_index INTEGER DEFAULT 0,
        ai_conversation_history JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS test_steps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID REFERENCES troubleshooting_sessions(id),
        step_number INTEGER NOT NULL,
        instruction TEXT NOT NULL,
        meter_mode TEXT,
        probe_placement TEXT,
        expected_range TEXT,
        safety_warning TEXT,
        stop_conditions TEXT,
        completed BOOLEAN DEFAULT FALSE,
        result TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS measurements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bench_job_id UUID REFERENCES bench_jobs(id),
        test_step_id UUID REFERENCES test_steps(id),
        node_name TEXT NOT NULL,
        expected_min REAL,
        expected_max REAL,
        recorded_value REAL,
        unit TEXT,
        meter_tool TEXT,
        meter_mode TEXT,
        status TEXT,
        notes TEXT,
        photo_url TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS schematics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        amp_model TEXT,
        circuit_family TEXT,
        file_url TEXT,
        is_user_uploaded BOOLEAN DEFAULT FALSE,
        tags TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS repair_actions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bench_job_id UUID REFERENCES bench_jobs(id),
        description TEXT NOT NULL,
        part_replaced TEXT,
        part_value TEXT,
        part_brand TEXT,
        voltage_rating TEXT,
        date_code TEXT,
        before_measurement TEXT,
        after_measurement TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS reference_sources (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        url TEXT,
        title TEXT,
        author TEXT,
        date_accessed TIMESTAMP,
        excerpt_summary TEXT,
        reliability_score INTEGER,
        source_type TEXT
      );

      CREATE TABLE IF NOT EXISTS media (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bench_job_id UUID REFERENCES bench_jobs(id),
        type TEXT,
        url TEXT,
        caption TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS chats (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT DEFAULT 'New Chat',
        bench_job_id UUID REFERENCES bench_jobs(id),
        is_standalone BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS chat_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        chat_id UUID REFERENCES chats(id) NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
