import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import admin from "npm:firebase-admin";

console.log("Starting send-sos-notifications edge function...")

// Initialize Firebase Admin (only once per instance)
let firebaseInitialized = false;

serve(async (req) => {
    const { alertId, userId, groupId, config } = await req.json()

    // Initialize Supabase Client with Service Role Key for admin access
    const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    try {
        if (!firebaseInitialized) {
            const serviceAccountStr = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
            if (!serviceAccountStr) {
                console.error("FIREBASE_SERVICE_ACCOUNT is missing!");
                throw new Error("Server configuration error: Firebase credentials missing.");
            }
            const serviceAccount = JSON.parse(serviceAccountStr);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            firebaseInitialized = true;
        }

        // 1. Get family members and accepted trusted contacts to notify
        let userIds: string[] = [];

        if (groupId) {
            const { data: members, error: membersError } = await supabaseClient
                .from('family_members')
                .select('user_id')
                .eq('group_id', groupId)
                .neq('user_id', userId);

            if (!membersError && members) {
                userIds = [...userIds, ...members.map((m: any) => m.user_id)];
            }
        }

        const { data: contacts, error: contactsError } = await supabaseClient
            .from('trusted_contacts')
            .select('associated_user_id')
            .eq('user_id', userId)
            .eq('status', 'accepted');

        if (!contactsError && contacts) {
            userIds = [
                ...userIds, 
                ...contacts
                    .filter((c: any) => c.associated_user_id)
                    .map((c: any) => c.associated_user_id as string)
            ];
        }

        // De-duplicate userIds and filter out the sender itself
        userIds = Array.from(new Set(userIds)).filter(id => id !== userId);

        if (userIds.length === 0) {
            return new Response(JSON.stringify({ message: "No members to notify" }), {
                headers: { "Content-Type": "application/json" },
            });
        }

        // 3. Get push tokens for these users
        const { data: tokens, error: tokensError } = await supabaseClient
            .from('push_tokens')
            .select('token, platform')
            .in('user_id', userIds);

        if (tokensError) throw tokensError;

        if (!tokens || tokens.length === 0) {
            return new Response(JSON.stringify({ message: "No tokens found for members" }), {
                headers: { "Content-Type": "application/json" },
            });
        }

        // Fetch sender's name for personalized alert
        let senderName = 'Un contacto';
        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('full_name')
            .eq('id', userId)
            .single();
        if (profile?.full_name) {
            senderName = profile.full_name.split(' ')[0];
        }

        // 4. Send Notifications via Firebase Admin
        console.log(`[SOS] Sending notification to ${tokens.length} devices`);

        const isDangerZone = config?.isDangerZone || false;
        const payload = {
            notification: {
                title: isDangerZone ? '⚠️ Peligro Reportado' : '🚨 Alerta SOS',
                body: config?.message || (isDangerZone 
                    ? `${senderName} ha avisado de un peligro cercano.` 
                    : `¡SOS de ${senderName}! Necesita ayuda.`)
            },
            data: {
                type: isDangerZone ? 'danger_zone' : 'sos',
                alertId: alertId || ''
            }
        };

        const fcmTokens = tokens.map((t: any) => t.token);

        try {
            const response = await admin.messaging().sendEachForMulticast({
                tokens: fcmTokens,
                notification: payload.notification,
                data: payload.data,
                apns: {
                    payload: {
                        aps: {
                            sound: 'default',
                            badge: 1
                        }
                    }
                }
            });
            console.log(`[SOS] Successfully sent ${response.successCount} messages; Failed: ${response.failureCount}`);
            if (response.failureCount > 0) {
                response.responses.forEach((resp: any, idx: number) => {
                    if (!resp.success) {
                        console.error(`Token failed: ${fcmTokens[idx]} - Error: ${resp.error}`);
                    }
                });
            }
        } catch (fcmError) {
            console.error("[SOS] Error sending FCM:", fcmError);
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: `Processed SOS for ${tokens.length} devices`,
                debug_tokens_count: tokens.length
            }),
            { headers: { "Content-Type": "application/json" } },
        )

    } catch (error: any) {
        console.error(error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        })
    }
})
