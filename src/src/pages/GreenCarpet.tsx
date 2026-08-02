import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Droplets,
    Users,
    TrendingUp,
    ShieldCheck,
    ChevronLeft,
    Zap,
    TreePine,
    Share2,
    Calendar,
    ArrowUpRight,
    Leaf,
    Target
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';

type TabType = 'community' | 'personal';

export const GreenCarpet: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { t, i18n } = useTranslation();
    const [activeTab, setActiveTab] = useState<TabType>('community');

    const currentLang = i18n.language?.split('-')[0] || 'es';

    const localizedMonths: Record<string, string[]> = {
        es: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'],
        ca: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'],
        en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        fr: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun'],
        pt: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'],
        de: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun'],
        it: ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu']
    };

    const months = localizedMonths[currentLang] || localizedMonths.es;

    return (
        <div className="flex flex-col h-full w-full bg-[#050505] text-white overflow-hidden font-display relative">
            {/* Ambient Background Glows */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#10B981]/5 rounded-full blur-[150px] pointer-events-none" />
            <div className="absolute top-1/3 left-0 w-80 h-80 bg-[#FF3131]/3 rounded-full blur-[130px] pointer-events-none" />

            {/* Header */}
            <div className="flex items-center justify-between p-6 pt-12 shrink-0 z-20 relative">
                <button 
                    onClick={() => navigate(-1)} 
                    className="size-11 flex items-center justify-center text-white/60 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 hover:text-white transition-all active:scale-95"
                >
                    <ChevronLeft size={22} />
                </button>
                
                <div className="flex items-center gap-2 px-4 py-1.5 bg-[#10B981]/10 rounded-full border border-[#10B981]/20 backdrop-blur-md">
                    <div className="size-2 bg-[#10B981] rounded-full animate-pulse" />
                    <span className="text-[10px] font-black tracking-widest uppercase text-[#10B981]">{t('greencarpet.live')}</span>
                </div>

                <div className="size-11" />
            </div>

            {/* Title Section */}
            <div className="px-6 mb-6 text-center relative z-10 shrink-0">
                <h1 className="text-3xl font-black uppercase italic tracking-tighter leading-none mb-1 text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-white/70">
                    {t('greencarpet.social_impact')}
                </h1>
                <p className="text-white/40 text-[9px] font-black uppercase tracking-[0.25em]">{t('greencarpet.transforming_steps')}</p>
            </div>

            {/* Tab Navigation */}
            <div className="px-6 mb-6 z-20 shrink-0">
                <div className="bg-white/[0.02] p-1 rounded-2xl flex border border-white/10 backdrop-blur-md">
                    <button
                        onClick={() => setActiveTab('community')}
                        className={clsx(
                            "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300",
                            activeTab === 'community' 
                                ? 'bg-gradient-to-r from-[#10B981] to-[#059669] text-white shadow-lg shadow-[#10B981]/20' 
                                : 'text-white/40 hover:text-white/60'
                        )}
                    >
                        {t('greencarpet.community')}
                    </button>
                    <button
                        onClick={() => setActiveTab('personal')}
                        className={clsx(
                            "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300",
                            activeTab === 'personal' 
                                ? 'bg-gradient-to-r from-[#10B981] to-[#059669] text-white shadow-lg shadow-[#10B981]/20' 
                                : 'text-white/40 hover:text-white/60'
                        )}
                    >
                        {t('greencarpet.personal')}
                    </button>
                </div>
            </div>

            {/* Content area */}
            <div className="flex-1 overflow-y-auto pb-24 px-6 no-scrollbar relative z-10 space-y-6">
                {activeTab === 'community' ? (
                    <div className="space-y-6">
                        {/* Main Stats Hero */}
                        <div className="relative bg-gradient-to-b from-white/[0.03] to-transparent border border-white/10 p-8 rounded-3xl flex flex-col items-center text-center overflow-hidden shadow-2xl">
                            {/* Animated Ambient background circle */}
                            <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none">
                                <div className="absolute size-48 bg-[#10B981]/20 rounded-full mix-blend-screen filter blur-[45px] animate-pulse" style={{ animationDuration: '6s' }} />
                                <div className="absolute size-40 bg-[#FF3131]/10 rounded-full mix-blend-screen filter blur-[40px] animate-pulse translate-x-12 translate-y-12" style={{ animationDuration: '8s', animationDelay: '2s' }} />
                            </div>

                            <div className="relative z-10 flex flex-col items-center w-full">
                                <div className="size-12 rounded-2xl bg-[#10B981]/15 text-[#10B981] flex items-center justify-center mb-3">
                                    <Leaf size={24} className="animate-pulse" />
                                </div>
                                <span className="text-5xl font-black italic tracking-tighter text-white">12.450,8</span>
                                <span className="text-[11px] font-bold text-[#10B981] uppercase tracking-wider mb-5">{t('greencarpet.co2_avoided')}</span>
                                
                                <div className="grid grid-cols-2 gap-4 w-full border-t border-white/5 pt-5">
                                    <div className="flex flex-col bg-white/[0.01] p-3 rounded-2xl border border-white/[0.03]">
                                        <span className="text-xl font-black text-white/90">85.420</span>
                                        <span className="text-[9px] text-white/30 font-bold uppercase tracking-wider">{t('greencarpet.kilometers')}</span>
                                    </div>
                                    <div className="flex flex-col bg-white/[0.01] p-3 rounded-2xl border border-white/[0.03]">
                                        <span className="text-xl font-black text-white/90">12.413</span>
                                        <span className="text-[9px] text-white/30 font-bold uppercase tracking-wider">{t('greencarpet.journeys')}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* High-Fidelity SVG Area Trend Chart */}
                        <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-5 shadow-xl relative overflow-hidden">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-sm font-black uppercase italic tracking-tighter text-white">{t('greencarpet.trend_title')}</h3>
                                    <p className="text-[9px] font-bold text-white/40 uppercase tracking-wider">{t('greencarpet.trend_desc')}</p>
                                </div>
                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 rounded-lg border border-white/10">
                                    <Calendar size={12} className="text-white/40" />
                                    <span className="text-[9px] font-bold text-white/60">H1 2026</span>
                                </div>
                            </div>

                            {/* Responsive SVG Chart */}
                            <div className="w-full h-44 relative">
                                <svg viewBox="0 0 500 200" className="w-full h-full" preserveAspectRatio="none">
                                    <defs>
                                        <linearGradient id="chartAreaGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#10B981" stopOpacity="0.25" />
                                            <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
                                        </linearGradient>
                                        <linearGradient id="chartStrokeGrad" x1="0" y1="0" x2="1" y2="0">
                                            <stop offset="0%" stopColor="#FF3131" />
                                            <stop offset="50%" stopColor="#FFBD31" />
                                            <stop offset="100%" stopColor="#10B981" />
                                        </linearGradient>
                                        <filter id="chartGlow" x="-20%" y="-20%" width="140%" height="140%">
                                            <feGaussianBlur stdDeviation="5" result="blur" />
                                            <feMerge>
                                                <feMergeNode in="blur" />
                                                <feMergeNode in="SourceGraphic" />
                                            </feMerge>
                                        </filter>
                                    </defs>

                                    {/* Grid Lines */}
                                    <line x1="50" y1="40" x2="470" y2="40" stroke="rgba(255,255,255,0.04)" strokeDasharray="3,3" />
                                    <line x1="50" y1="80" x2="470" y2="80" stroke="rgba(255,255,255,0.04)" strokeDasharray="3,3" />
                                    <line x1="50" y1="120" x2="470" y2="120" stroke="rgba(255,255,255,0.04)" strokeDasharray="3,3" />
                                    <line x1="50" y1="160" x2="470" y2="160" stroke="rgba(255,255,255,0.04)" strokeDasharray="3,3" />

                                    {/* Y-Axis Value Labels */}
                                    <text x="35" y="44" fill="rgba(255,255,255,0.3)" fontSize="10" fontWeight="bold" textAnchor="end">12k</text>
                                    <text x="35" y="84" fill="rgba(255,255,255,0.3)" fontSize="10" fontWeight="bold" textAnchor="end">9k</text>
                                    <text x="35" y="124" fill="rgba(255,255,255,0.3)" fontSize="10" fontWeight="bold" textAnchor="end">6k</text>
                                    <text x="35" y="164" fill="rgba(255,255,255,0.3)" fontSize="10" fontWeight="bold" textAnchor="end">3k</text>

                                    {/* Area Fill */}
                                    <path 
                                        d="M 50,180 L 50,160 L 130,135 L 210,105 L 290,75 L 370,50 L 450,35 L 450,180 Z" 
                                        fill="url(#chartAreaGrad)" 
                                    />

                                    {/* Gradient Line (Glowing) */}
                                    <path 
                                        d="M 50,160 L 130,135 L 210,105 L 290,75 L 370,50 L 450,35" 
                                        fill="none" 
                                        stroke="url(#chartStrokeGrad)" 
                                        strokeWidth="3.5" 
                                        strokeLinecap="round"
                                        filter="url(#chartGlow)"
                                    />

                                    {/* Interactive Nodes */}
                                    <circle cx="50" cy="160" r="4.5" fill="#FF3131" stroke="#050505" strokeWidth="1.5" />
                                    <circle cx="130" cy="135" r="4.5" fill="#FF8A31" stroke="#050505" strokeWidth="1.5" />
                                    <circle cx="210" cy="105" r="4.5" fill="#FFBD31" stroke="#050505" strokeWidth="1.5" />
                                    <circle cx="290" cy="75" r="4.5" fill="#B1D131" stroke="#050505" strokeWidth="1.5" />
                                    <circle cx="370" cy="50" r="4.5" fill="#58C85E" stroke="#050505" strokeWidth="1.5" />
                                    <circle cx="450" cy="35" r="4.5" fill="#10B981" stroke="#050505" strokeWidth="1.5" />

                                    {/* Values above nodes */}
                                    <text x="50" y="148" fill="white" fontSize="9" fontWeight="black" textAnchor="middle" opacity="0.6">1.2k</text>
                                    <text x="130" y="123" fill="white" fontSize="9" fontWeight="black" textAnchor="middle" opacity="0.6">3.4k</text>
                                    <text x="210" y="93" fill="white" fontSize="9" fontWeight="black" textAnchor="middle" opacity="0.6">6.1k</text>
                                    <text x="290" y="63" fill="white" fontSize="9" fontWeight="black" textAnchor="middle" opacity="0.6">8.9k</text>
                                    <text x="370" y="38" fill="white" fontSize="9" fontWeight="black" textAnchor="middle" opacity="0.6">11.2k</text>
                                    <text x="450" y="23" fill="#10B981" fontSize="9" fontWeight="black" textAnchor="middle">12.4k</text>

                                    {/* X-Axis Labels */}
                                    <text x="50" y="194" fill="rgba(255,255,255,0.4)" fontSize="10" fontWeight="bold" textAnchor="middle">{months[0]}</text>
                                    <text x="130" y="194" fill="rgba(255,255,255,0.4)" fontSize="10" fontWeight="bold" textAnchor="middle">{months[1]}</text>
                                    <text x="210" y="194" fill="rgba(255,255,255,0.4)" fontSize="10" fontWeight="bold" textAnchor="middle">{months[2]}</text>
                                    <text x="290" y="194" fill="rgba(255,255,255,0.4)" fontSize="10" fontWeight="bold" textAnchor="middle">{months[3]}</text>
                                    <text x="370" y="194" fill="rgba(255,255,255,0.4)" fontSize="10" fontWeight="bold" textAnchor="middle">{months[4]}</text>
                                    <text x="450" y="194" fill="rgba(255,255,255,0.4)" fontSize="10" fontWeight="bold" textAnchor="middle">{months[5]}</text>
                                </svg>
                            </div>
                        </div>

                        {/* Investor Metrics Grid */}
                        <div className="space-y-3">
                            <h3 className="text-xs font-black uppercase tracking-widest text-white/40 px-1">{t('greencarpet.investor_title')}</h3>
                            
                            <div className="grid grid-cols-3 gap-3">
                                {/* SDG ALIGNMENT */}
                                <div className="bg-white/[0.02] border border-white/[0.06] p-4 rounded-2xl flex flex-col justify-between h-32 hover:border-[#10B981]/20 transition-all">
                                    <div className="size-8 rounded-lg bg-[#10B981]/10 text-[#10B981] flex items-center justify-center">
                                        <ShieldCheck size={16} />
                                    </div>
                                    <div>
                                        <span className="text-xl font-black tracking-tight text-white">98.2%</span>
                                        <p className="text-[8px] font-bold text-white/50 uppercase leading-none mt-1">{t('greencarpet.sdg_alignment_title')}</p>
                                    </div>
                                </div>

                                {/* CARBON CREDITS */}
                                <div className="bg-white/[0.02] border border-white/[0.06] p-4 rounded-2xl flex flex-col justify-between h-32 hover:border-[#10B981]/20 transition-all">
                                    <div className="size-8 rounded-lg bg-[#10B981]/10 text-[#10B981] flex items-center justify-center">
                                        <Leaf size={16} />
                                    </div>
                                    <div>
                                        <span className="text-xl font-black tracking-tight text-white">12,45 t</span>
                                        <p className="text-[8px] font-bold text-white/50 uppercase leading-none mt-1">{t('greencarpet.carbon_credits_title')}</p>
                                    </div>
                                </div>

                                {/* MoM GROWTH */}
                                <div className="bg-white/[0.02] border border-white/[0.06] p-4 rounded-2xl flex flex-col justify-between h-32 hover:border-[#10B981]/20 transition-all">
                                    <div className="size-8 rounded-lg bg-[#10B981]/10 text-[#10B981] flex items-center justify-center">
                                        <TrendingUp size={16} />
                                    </div>
                                    <div>
                                        <span className="text-xl font-black tracking-tight text-white">+28.4%</span>
                                        <p className="text-[8px] font-bold text-white/50 uppercase leading-none mt-1">{t('greencarpet.growth_rate_title')}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Ecological Equivalencies */}
                        <div className="space-y-3">
                            <h3 className="text-xs font-black uppercase tracking-widest text-white/40 px-1">Equivalencias Ecológicas</h3>
                            {[
                                { 
                                    icon: TreePine, 
                                    title: t('greencarpet.trees_title', '568 Árboles'), 
                                    desc: t('greencarpet.trees_desc', 'Capacidad de absorción de CO₂ anual'), 
                                    color: 'text-emerald-400',
                                    bgColor: 'bg-emerald-500/10'
                                },
                                { 
                                    icon: Droplets, 
                                    title: t('greencarpet.liters_title', '5.413 Litros'), 
                                    desc: t('greencarpet.liters_desc', 'Combustible fósil ahorrado'), 
                                    color: 'text-blue-400',
                                    bgColor: 'bg-blue-500/10'
                                },
                                { 
                                    icon: Zap, 
                                    title: t('greencarpet.clean_energy_title', '14.8 MWh'), 
                                    desc: t('greencarpet.clean_energy_desc', 'Energía limpia equivalente generada'), 
                                    color: 'text-amber-400',
                                    bgColor: 'bg-amber-500/10'
                                }
                            ].map((item, i) => (
                                <div 
                                    key={i} 
                                    className="bg-white/[0.02] p-4.5 rounded-2xl border border-white/[0.06] flex items-center justify-between hover:bg-white/[0.04] transition-all group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`size-11 rounded-xl ${item.bgColor} flex items-center justify-center ${item.color} group-hover:scale-105 transition-transform`}>
                                            <item.icon size={22} />
                                        </div>
                                        <div>
                                            <p className="font-black uppercase italic text-sm text-white">{item.title}</p>
                                            <p className="text-[9px] font-bold text-white/40 uppercase tracking-wide leading-tight mt-0.5">{item.desc}</p>
                                        </div>
                                    </div>
                                    <ArrowUpRight size={16} className="text-white/20 group-hover:text-white/60 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6 animate-fade-in">
                        {/* Personal Stats Card */}
                        <div className="relative bg-gradient-to-b from-white/[0.03] to-transparent border border-white/10 p-8 rounded-3xl flex flex-col items-center overflow-hidden shadow-2xl">
                            {/* Personal Blur Glow */}
                            <div className="absolute size-40 bg-[#10B981]/15 rounded-full filter blur-[40px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />

                            <div className="size-20 rounded-2xl border-2 border-[#10B981] p-1 mb-4 overflow-hidden relative z-10">
                                <img
                                    src={user?.profile?.avatar_url || `https://ui-avatars.com/api/?name=${user?.email || 'User'}&background=10B981&color=fff`}
                                    className="size-full rounded-xl object-cover"
                                    alt="User Profile"
                                />
                            </div>
                            <span className="text-4xl font-black italic tracking-tighter text-white">42,3</span>
                            <span className="text-[11px] font-bold text-[#10B981] uppercase tracking-wider">{t('greencarpet.your_co2')}</span>
                            
                            {/* Progress Ring / Bar */}
                            <div className="w-full mt-6 space-y-1.5 border-t border-white/5 pt-5">
                                <div className="flex justify-between text-[9px] font-bold uppercase tracking-wider text-white/40">
                                    <span>Nivel de Aporte</span>
                                    <span className="text-white/80">42.3 / 100 kg</span>
                                </div>
                                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-[#10B981] to-[#059669] rounded-full" style={{ width: '42.3%' }} />
                                </div>
                            </div>
                        </div>

                        {/* Achievements */}
                        <div className="bg-gradient-to-br from-[#10B981] to-[#059669] p-6.5 rounded-3xl text-black shadow-lg shadow-[#10B981]/25 relative overflow-hidden group">
                            {/* Card Background Glow */}
                            <div className="absolute -top-12 -right-12 size-36 bg-white/10 rounded-full filter blur-xl group-hover:scale-110 transition-transform duration-500" />
                            
                            <ShieldCheck size={36} className="mb-3 text-black animate-pulse" />
                            <h3 className="text-xl font-black uppercase italic tracking-tighter mb-1.5">{t('greencarpet.eco_elite')}</h3>
                            <p className="text-[11px] font-bold uppercase opacity-75 leading-snug">
                                {t('greencarpet.eco_elite_desc')}
                            </p>
                        </div>

                        {/* Contribution Breakdowns */}
                        <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-5 shadow-xl space-y-4">
                            <div className="flex items-center gap-2">
                                <Target size={16} className="text-[#10B981]" />
                                <h3 className="text-xs font-black uppercase tracking-wider text-white/80">Metas Ecológicas</h3>
                            </div>
                            
                            <div className="space-y-3">
                                <div className="bg-white/[0.02] border border-white/[0.04] p-3.5 rounded-2xl flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-bold text-white">Próximo Emblema</p>
                                        <p className="text-[9px] text-white/40 uppercase tracking-wide mt-0.5">Llegar a 100 kg CO₂ evitado</p>
                                    </div>
                                    <span className="text-xs font-black text-[#10B981]">42.3%</span>
                                </div>
                                <div className="bg-white/[0.02] border border-white/[0.04] p-3.5 rounded-2xl flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-bold text-white font-display">Eco Héroe</p>
                                        <p className="text-[9px] text-white/40 uppercase tracking-wide mt-0.5">Evitar emisiones de 1 vuelo</p>
                                    </div>
                                    <span className="text-xs font-black text-white/30">Pendiente</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}


            </div>
        </div>
    );
};
