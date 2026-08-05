import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { initializeApp, cert } from "npm:firebase-admin/app";
import { getMessaging } from "npm:firebase-admin/messaging";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

let firebaseInitialized = false;

function initFirebase() {
    if (firebaseInitialized) return;
    const sa = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
    if (!sa) throw new Error("FIREBASE_SERVICE_ACCOUNT secret missing");
    initializeApp({ credential: cert(JSON.parse(sa)) });
    firebaseInitialized = true;
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    let alertId, userId, groupId, config, action, mediaUrl, thumbnailUrl, chunkIndex;
    try {
        ({ alertId, userId, groupId, config,
            action, mediaUrl, thumbnailUrl, chunkIndex } = await req.json());
    } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const db = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    try {
        initFirebase();

        // ── Collect recipient user IDs ──────────────────────────────────────
        let userIds: string[] = [];

        if (groupId) {
            const { data: members } = await db
                .from('family_members')
                .select('user_id')
                .eq('group_id', groupId)
                .neq('user_id', userId);
            if (members) userIds.push(...members.map((m: any) => m.user_id));
        }

        const { data: outbound } = await db
            .from('trusted_contacts')
            .select('associated_user_id')
            .eq('user_id', userId)
            .eq('status', 'accepted');
        if (outbound) userIds.push(...outbound.filter((c: any) => c.associated_user_id).map((c: any) => c.associated_user_id as string));

        const { data: inbound } = await db
            .from('trusted_contacts')
            .select('user_id')
            .eq('associated_user_id', userId)
            .eq('status', 'accepted');
        if (inbound) userIds.push(...inbound.map((c: any) => c.user_id as string));

        userIds = Array.from(new Set(userIds)).filter(id => id !== userId);
        if (userIds.length === 0) {
            return new Response(JSON.stringify({ message: "No contacts to notify" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // ── Push tokens ────────────────────────────────────────────────────
        const { data: tokenRows, error: tokensError } = await db
            .from('push_tokens')
            .select('token, user_id, platform')
            .in('user_id', userIds);
        if (tokensError) throw tokensError;
        if (!tokenRows?.length) {
            return new Response(JSON.stringify({ message: "No push tokens found" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // ── Sender name ────────────────────────────────────────────────────
        let senderName = 'Un contacto';
        const { data: profile } = await db.from('profiles').select('full_name').eq('id', userId).single();
        if (profile?.full_name) senderName = profile.full_name.split(' ')[0];

        // ── Notification payload ───────────────────────────────────────────
        const isDangerZone = config?.isDangerZone || false;
        const isRouteStart = config?.isRouteStart || false;

        let title: string;
        let body: string;
        let imageUrl: string | undefined = thumbnailUrl ?? undefined;

        if (action === 'chunk_uploaded') {
            // A new video chunk arrived — try to get thumbnail from sos_recordings
            if (!imageUrl && alertId) {
                const { data: rec } = await db
                    .from('sos_recordings')
                    .select('thumbnail_url')
                    .eq('sos_alert_id', alertId)
                    .not('thumbnail_url', 'is', null)
                    .order('created_at', { ascending: true })
                    .limit(1)
                    .single();
                imageUrl = rec?.thumbnail_url ?? undefined;
            }
            const isVideo = chunkIndex !== undefined
                ? !/\.m4a$/.test(mediaUrl || '')
                : /\.(webm|mp4|mov)/i.test(mediaUrl || '');
            title = isVideo
                ? `🎥 Vídeo SOS de ${senderName}`
                : `🎙️ Audio SOS de ${senderName}`;
            body = isVideo
                ? `${senderName} está grabando. Abre la app para ver el vídeo en directo.`
                : `${senderName} está grabando audio. Ábrelo en la app.`;
        } else if (action === 'thumbnail_ready') {
            // Silent data push — just update badge/notification, no sound
            title = `🎥 ${senderName} ha activado SOS`;
            body = `Grabando vídeo. Ábre la app para ver.`;
            imageUrl = thumbnailUrl ?? undefined;
        } else if (action === 'media_uploaded' && mediaUrl) {
            const isVideo = /\.(webm|mp4|mov)(\?|$)/i.test(mediaUrl);
            title = isVideo ? `🎥 Vídeo SOS de ${senderName}` : `🎙️ Audio SOS de ${senderName}`;
            body = isVideo
                ? `${senderName} grabó un vídeo durante el SOS. Ábrelo en la app.`
                : `${senderName} grabó un audio durante el SOS. Ábrelo en la app.`;
        } else {
            title = isRouteStart
                ? '🚶 Ruta Iniciada'
                : isDangerZone ? '⚠️ Peligro Reportado' : '🚨 Alerta SOS';
            body = config?.message || (isDangerZone
                ? `${senderName} ha avisado de un peligro cercano.`
                : `¡SOS de ${senderName}! Necesita ayuda urgente.`);
        }

        // ── FCM multicast ──────────────────────────────────────────────────
        const fcmTokens = tokenRows.map((t: any) => t.token);
        const message: any = {
            tokens: fcmTokens,
            notification: { title, body, ...(imageUrl ? { imageUrl } : {}) },
            data: {
                type: isRouteStart ? 'route_start' : isDangerZone ? 'danger_zone' : 'sos',
                alertId: alertId || '',
                action: action || '',
                mediaUrl: mediaUrl || '',
                userId: userId || '',
                ...(thumbnailUrl ? { thumbnailUrl } : {}),
                ...(chunkIndex !== undefined ? { chunkIndex: String(chunkIndex) } : {}),
            },
            apns: {
                payload: {
                    aps: {
                        sound: action === 'thumbnail_ready' ? undefined : 'default',
                        badge: 1,
                        'content-available': 1,
                        'mutable-content': imageUrl ? 1 : undefined,
                    },
                },
                ...(imageUrl ? { fcm_options: { image: imageUrl } } : {}),
                headers: {
                    'apns-priority': action === 'thumbnail_ready' ? '5' : '10',
                    'apns-push-type': action === 'thumbnail_ready' ? 'background' : 'alert',
                },
            },
            android: {
                priority: 'high' as const,
                notification: {
                    sound: action === 'thumbnail_ready' ? undefined : 'default',
                    ...(imageUrl ? { imageUrl } : {}),
                },
            },
        };

        const response = await getMessaging().sendEachForMulticast(message);
        console.log(`[SOS] ✅ sent=${response.successCount} ❌ failed=${response.failureCount}`);

        // Remove stale tokens
        const staleTokens: string[] = [];
        response.responses.forEach((r: any, i: number) => {
            if (!r.success) {
                const code = r.error?.code || '';
                console.error(`[SOS] Token failed: ${fcmTokens[i]} — ${code}`);
                if (code === 'messaging/registration-token-not-registered' ||
                    code === 'messaging/invalid-registration-token') {
                    staleTokens.push(fcmTokens[i]);
                }
            }
        });
        if (staleTokens.length > 0) {
            await db.from('push_tokens').delete().in('token', staleTokens);
        }

        return new Response(JSON.stringify({
            success: true,
            sent: response.successCount,
            failed: response.failureCount,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } catch (error: any) {
        console.error('[SOS] Fatal error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
