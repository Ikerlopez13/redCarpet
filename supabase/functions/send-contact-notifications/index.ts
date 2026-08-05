import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { initializeApp, cert } from "npm:firebase-admin/app";
import { getMessaging } from "npm:firebase-admin/messaging";

console.log("Starting send-contact-notifications edge function...")

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

// Initialize Firebase Admin (only once per instance)
let firebaseInitialized = false;

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    // Expected body: { recipientId: string, senderId: string, type: 'request_received' | 'request_accepted' }
    const { recipientId, senderId, type } = await req.json()

    if (!recipientId || !senderId || !type) {
        return new Response(JSON.stringify({ error: "Missing required parameters: recipientId, senderId, type" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
    }

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
            initializeApp({
                credential: cert(serviceAccount)
            });
            firebaseInitialized = true;
        }

        // 1. Fetch sender's name
        let senderName = 'Un contacto';
        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('full_name')
            .eq('id', senderId)
            .single();
        if (profile?.full_name) {
            senderName = profile.full_name;
        }

        // 2. Fetch recipient's push tokens
        const { data: tokens, error: tokensError } = await supabaseClient
            .from('push_tokens')
            .select('token, platform')
            .eq('user_id', recipientId);

        if (tokensError) throw tokensError;

        if (!tokens || tokens.length === 0) {
            console.log(`[Contact Notification] No push tokens found for recipient: ${recipientId}`);
            return new Response(JSON.stringify({ success: true, message: "No tokens found for recipient" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // 3. Construct Notification Payload
        let title = '';
        let body = '';
        
        if (type === 'request_received') {
            title = '🛡️ Nueva Solicitud';
            body = `${senderName} quiere añadirte como contacto de confianza.`;
        } else if (type === 'request_accepted') {
            title = '✅ Solicitud Aceptada';
            body = `${senderName} ha aceptado tu solicitud de contacto.`;
        } else {
            throw new Error(`Invalid notification type: ${type}`);
        }

        const payload = {
            notification: { title, body },
            data: {
                type: 'contact_update',
                notificationType: type,
                senderId: senderId
            }
        };

        const fcmTokens = tokens.map((t: any) => t.token);
        console.log(`[Contact Notification] Sending '${type}' notification to ${tokens.length} devices`);

        const response = await getMessaging().sendEachForMulticast({
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

        console.log(`[Contact Notification] Successfully sent ${response.successCount} messages; Failed: ${response.failureCount}`);
        if (response.failureCount > 0) {
            response.responses.forEach((resp: any, idx: number) => {
                if (!resp.success) {
                    console.error(`Token failed: ${fcmTokens[idx]} - Error: ${resp.error}`);
                }
            });
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: `Processed notification for ${tokens.length} devices`,
                sent_count: response.successCount
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        )

    } catch (error: any) {
        console.error("[Contact Notification] Error:", error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
    }
})
