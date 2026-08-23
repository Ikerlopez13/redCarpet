import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { createFamilyGroup, joinFamilyGroup, generateInviteLink, removeFamilyMemberByUserId } from '../../services/familyService';

interface FamilyActionSheetProps {
    isOpen: boolean;
    onClose: () => void;
    hasFamily: boolean;
    familyGroupId?: string;
    adminId?: string;
    members?: { id: string; name: string; avatar: string; avatarUrl: string | null; role?: string }[];
    onSuccess: () => void;
}

export const FamilyActionSheet: React.FC<FamilyActionSheetProps> = ({
    isOpen,
    onClose,
    hasFamily,
    familyGroupId,
    adminId,
    members = [],
    onSuccess
}) => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [mode, setMode] = useState<'menu' | 'create' | 'join' | 'invite'>('menu');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form states
    const [familyName, setFamilyName] = useState('');
    const [inviteCode, setInviteCode] = useState('');
    const [generatedLink, setGeneratedLink] = useState('');

    const handleRemoveMember = async (memberUserId: string) => {
        if (!familyGroupId) return;
        if (!confirm('¿Estás seguro de que deseas expulsar a este miembro de la familia?')) return;
        setIsLoading(true);
        setError(null);

        const { error } = await removeFamilyMemberByUserId(memberUserId, familyGroupId);
        if (error) {
            setError(error);
        } else {
            onSuccess();
        }
        setIsLoading(false);
    };

    const handleCreateFamily = async () => {
        if (!user || !familyName.trim()) return;
        setIsLoading(true);
        setError(null);

        const { error } = await createFamilyGroup(familyName, 'parental', user.id);
        if (error) {
            setError(error);
        } else {
            onSuccess();
            // Show the menu immediately so they can manage the new family
            setMode('menu');
        }
        setIsLoading(false);
    };

    const handleJoinFamily = async () => {
        if (!user || !inviteCode.trim()) return;
        setIsLoading(true);
        setError(null);

        // Extract code from full URL if pasted
        const code = inviteCode.includes('/join/') ? inviteCode.split('/join/')[1] : inviteCode;

        const { error } = await joinFamilyGroup(code, user.id);
        if (error) {
            setError(error);
        } else {
            onSuccess();
            setMode('menu');
        }
        setIsLoading(false);
    };

    const handleGenerateLink = async () => {
        if (!familyGroupId) return;
        setIsLoading(true);
        const link = await generateInviteLink(familyGroupId);
        setGeneratedLink(link);
        setIsLoading(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-lg bg-background-dark rounded-t-3xl p-6 pb-10 border-t border-white/10 animate-slide-up">

                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold">
                        {mode === 'menu' && t('family.manage')}
                        {mode === 'create' && t('family.create_title')}
                        {mode === 'join' && t('family.join_title')}
                        {mode === 'invite' && t('family.invite_title')}
                    </h3>
                    <button onClick={onClose} className="size-8 rounded-full bg-white/10 flex items-center justify-center">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {error && (
                    <div className="mb-4 p-3 rounded-xl bg-red-500/20 text-red-200 text-sm">
                        {error}
                    </div>
                )}

                {/* MENU MODE */}
                {mode === 'menu' && (
                    <div className="flex flex-col gap-3">
                        {!hasFamily ? (
                            <>
                                <button
                                    onClick={() => setMode('create')}
                                    className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                                >
                                    <div className="size-12 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                                        <span className="material-symbols-outlined text-2xl">add_home</span>
                                    </div>
                                    <div className="text-left">
                                        <p className="font-bold">{t('family.create_card')}</p>
                                        <p className="text-sm text-white/50">{t('family.create_card_sub')}</p>
                                    </div>
                                    <span className="material-symbols-outlined ml-auto text-white/40">chevron_right</span>
                                </button>

                                <button
                                    onClick={() => setMode('join')}
                                    className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                                >
                                    <div className="size-12 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                                        <span className="material-symbols-outlined text-2xl">group_add</span>
                                    </div>
                                    <div className="text-left">
                                        <p className="font-bold">{t('family.join_card')}</p>
                                        <p className="text-sm text-white/50">{t('family.join_card_sub')}</p>
                                    </div>
                                    <span className="material-symbols-outlined ml-auto text-white/40">chevron_right</span>
                                </button>
                            </>
                        ) : (
                            <div className="flex flex-col gap-4 w-full animate-fade-in">

                                <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                                    <h4 className="font-bold text-lg mb-3">{t('family.members')}</h4>
                                    <div className="flex flex-col gap-3">
                                        {members.map(member => (
                                            <div key={member.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5">
                                                <div className="size-10 rounded-full bg-zinc-700 flex items-center justify-center text-xl overflow-hidden shrink-0">
                                                    {member.avatarUrl ? (
                                                        <img src={member.avatarUrl} alt={member.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        member.avatar
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-sm truncate">{member.name}</p>
                                                    <p className="text-xs text-white/50">{member.id === adminId ? t('family.admin') : t('family.relative')}</p>
                                                </div>

                                                {/* Kick button: visible only if current user is admin, AND the member is not the admin */}
                                                {user?.id === adminId && member.id !== adminId && (
                                                    <button
                                                        onClick={() => handleRemoveMember(member.id)}
                                                        disabled={isLoading}
                                                        className="size-8 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center hover:bg-red-500/20 transition-colors shrink-0 disabled:opacity-50"
                                                        title="Expulsar"
                                                    >
                                                        <span className="material-symbols-outlined text-sm">person_remove</span>
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    onClick={() => { setMode('invite'); handleGenerateLink(); }}
                                    className="flex items-center gap-4 p-4 rounded-2xl bg-primary/20 border border-primary/50 hover:bg-primary/30 transition-all"
                                >
                                    <div className="size-12 rounded-full bg-primary flex items-center justify-center text-white">
                                        <span className="material-symbols-outlined text-2xl">person_add</span>
                                    </div>
                                    <div className="text-left">
                                        <p className="font-bold text-primary">{t('family.invite_title')}</p>
                                        <p className="text-sm text-primary/70">{t('family.invite_sub')}</p>
                                    </div>
                                    <span className="material-symbols-outlined ml-auto text-primary">chevron_right</span>
                                </button>

                                <button
                                    onClick={() => setMode('create')}
                                    className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                                >
                                    <div className="size-12 rounded-full bg-white/10 flex items-center justify-center text-white">
                                        <span className="material-symbols-outlined text-2xl">add_home</span>
                                    </div>
                                    <div className="text-left">
                                        <p className="font-bold">{t('family.create_card')}</p>
                                        <p className="text-sm text-white/50">{t('family.create_card_sub')}</p>
                                    </div>
                                    <span className="material-symbols-outlined ml-auto text-white/40">chevron_right</span>
                                </button>

                                <button
                                    onClick={() => setMode('join')}
                                    className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                                >
                                    <div className="size-12 rounded-full bg-white/10 flex items-center justify-center text-white">
                                        <span className="material-symbols-outlined text-2xl">group_add</span>
                                    </div>
                                    <div className="text-left">
                                        <p className="font-bold">{t('family.join_card')}</p>
                                        <p className="text-sm text-white/50">{t('family.join_card_sub')}</p>
                                    </div>
                                    <span className="material-symbols-outlined ml-auto text-white/40">chevron_right</span>
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* CREATE MODE */}
                {mode === 'create' && (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-white/70">{t('family.name_label')}</label>
                            <input
                                type="text"
                                value={familyName}
                                onChange={(e) => setFamilyName(e.target.value)}
                                placeholder={t('family.name_ph')}
                                className="w-full px-4 py-3 bg-white/5 rounded-xl border border-white/10 focus:border-primary outline-none transition-all"
                            />
                        </div>
                        <div className="flex gap-3 pt-4">
                            <button
                                onClick={() => setMode('menu')}
                                className="flex-1 py-3 rounded-xl bg-white/5 font-semibold"
                            >
                                Volver
                            </button>
                            <button
                                onClick={handleCreateFamily}
                                disabled={isLoading || !familyName.trim()}
                                className="flex-1 py-3 rounded-xl bg-primary text-white font-bold disabled:opacity-50"
                            >
                                {isLoading ? t('family.creating') : t('family.create_btn')}
                            </button>
                        </div>
                    </div>
                )}

                {/* JOIN MODE */}
                {mode === 'join' && (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-white/70">{t('family.code_label')}</label>
                            <input
                                type="text"
                                value={inviteCode}
                                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                                placeholder={t('family.code_ph')}
                                maxLength={7}
                                className="w-full px-4 py-3 bg-white/5 rounded-xl border border-white/10 focus:border-primary outline-none transition-all font-mono text-center text-lg tracking-widest"
                            />
                        </div>
                        <div className="flex gap-3 pt-4">
                            <button
                                onClick={() => setMode('menu')}
                                className="flex-1 py-3 rounded-xl bg-white/5 font-semibold"
                            >
                                Volver
                            </button>
                            <button
                                onClick={handleJoinFamily}
                                disabled={isLoading || !inviteCode.trim()}
                                className="flex-1 py-3 rounded-xl bg-primary text-white font-bold disabled:opacity-50"
                            >
                                {isLoading ? t('family.joining') : t('family.join_btn')}
                            </button>
                        </div>
                    </div>
                )}

                {/* INVITE MODE */}
                {mode === 'invite' && (
                    <div className="space-y-6 text-center">
                        <div className="size-20 bg-white/10 rounded-full flex items-center justify-center mx-auto">
                            <span className="material-symbols-outlined text-4xl text-primary">tag</span>
                        </div>

                        <div>
                            <p className="text-lg font-bold">{t('family.invite_code_label')}</p>
                            <p className="text-white/50 text-sm mt-1">{t('family.invite_code_sub')}</p>
                        </div>

                        {isLoading ? (
                            <div className="py-4 text-white/40">{t('family.generating_code')}</div>
                        ) : (
                            <div className="p-4 bg-white/5 rounded-xl border border-white/10 break-all font-mono text-3xl font-bold tracking-widest text-primary">
                                #{generatedLink}
                            </div>
                        )}

                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(`#${generatedLink}`);
                                // Could show toast here
                            }}
                            className="w-full py-3 rounded-xl bg-white/10 font-semibold hover:bg-white/20"
                        >
                            Copiar Código
                        </button>

                        <button
                            onClick={() => setMode('menu')}
                            className="text-sm text-white/40 underline"
                        >
                            Volver
                        </button>
                    </div>
                )}

            </div>
        </div>
    );
};
