import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, type URLOpenListenerEvent } from '@capacitor/app';
import { supabase } from '../../services/supabaseClient';
import { Browser } from '@capacitor/browser';

export const DeepLinkHandler = () => {
    const navigate = useNavigate();

    const handleDeepLink = useCallback(async (url: string) => {
        console.log('⚡️ Processing Deep Link URL:', url);

        // 1. Check if we already have a session (Loop Protection)
        const { data } = await supabase.auth.getSession();
        if (data?.session) {
            console.log('✅ User already has a session. Ignoring Deep Link.');
            return;
        }

        // 2. Parse URL for tokens (Implicit Flow)
        if (url.includes('access_token') && url.includes('refresh_token')) {
            try {
                // Close browser first
                Browser.close().catch(() => { });

                const urlObj = new URL(url);
                const hash = urlObj.hash.substring(1);
                const params = new URLSearchParams(hash);
                const access_token = params.get('access_token');
                const refresh_token = params.get('refresh_token');

                if (access_token && refresh_token) {
                    console.log('🔑 Tokens found! Attempting aggressive session recovery...');

                    // A. Manual Storage Write (The "Aggressive" Part)
                    try {
                        const projectRef = import.meta.env.VITE_SUPABASE_URL.split('://')[1].split('.')[0];
                        const storageKey = `sb-${projectRef}-auth-token`; // Supabase's internal key format

                        // Construct the session object exactly as Supabase expects it
                        // We fetch the user first to ensure we have the full object
                        const userUrl = `https://${projectRef}.supabase.co/auth/v1/user`;
                        const userResponse = await fetch(userUrl, {
                            headers: {
                                'Authorization': `Bearer ${access_token}`,
                                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
                            }
                        });

                        if (userResponse.ok) {
                            const user = await userResponse.json();
                            const session = {
                                access_token,
                                refresh_token,
                                expires_in: 3600,
                                token_type: 'bearer',
                                user
                            };
                            const sessionStr = JSON.stringify(session);

                            // 1. Write to Capacitor Preferences (Native Persistent Storage)
                            const { Preferences } = await import('@capacitor/preferences');
                            await Preferences.set({ key: storageKey, value: sessionStr });
                            console.log('💾 Session forcefully written to Native Storage:', storageKey);

                            // 2. Write to localStorage (Web Fallback / Backup)
                            localStorage.setItem(storageKey, sessionStr);
                            console.log('💾 Session written to localStorage');

                            // 3. Set Session in SDK (Just in case)
                            await supabase.auth.setSession({ access_token, refresh_token });

                            // 4. Force Reload to pick up the new state from scratch
                            console.log('🚀 Force reloading app to initialize with new session...');
                            window.location.href = '/';
                            return;
                        } else {
                            console.error('❌ Failed to fetch user for session construction');
                        }
                    } catch (err) {
                        console.error('🔥 Error during aggressive storage write:', err);
                    }

                    // Fallback to standard SDK if manual failed
                    console.log('⚠️ Falling back to standard SDK setSession...');
                    const { error } = await supabase.auth.setSession({
                        access_token,
                        refresh_token,
                    });

                    if (!error) {
                        window.location.href = '/';
                    }
                }
            } catch (error) {
                console.error('Error parsing deep link:', error);
            }
        }
    }, [navigate]);

    useEffect(() => {
        // Handle Cold Start
        App.getLaunchUrl().then(launchUrl => {
            if (launchUrl && launchUrl.url.startsWith('com.vibecode.redcarpet://')) {
                console.log('App opened with cold start URL:', launchUrl.url);
                handleDeepLink(launchUrl.url);
            }
        });

        // Handle Background/Resume
        const listener = App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
            if (event.url.startsWith('com.vibecode.redcarpet://')) {
                console.log('App opened with URL event:', event.url);
                handleDeepLink(event.url);
            }
        });

        return () => {
            listener.then(handler => handler.remove());
        };
    }, [handleDeepLink]);

    return null;
};
