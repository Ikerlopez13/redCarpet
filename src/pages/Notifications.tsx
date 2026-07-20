import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, 
  Bell, 
  ShieldAlert, 
  Users, 
  Info, 
  CheckCircle2, 
  Clock,
  ArrowRight
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { useAuth } from '../contexts/AuthContext';
import { getFamilyData } from '../services/familyService';
import { getSOSHistory } from '../services/sosService';
import { supabase } from '../services/supabaseClient';
import { TrustedContactsService } from '../services/trustedContactsService';

interface NotificationItem {
  id: string;
  type: 'emergency' | 'family' | 'system' | 'warning';
  title: string;
  message: string;
  time: string;
  isRead: boolean;
  action?: string;
  alertId?: string;
  createdAt: string;
  mediaAudio?: string | null;
  mediaVideo?: string | null;
  lat?: number | null;
  lng?: number | null;
  fromUserId?: string;
}

export const Notifications: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;

    const fetchNotifs = async () => {
        if (!user) return;
        try {
            // Fetch accepted trusted contacts
            const contacts = await TrustedContactsService.getContacts(user.id);
            const acceptedContacts = contacts.filter(c => c.status === 'accepted' && c.associated_user_id);
            const contactUserIds = acceptedContacts.map(c => c.associated_user_id as string);
            const relevantUserIds = [user.id, ...contactUserIds];

            // Fetch profiles to map names
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url')
                .in('id', relevantUserIds);

            // Fetch SOS alerts
            const { data: alertsData } = await supabase
                .from('sos_alerts')
                .select('*')
                .in('user_id', relevantUserIds)
                .order('created_at', { ascending: false })
                .limit(20);

            // Fetch danger zones (street danger reports)
            const { data: dangerData } = await supabase
                .from('danger_zones')
                .select('*')
                .in('reporter_id', relevantUserIds)
                .order('created_at', { ascending: false })
                .limit(20);

            const formatTime = (dateStr: string) => {
                const date = new Date(dateStr);
                const now = new Date();
                const diffMins = Math.floor((now.getTime() - date.getTime()) / 60000);
                if (diffMins <= 0) return t('notifications.just_now');
                if (diffMins < 60) return t('notifications.mins_ago', { count: diffMins });
                if (diffMins < 1440) return t('notifications.hours_ago', { count: Math.floor(diffMins / 60) });
                return t('notifications.days_ago', { count: Math.floor(diffMins / 1440) });
            };

            const mappedSOS: NotificationItem[] = (alertsData || []).map(a => {
                const isOwn = a.user_id === user.id;
                const profile = profiles?.find(p => p.id === a.user_id);
                const name = isOwn ? t('notifications.me', 'Yo') : (profile?.full_name?.split(' ')[0] || t('notifications.unknown_contact'));
                
                return {
                    id: a.id,
                    alertId: a.id,
                    type: a.status === 'active' ? 'emergency' : 'family',
                    title: isOwn 
                        ? t('notifications.own_sos_title', 'SOS enviado correctamente') 
                        : (a.status === 'active' 
                            ? `🚨 ${name} ha activado un SOS` 
                            : `SOS de ${name} finalizado`),
                    message: isOwn 
                        ? t('notifications.own_alert_message', 'Se ha alertado correctamente y se ha avisado a tus contactos.') 
                        : (a.message || t('notifications.update_processed')),
                    time: formatTime(a.created_at),
                    isRead: a.status !== 'active',
                    action: a.status === 'active' ? t('notifications.open_map') : undefined,
                    createdAt: a.created_at,
                    mediaAudio: a.media_audio_url || (a.media_url && !a.media_url.includes('.mp4') && !a.media_url.includes('.webm') ? a.media_url : null),
                    mediaVideo: a.media_video_url || (a.media_url && (a.media_url.includes('.mp4') || a.media_url.includes('.webm')) ? a.media_url : null),
                    lat: a.lat,
                    lng: a.lng,
                    fromUserId: a.user_id
                };
            });

            const mappedDangers: NotificationItem[] = (dangerData || []).map(d => {
                const isOwn = d.reporter_id === user.id;
                const profile = profiles?.find(p => p.id === d.reporter_id);
                const name = isOwn ? t('notifications.me', 'Yo') : (profile?.full_name?.split(' ')[0] || t('notifications.unknown_contact'));
                
                return {
                    id: d.id,
                    type: 'warning',
                    title: isOwn 
                        ? t('notifications.own_danger_title', 'Aviso de peligro enviado') 
                        : t('notifications.danger_alert_title', 'Peligro reportado por {{name}}', { name }),
                    message: isOwn 
                        ? t('notifications.own_alert_message', 'Se ha alertado correctamente y se ha avisado a tus contactos.') 
                        : (d.description || t('map.active_zone_detected')),
                    time: formatTime(d.created_at),
                    isRead: false,
                    action: t('notifications.open_map'),
                    createdAt: d.created_at
                };
            });

            let combined = [...mappedSOS, ...mappedDangers];
            combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            // Add a welcome notification if it's too empty
            if (combined.length === 0) {
              combined.push({
                id: 'welcome',
                type: 'system',
                title: t('notifications.welcome_title'),
                message: t('notifications.welcome_message'),
                time: t('notifications.just_now'),
                isRead: false,
                createdAt: new Date().toISOString()
              });
            }
            setNotifications(combined);
        } catch (e) {
            console.error('Failed to load notifs', e);
        } finally {
            setIsLoading(false);
        }
    };
    fetchNotifs();

    // Suscripción realtime: cuando un contacto sube el audio/vídeo del SOS
    // (updateSOSAlertMedia en handleFinalStop) los contactos de confianza lo ven al instante
    realtimeChannel = supabase
      .channel('notifications-sos-updates')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'sos_alerts',
      }, () => { fetchNotifs(); })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'sos_alerts',
      }, () => { fetchNotifs(); })
      .subscribe();

    return () => {
      if (realtimeChannel) supabase.removeChannel(realtimeChannel);
    };
  }, [user]);

  const handleAction = (notif: NotificationItem) => {
    if (notif.action === t('notifications.open_map')) {
        navigate(notif.fromUserId && notif.fromUserId !== user?.id ? `/?focusUser=${notif.fromUserId}` : '/');
    } else if (notif.action === t('notifications.view_history')) {
        navigate('/history');
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#0d0d0d] text-white overflow-hidden font-display animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 pt-12 pb-6 bg-zinc-900/50 backdrop-blur-xl border-b border-white/5 shrink-0 z-10">
        <button 
          onClick={() => navigate(-1)} 
          className="p-2 -ml-2 text-white/40 hover:text-white transition-colors active:scale-90"
        >
          <ChevronLeft size={24} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-black uppercase italic tracking-tighter">{t('notifications.title')}</h1>
        </div>
        <div className="p-2 bg-primary/10 rounded-xl text-primary">
          <Bell size={20} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar pb-32">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="size-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notifications.length > 0 ? (
          notifications.map((notif, index) => (
            <div
              key={notif.id}
              className={clsx(
                "relative group p-4 rounded-2xl border transition-all active:scale-[0.98] animate-slide-up",
                notif.type === 'emergency' && !notif.isRead ? 'bg-red-600/5 border-red-500/20' :
                notif.type === 'warning' && !notif.isRead ? 'bg-amber-500/5 border-amber-500/20' :
                notif.isRead ? 'bg-white/5 border-white/5' : 'bg-primary/5 border-primary/20'
              )}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex gap-4">
                {/* Icon Indicator */}
                <div className={clsx(
                  "size-12 rounded-2xl flex items-center justify-center shrink-0",
                  notif.type === 'emergency' ? 'bg-red-600/20 text-red-500' :
                  notif.type === 'warning' ? 'bg-amber-500/20 text-amber-500' :
                  notif.type === 'family' ? 'bg-green-500/20 text-green-500' :
                  'bg-blue-500/20 text-blue-500'
                )}>
                  {notif.type === 'emergency' ? <ShieldAlert size={24} /> :
                   notif.type === 'warning' ? <ShieldAlert size={24} className="text-amber-500" /> :
                   notif.type === 'family' ? <Users size={24} /> :
                   <Info size={24} />}
                </div>

                {/* Text Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-bold text-sm text-white/90 truncate uppercase tracking-tight">
                      {notif.title}
                    </h3>
                    <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-white/30 whitespace-nowrap">
                      <Clock size={10} />
                      {notif.time}
                    </div>
                  </div>
                  <p className="text-xs text-white/50 leading-relaxed mb-3">
                    {notif.message}
                  </p>

                  {/* Grabación SOS: vídeo o audio del contacto */}
                  {notif.mediaVideo && (
                    <div className="mb-3">
                      <p className="text-[9px] font-black uppercase tracking-widest text-red-400 mb-1">🎥 Grabación de vídeo</p>
                      <video controls playsInline preload="metadata" src={notif.mediaVideo}
                        className="w-full rounded-xl border border-white/10 bg-black max-h-48" />
                    </div>
                  )}
                  {!notif.mediaVideo && notif.mediaAudio && (
                    <div className="mb-3">
                      <p className="text-[9px] font-black uppercase tracking-widest text-red-400 mb-1">🎙 Audio del SOS</p>
                      <audio controls preload="metadata" src={notif.mediaAudio}
                        className="w-full rounded-lg" style={{ colorScheme: 'dark' }} />
                    </div>
                  )}
                  {notif.type === 'emergency' && notif.lat != null && notif.lng != null && (
                    <button
                      onClick={() => window.open(`https://maps.google.com/?q=${notif.lat},${notif.lng}`, '_blank')}
                      className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-white transition-colors mb-2"
                    >
                      📍 Ver ubicación exacta
                      <ArrowRight size={12} />
                    </button>
                  )}

                  {/* Action Button */}
                  {notif.action && (
                    <button 
                      onClick={() => handleAction(notif)}
                      className={clsx(
                        "flex items-center gap-2 text-[10px] font-black uppercase tracking-widest hover:text-white transition-colors",
                        notif.type === 'warning' ? "text-amber-500" : "text-primary"
                      )}
                    >
                      {notif.action}
                      <ArrowRight size={12} />
                    </button>
                  )}
                </div>

                {/* Unread dot */}
                {!notif.isRead && (
                  <div className={clsx(
                    "absolute top-4 right-4 size-2 rounded-full",
                    notif.type === 'warning' 
                      ? "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,1)]" 
                      : "bg-primary shadow-[0_0_10px_rgba(255,49,49,1)]"
                  )} />
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-30 animate-fade-in">
            <CheckCircle2 size={64} className="text-primary" />
            <div className="space-y-1">
              <p className="text-sm font-black uppercase tracking-widest">{t('notifications.all_clear')}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider">{t('notifications.no_notifications')}</p>
            </div>
          </div>
        )}
      </div>

      {/* Footer / Privacy Info */}
      <div className="p-6 text-center border-t border-white/5 bg-zinc-900/30">
        <p className="text-[9px] text-white/20 font-bold uppercase tracking-[0.2em] leading-relaxed">
          {t('notifications.privacy_footer')}
        </p>
      </div>
    </div>
  );
};
