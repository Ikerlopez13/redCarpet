import fetch from 'node-fetch';

async function run() {
    const token = 'sbp_27e38fe8edbf40a50395fc2cdb4b7b460a50a730';
    const ref = 'mqlfptujypzofidvmjnb';
    
    // Test the API
    const res = await fetch(`https://api.supabase.com/v1/projects/${ref}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log(await res.json());
}
run();
