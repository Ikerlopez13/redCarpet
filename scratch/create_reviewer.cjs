const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Basic .env.local parser
function getEnv() {
    const envPath = path.join(__dirname, '.env.local');
    if (!fs.existsSync(envPath)) return {};
    const content = fs.readFileSync(envPath, 'utf8');
    const env = {};
    content.split('\n').forEach(line => {
        const match = line.match(/^([^#=]+)=(.*)$/);
        if (match) {
            env[match[1].trim()] = match[2].trim();
        }
    });
    return env;
}

async function createReviewer() {
    const env = getEnv();
    const supabaseUrl = env.VITE_SUPABASE_URL;
    const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('❌ Missing Supabase credentials in .env.local');
        return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const email = 'test.reviewer@redcarpet.app';
    const password = 'RedCarpet12345678$';
    const fullName = 'Google Reviewer';

    console.log(`🚀 Attempting to create user: ${email}...`);
    console.log(`🔗 URL: ${supabaseUrl}`);
    
    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName,
                },
            },
        });

        if (error) {
            console.error('❌ Error during sign up:', error.message);
            return;
        }

        console.log('✅ User created successfully!');
        process.exit(0);
    } catch (e) {
        console.error('💥 CRASH:', e);
        process.exit(1);
    }
}

createReviewer();
