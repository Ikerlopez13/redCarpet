const fetch = require('node-fetch');

async function run() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error('SUPABASE_ACCESS_TOKEN is required');
  const ref = 'mqlfptujypzofidvmjnb';
  
  const sql = `
    -- Enable RLS
    ALTER TABLE public.danger_zones ENABLE ROW LEVEL SECURITY;
    
    -- Drop old policies if any
    DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.danger_zones;
    
    -- Create open policy for inserts
    CREATE POLICY "Enable insert for authenticated users"
    ON public.danger_zones FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = reporter_id);
    
    -- Create select policy
    CREATE POLICY "Enable read access for all users"
    ON public.danger_zones FOR SELECT USING (true);
  `;
  
  try {
    const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: sql })
    });
    const text = await res.text();
    console.log("Response:", res.status, text);
  } catch(e) {
    console.error(e);
  }
}
run();
