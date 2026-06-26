import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { initializeApp, cert, getApps } from "npm:firebase-admin/app";
import { getMessaging } from "npm:firebase-admin/messaging";

console.log("Starting send-sos-notifications edge function...")

serve(async (req) => {
    const { alertId, userId, groupId, config } = await req.json()

    const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    try {
        if (!getApps().length) {
            const serviceAccountStr = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
            if (!serviceAccountStr) {
                throw new Error("Server configuration error: Firebase credentials missing.");
            }
            const serviceAccount = JSON.parse(serviceAccountStr);
            initializeApp({ credential: cert(serviceAccount) });
        }

        let userIds: string[] = [];

        if (groupId) {
            const { data: members } = await supabaseClient
                .from('family_members')
                .select('user_id')
                .eq('group_id', groupId)
                .neq('user_id', userId);
            if (members) userIds = [...userIds, ...members.map((m: any) => m.user_id)];
        }

        const [{ data: outbound }, { data: inbound }] = await Promise.all([
            supabaseClient.from('trusted_contacts').select('associated_user_id').eq('user_id', userId).eq('status', 'accepted'),
            supabaseClient.from('trusted_contacts').select('user_id').eq('associated_user_id', userId).eq('status', 'accepted'),
        ]);

        if (outbound) userIds = [...userIds, ...outbound.filter((c: any) => c.associated_user_id).map((c: any) => c.associated_user_id)];
        if (inbound) userIds = [...userIds, ...inbound.map((c: any) => c.user_id)];

        userIds = Array.from(new Set(userIds)).filter(id => id && id !== userId);

        console.log(`[SOS] userId=${userId}, notifying ${userIds.length} users:`, userIds);

        if (userIds.length === 0) {
            return new Response(JSON.stringify({ message: "No members to notify" }), {
                headers: { "Content-Type": "application/json" },
            });
        }

        const { data: tokens } = await supabaseClient
            .from('push_tokens')
            .select('token, platform, user_id')
            .in('user_id', userIds);

        if (!tokens || tokens.length === 0) {
            return new Response(JSON.stringify({ message: "No tokens found for members" }), {
                headers: { "Content-Type": "application/json" },
            });
        }

        let senderName = 'Un contacto';
        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('full_name')
            .eq('id', userId)
            .single();
        if (profile?.full_name) senderName = profile.full_name.split(' ')[0];

        console.log(`[SOS] Sending to ${tokens.length} devices`);

        const isDangerZone = config?.isDangerZone || false;
        const fcmTokens = tokens.map((t: any) => t.token);

        const messaging = getMessaging();
        const response = await messaging.sendEachForMulticast({
            tokens: fcmTokens,
            notification: {
                title: isDangerZone ? '⚠️ Peligro Reportado' : '🚨 Alerta SOS',
                body: config?.message || (isDangerZone
                    ? `${senderName} ha avisado de un peligro cercano.`
                    : `¡SOS de ${senderName}! Necesita ayuda.`)
            },
            data: {
                type: isDangerZone ? 'danger_zone' : 'sos',
                alertId: alertId || ''
            },
            apns: {
                headers: {
                    'apns-priority': '10',
                    'apns-push-type': 'alert',
                },
                payload: {
                    aps: {
                        sound: 'default',
                        badge: 1,
                        'content-available': 1,
                    }
                }
            },
            android: { priority: 'high' }
        });

        console.log(`[SOS] Sent ${response.successCount} OK, ${response.failureCount} failed`);

        const staleTokens: string[] = [];
        const errors: string[] = [];
        response.responses.forEach((resp: any, idx: number) => {
            if (!resp.success) {
                const errCode = resp.error?.code || 'unknown';
                errors.push(`token[${idx}]: ${errCode}`);
                console.log(`[SOS] Token ${idx} failed: ${errCode}`);
                if (
                    errCode === 'messaging/registration-token-not-registered' ||
                    errCode === 'messaging/invalid-registration-token'
                ) {
                    staleTokens.push(fcmTokens[idx]);
                }
            }
        });
        if (staleTokens.length > 0) {
            await supabaseClient.from('push_tokens').delete().in('token', staleTokens);
            console.log(`[SOS] Removed ${staleTokens.length} stale tokens`);
        }

        return new Response(
            JSON.stringify({
                success: true,
                sent: response.successCount,
                failed: response.failureCount,
                tokens_count: tokens.length,
                errors
            }),
            { headers: { "Content-Type": "application/json" } },
        )

    } catch (error: any) {
        console.error("[SOS] Error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        })
    }
})
