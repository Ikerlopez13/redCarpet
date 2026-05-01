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

interface NotificationItem {
  id: string;
  type: 'emergency' | 'family' | 'system';
  title: string;
  message: string;
  time: string;
  isRead: boolean;
  action?: string;
  alertId?: string;
}

export const Notifications: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchNotifs = async () => {
        if (!user) return;
        try {
            const { group, members } = await getFamilyData(user.id);
            if (group) {
                const alerts = await getSOSHistory(group.id, 20);
                const mapped: NotificationItem[] = alerts.map(a => {
                    const member = members.find(m => m.profile?.id === a.user_id);
                    const name = member?.profile?.full_name?.split(' ')[0] || t('notifications.unknown_contact');
                    
                    const date = new Date(a.created_at);
                    const now = new Date();
                    const diffMins = Math.floor((now.getTime() - date.getTime()) / 60000);
                    let timeStr = t('notifications.just_now');
                    if (diffMins > 0 && diffMins < 60) timeStr = t('notifications.mins_ago', { count: diffMins });
                    else if (diffMins >= 60 && diffMins < 1440) timeStr = t('notifications.hours_ago', { count: Math.floor(diffMins/60) });
                    else if (diffMins >= 1440) timeStr = t('notifications.days_ago', { count: Math.floor(diffMins/1440) });

                    return {
                        id: a.id,
                        alertId: a.id,
                        type: a.status === 'active' ? 'emergency' : 'family',
                        title: a.status === 'active' ? t('notifications.journey_alert_title', { name }) : t('notifications.journey_finished_title', { name }),
                        message: a.message || t('notifications.update_processed'),
                        time: timeStr,
                        isRead: a.status !== 'active',
                        action: a.status === 'active' ? t('notifications.open_map') : t('notifications.view_history')
                    };
                });
                // Add a welcome notification if it's too empty
                if (mapped.length === 0) {
                  mapped.push({
                    id: 'welcome',
                    type: 'system',
                    title: t('notifications.welcome_title'),
                    message: t('notifications.welcome_message'),
                    time: t('notifications.just_now'),
                    isRead: false
                  });
                }
                setNotifications(mapped);
            }
        } catch (e) {
            console.error('Failed to load notifs', e);
        } finally {
            setIsLoading(false);
        }
    };
    fetchNotifs();
  }, [user]);

  const handleAction = (notif: NotificationItem) => {
    if (notif.action === t('notifications.open_map')) {
        navigate('/');
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
                notif.isRead ? 'bg-white/5 border-white/5' : 'bg-primary/5 border-primary/20'
              )}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex gap-4">
                {/* Icon Indicator */}
                <div className={clsx(
                  "size-12 rounded-2xl flex items-center justify-center shrink-0",
                  notif.type === 'emergency' ? 'bg-red-600/20 text-red-500' :
                  notif.type === 'family' ? 'bg-green-500/20 text-green-500' :
                  'bg-blue-500/20 text-blue-500'
                )}>
                  {notif.type === 'emergency' ? <ShieldAlert size={24} /> :
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

                  {/* Action Button */}
                  {notif.action && (
                    <button 
                      onClick={() => handleAction(notif)}
                      className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary hover:text-white transition-colors"
                    >
                      {notif.action}
                      <ArrowRight size={12} />
                    </button>
                  )}
                </div>

                {/* Unread dot */}
                {!notif.isRead && (
                  <div className="absolute top-4 right-4 size-2 bg-primary rounded-full shadow-[0_0_10px_rgba(255,49,49,1)]" />
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
