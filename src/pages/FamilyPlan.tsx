import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Users, Check, Clock, UserPlus, Loader2, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { supabase } from '../services/supabaseClient';

interface Seat { seat_user_id: string | null; name: string; email: string; state: 'active' | 'pending'; }
interface Contact { user_id: string; name: string; email: string; already_assigned: boolean; }

export const FamilyPlan: React.FC = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [seats, setSeats] = useState<Seat[]>([]);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [isOwner, setIsOwner] = useState(true);
    const [error, setError] = useState('');
    const [dropdownOpen, setDropdownOpen] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const uid = (await supabase.auth.getUser()).data.user?.id;
            const { data: hasPlan } = await supabase.rpc('has_active_family_plan', { p_uid: uid });
            setIsOwner(!!hasPlan);
            if (!hasPlan) { setSeats([]); setContacts([]); return; }

            const [{ data: seatRows }, { data: contactRows }] = await Promise.all([
                supabase.rpc('family_seats_list'),
                supabase.rpc('family_eligible_contacts'),
            ]);
            setSeats((seatRows ?? []) as Seat[]);
            setContacts((contactRows ?? []) as Contact[]);
        } catch { setSeats([]); setContacts([]); }
        finally { setLoading(false); }
    };
    useEffect(() => { load(); }, []);

    const errMsgKey: Record<string, string> = {
        not_family_owner: 'familyplan.err_not_owner',
        no_seats: 'familyplan.err_no_seats',
        self: 'familyplan.err_self',
        not_contact: 'familyplan.err_not_contact',
    };

    const assign = async (contact: Contact) => {
        setDropdownOpen(false);
        setBusyId(contact.user_id); setError('');
        const { data, error: rpcErr } = await supabase.rpc('assign_family_seat_user', { p_target: contact.user_id });
        const code = rpcErr ? 'not_family_owner' : (data as string);
        if (code !== 'granted' && code !== 'already_assigned') {
            setError(`${contact.name}: ${t(errMsgKey[code] || 'familyplan.err_seat')}`);
        }
        await load();
        setBusyId(null);
    };

    const revoke = async (seat: Seat) => {
        if (!seat.seat_user_id) return;
        setBusyId(seat.seat_user_id);
        await supabase.rpc('revoke_family_seat_user', { p_target: seat.seat_user_id });
        await load();
        setBusyId(null);
    };

    const used = seats.length;
    const assignedIds = new Set(seats.map(s => s.seat_user_id));
    const available = contacts.filter(c => !c.already_assigned && !assignedIds.has(c.user_id));

    const initials = (name: string) =>
        name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '?';

    return (
        <div className="flex flex-col h-full w-full bg-[#0d0d0d] text-white overflow-hidden font-display">
            <div className="flex items-center gap-4 px-6 pt-12 pb-5 bg-zinc-900/50 backdrop-blur-xl border-b border-white/5 shrink-0">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-white/40 hover:text-white active:scale-90 transition-transform">
                    <ChevronLeft size={24} />
                </button>
                <div className="flex items-center gap-3">
                    <div className="size-10 rounded-2xl bg-primary/15 text-primary flex items-center justify-center">
                        <Users size={20} />
                    </div>
                    <h1 className="text-xl font-black uppercase italic tracking-tighter">{t('familyplan.title')}</h1>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5 no-scrollbar pb-10">
                {loading ? (
                    <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary" /></div>
                ) : !isOwner ? (
                    <div className="text-center py-16 text-white/50 text-sm px-6">{t('familyplan.no_family')}</div>
                ) : (
                    <>
                        <p className="text-sm text-white/60 leading-relaxed">{t('familyplan.subtitle_contacts')}</p>
                        <p className="text-[11px] font-bold text-primary uppercase tracking-widest">
                            {t('familyplan.seats_used', { used })}
                        </p>

                        {/* Asientos ya asignados (personas) */}
                        {seats.length > 0 && (
                            <div className="space-y-2">
                                {seats.map(s => (
                                    <div key={s.seat_user_id ?? s.email} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                                        <div className="size-9 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-black shrink-0">
                                            {initials(s.name)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold truncate">{s.name}</p>
                                            <p className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${s.state === 'active' ? 'text-emerald-400' : 'text-amber-400'}`}>
                                                {s.state === 'active' ? <Check size={11} /> : <Clock size={11} />}
                                                {s.state === 'active' ? t('familyplan.seat_active') : t('familyplan.seat_pending')}
                                            </p>
                                        </div>
                                        {s.seat_user_id && (
                                            <button onClick={() => revoke(s)} disabled={busyId === s.seat_user_id}
                                                className="text-white/30 hover:text-red-400 text-xs font-bold uppercase disabled:opacity-40">
                                                {busyId === s.seat_user_id ? <Loader2 size={14} className="animate-spin" /> : t('familyplan.remove')}
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Selector desplegable de contactos de confianza */}
                        {used < 5 && (
                            <div className="space-y-2">
                                <p className="text-[11px] font-bold uppercase tracking-widest text-white/40 pt-2">
                                    {t('familyplan.pick_contacts')}
                                </p>

                                {available.length === 0 ? (
                                    <div className="text-center py-6 px-4 bg-white/5 border border-white/10 rounded-2xl">
                                        <p className="text-sm text-white/40">{t('familyplan.no_contacts')}</p>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        {/* Trigger del desplegable */}
                                        <button
                                            onClick={() => setDropdownOpen(o => !o)}
                                            disabled={!!busyId}
                                            className="w-full flex items-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl px-4 h-14 active:scale-[0.99] transition-all disabled:opacity-40"
                                        >
                                            <div className="size-9 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
                                                <UserPlus size={18} />
                                            </div>
                                            <span className="flex-1 text-left text-sm font-bold text-white/80">
                                                {t('familyplan.select_contact')}
                                            </span>
                                            {busyId
                                                ? <Loader2 size={18} className="animate-spin text-primary" />
                                                : <ChevronDown size={18} className={clsx('text-white/40 transition-transform', dropdownOpen && 'rotate-180')} />}
                                        </button>

                                        {/* Panel desplegable con los contactos de confianza */}
                                        {dropdownOpen && (
                                            <>
                                                <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
                                                <div className="absolute z-20 mt-2 w-full bg-[#18181f] border border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto no-scrollbar animate-fade-in">
                                                    {available.map(c => (
                                                        <button
                                                            key={c.user_id}
                                                            onClick={() => assign(c)}
                                                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 border-b border-white/5 last:border-0 active:bg-white/10 transition-colors text-left"
                                                        >
                                                            <div className="size-9 rounded-full bg-white/10 text-white/70 flex items-center justify-center text-xs font-black shrink-0">
                                                                {initials(c.name)}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-semibold truncate">{c.name}</p>
                                                                <p className="text-[10px] text-white/35 truncate">{c.email}</p>
                                                            </div>
                                                            <div className="size-7 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
                                                                <UserPlus size={14} />
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {error && <p className="text-red-400 text-xs font-bold whitespace-pre-line">{error}</p>}
                    </>
                )}
            </div>
        </div>
    );
};
