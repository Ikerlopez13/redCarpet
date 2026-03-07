import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function main() {
    // 1. Login as the sender
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'lopezalegreiker@gmail.com',
        password: 'password123' // I don't have the password, so I'll just use the service role key or anonymous query.
    });
}
