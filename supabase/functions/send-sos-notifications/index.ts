import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

console.log("Hello from send-sos-notifications!")

serve(async (req) => {
    const { alertId, userId, groupId, config } = await req.json()

    // Initialize Supabase Client with Service Role Key for admin access
    const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    try {
        // 1. Get family members to notify (anyone in the group except the sender)
        const { data: members, error: membersError } = await supabaseClient
            .from('family_members')
            .select('user_id')
            .eq('group_id', groupId)
            .neq('user_id', userId)

        if (membersError) throw membersError

        // 2. Get emergency contacts
        // Note: In a real app, you might also want to notify emergency contacts that are NOT family members.
        // For now, let's focus on family members in the group + explicitly added contacts logic if needed.

        if (!members || members.length === 0) {
            return new Response(JSON.stringify({ message: "No members to notify" }), {
                headers: { "Content-Type": "application/json" },
            })
        }

        const userIds = members.map(m => m.user_id)

        // 3. Get push tokens for these users
        const { data: tokens, error: tokensError } = await supabaseClient
            .from('push_tokens')
            .select('token, platform')
            .in('user_id', userIds)

        if (tokensError) throw tokensError

        if (!tokens || tokens.length === 0) {
            return new Response(JSON.stringify({ message: "No tokens found for members" }), {
                headers: { "Content-Type": "application/json" },
            })
        }

        // 4. Send Notifications
        // This part requires integration with a Push Provider (FCM/APNs/OneSignal).
        // since we don't have the provider set up in this snippet, we will Log it.
        // In production, replaces this with a fetch() to FCM or OneSignal API.

        console.log(`[SOS] Sending notification to ${tokens.length} devices`)
        console.log(`[SOS] Message: ${config.message || 'Help needed!'}`)

        // Example of what you would do:
        // await Promise.all(tokens.map(t => sendPush(t.token, config.message)))

        return new Response(
            JSON.stringify({
                success: true,
                message: `Processed SOS for ${tokens.length} devices`,
                debug_tokens_count: tokens.length
            }),
            { headers: { "Content-Type": "application/json" } },
        )

    } catch (error) {
        console.error(error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        })
    }
})
