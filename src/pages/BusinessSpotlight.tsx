import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Store, MapPin, Phone, Globe, Loader2, CheckCircle2, Search, X } from 'lucide-react';
import { Browser } from '@capacitor/browser';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabaseClient';
import { searchPlaces, type GeocodingResult } from '../services/geocodingService';

const CATEGORIES = [
  { id: 'restaurant', label: 'business.cat_restaurant' },
  { id: 'bar', label: 'business.cat_bar' },
  { id: 'shop', label: 'business.cat_shop' },
  { id: 'hotel', label: 'business.cat_hotel' },
  { id: 'health', label: 'business.cat_health' },
  { id: 'services', label: 'business.cat_services' },
  { id: 'beauty', label: 'business.cat_beauty' },
  { id: 'general', label: 'business.cat_other' },
];

export const BusinessSpotlight: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<GeocodingResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [myListingId, setMyListingId] = useState<string | null>(null);
  const [isPaid, setIsPaid] = useState(false);
  const [promoTier, setPromoTier] = useState<string>('none');   // none | social_49 | plus_99
  const [promoStatus, setPromoStatus] = useState<string>('none'); // none | pendiente | publicado
  const [promoSubmitting, setPromoSubmitting] = useState<string | null>(null);

  // Buscador de dirección/negocio: al escribir, geocodifica (con debounce) y muestra sugerencias.
  const handleAddressChange = (value: string) => {
    setAddress(value);
    setLat(null);
    setLng(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchPlaces(value);
        setSuggestions(results);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 350);
  };

  const selectSuggestion = (s: GeocodingResult) => {
    setAddress(s.address || s.name);
    setLat(s.lat);
    setLng(s.lng);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  // Ubicación actual: OPCIONAL, para quien esté físicamente en su negocio.
  const locateMe = async () => {
    setLocating(true);
    try {
      const { Geolocation } = await import('@capacitor/geolocation');
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 8000 });
      setLat(pos.coords.latitude);
      setLng(pos.coords.longitude);
      setShowSuggestions(false);
    } catch {
      setError(t('business.err_location'));
    } finally {
      setLocating(false);
    }
  };

  const handleSubmitAndPay = async () => {
    if (!user) return;
    if (!name.trim()) { setError(t('business.err_name')); return; }
    if (!lat || !lng) { setError(t('business.err_no_loc')); return; }

    setSubmitting(true);
    setError(null);

    try {
      // 1. Guardar el listing en Supabase con is_active = false
      const { data, error: dbErr } = await supabase
        .from('business_listings')
        .insert({
          user_id: user.id,
          name: name.trim(),
          description: description.trim() || null,
          category,
          address: address.trim() || null,
          phone: phone.trim() || null,
          website: website.trim() || null,
          lat,
          lng,
          is_active: false,
        })
        .select('id')
        .single();

      if (dbErr || !data) throw new Error(dbErr?.message || t('business.err_save'));

      const listingId = data.id;
      setMyListingId(listingId);

      // 2. Crear sesión de pago en Stripe
      const r = await fetch('https://tryredcarpet.com/api/create-business-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, listingId })
      });
      const session = await r.json();

      if (!session.url) throw new Error(session.error || t('business.err_pay'));

      // 3. Abrir Stripe Checkout
      await Browser.open({ url: session.url });

      // 4. Cuando el usuario vuelve, verificar si el listing está activo
      const { App } = await import('@capacitor/app');
      App.addListener('appStateChange', async ({ isActive }) => {
        if (isActive) {
          await new Promise(r => setTimeout(r, 2500));
          const { data: listing } = await supabase
            .from('business_listings')
            .select('is_active')
            .eq('id', listingId)
            .single();
          if (listing?.is_active) setIsPaid(true);
        }
      });
    } catch (e: any) {
      setError(e.message || t('business.err_generic'));
    } finally {
      setSubmitting(false);
    }
  };

  const verifyPayment = async () => {
    if (!myListingId) return;
    setSubmitting(true);
    const { data } = await supabase
      .from('business_listings')
      .select('is_active')
      .eq('id', myListingId)
      .single();
    if (data?.is_active) setIsPaid(true);
    else setError(t('business.err_payment'));
    setSubmitting(false);
  };

  // Contratar una promo en redes (pago único 49€/99€) sobre un negocio ya activo.
  const contractPromo = async (tier: 'social_49' | 'plus_99') => {
    if (!user || !myListingId) return;
    setPromoSubmitting(tier);
    setError(null);
    try {
      const r = await fetch('https://tryredcarpet.com/api/create-business-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, listingId: myListingId, promoTier: tier })
      });
      const session = await r.json();
      if (!session.url) throw new Error(session.error || t('business.err_pay'));
      await Browser.open({ url: session.url });

      // Al volver, comprobar si la promo quedó registrada (pendiente de publicar).
      const { App } = await import('@capacitor/app');
      App.addListener('appStateChange', async ({ isActive }) => {
        if (isActive) {
          await new Promise(res => setTimeout(res, 2500));
          const { data } = await supabase
            .from('business_listings')
            .select('promo_tier, promo_status')
            .eq('id', myListingId)
            .single();
          if (data?.promo_tier && data.promo_tier !== 'none') {
            setPromoTier(data.promo_tier);
            setPromoStatus(data.promo_status || 'pendiente');
          }
        }
      });
    } catch (e: any) {
      setError(e.message || t('business.err_generic'));
    } finally {
      setPromoSubmitting(null);
    }
  };

  if (isPaid) {
    const alreadyContracted = promoTier !== 'none';
    return (
      <div className="flex flex-col h-full bg-[#0d0d0d] text-white overflow-y-auto no-scrollbar">
        <div className="flex flex-col items-center text-center p-8 pt-14">
          <div className="size-20 rounded-[2rem] bg-amber-400/20 flex items-center justify-center mb-5 shadow-[0_0_60px_rgba(251,191,36,0.3)]">
            <CheckCircle2 size={48} className="text-amber-400" />
          </div>
          <h1 className="text-2xl font-black italic uppercase tracking-tighter mb-2">{t('business.active_title')}</h1>
          <p className="text-white/60 text-sm mb-1">{t('business.active_map_msg', { name })}</p>
          <p className="text-white/30 text-xs">{t('business.active_desc')}</p>
        </div>

        {/* Upsell: promoción en redes sociales */}
        <div className="px-6 pb-32 space-y-4">
          {alreadyContracted ? (
            <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-5 text-center">
              <p className="text-green-400 font-black uppercase text-xs tracking-widest mb-1">{t('business.promo_contracted')}</p>
              <p className="text-white/70 text-sm">
                {promoTier === 'plus_99' ? 'Promo Redes PLUS (99€)' : 'Promo Redes Sociales (49€)'} · {promoStatus === 'publicado' ? `${t('business.promo_published')} ✅` : `${t('business.promo_pending')} ⏳`}
              </p>
              <p className="text-white/30 text-xs mt-2">{t('business.promo_soon')}</p>
            </div>
          ) : (
            <>
              <div className="text-center">
                <p className="text-white font-black uppercase text-sm tracking-widest">{t('business.boost_visibility')}</p>
                <p className="text-white/40 text-xs mt-1">{t('business.boost_desc')}</p>
              </div>

              {/* Opción 49€ */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-black uppercase italic tracking-tight">{t('business.promo_social')}</p>
                  <p className="text-amber-400 font-black text-lg">49€</p>
                </div>
                <div className="space-y-1.5 mb-4">
                  {[t('business.feat_social_1'), t('business.feat_social_2'), t('business.feat_social_3')].map((f, i) => (
                    <div key={i} className="flex items-center gap-2"><div className="size-1.5 rounded-full bg-amber-400" /><p className="text-white/70 text-xs">{f}</p></div>
                  ))}
                </div>
                <button
                  onClick={() => contractPromo('social_49')}
                  disabled={!!promoSubmitting}
                  className="w-full h-11 bg-white/10 border border-white/15 rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {promoSubmitting === 'social_49' ? <Loader2 size={16} className="animate-spin" /> : `${t('business.hire')} · 49€`}
                </button>
              </div>

              {/* Opción 99€ (destacada) */}
              <div className="bg-amber-400/10 border-2 border-amber-400/50 rounded-2xl p-5 relative">
                <span className="absolute -top-2.5 left-5 bg-amber-400 text-amber-900 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full">{t('business.max_reach')}</span>
                <div className="flex items-center justify-between mb-2 mt-1">
                  <p className="font-black uppercase italic tracking-tight">{t('business.promo_plus')}</p>
                  <p className="text-amber-400 font-black text-lg">99€</p>
                </div>
                <div className="space-y-1.5 mb-4">
                  {[t('business.feat_plus_1'), t('business.feat_plus_2'), t('business.feat_plus_3'), t('business.feat_plus_4')].map((f, i) => (
                    <div key={i} className="flex items-center gap-2"><div className="size-1.5 rounded-full bg-amber-400" /><p className="text-white/80 text-xs">{f}</p></div>
                  ))}
                </div>
                <button
                  onClick={() => contractPromo('plus_99')}
                  disabled={!!promoSubmitting}
                  className="w-full h-11 bg-amber-400 text-amber-900 rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {promoSubmitting === 'plus_99' ? <Loader2 size={16} className="animate-spin" /> : `${t('business.hire')} · 99€`}
                </button>
              </div>
            </>
          )}

          {error && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>}

          <button onClick={() => navigate('/')} className="w-full h-12 bg-white/5 border border-white/10 text-white/60 rounded-xl font-bold text-sm">
            {t('business.ver_mapa')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0d0d0d] text-white overflow-hidden font-display">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 pt-12 pb-6 border-b border-white/5 shrink-0">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-white/40 hover:text-white transition-colors">
          <ChevronLeft size={24} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-black uppercase italic tracking-tighter">{t('business.headline')}</h1>
          <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">{t('business.subtitle')}</p>
        </div>
        <div className="size-10 rounded-xl bg-amber-400/20 flex items-center justify-center">
          <Store size={20} className="text-amber-400" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5 no-scrollbar pb-32">
        {/* Propuesta de valor */}
        <div className="bg-amber-400/10 border border-amber-400/30 rounded-2xl p-4 space-y-2">
          <p className="text-amber-400 font-black uppercase text-xs tracking-widest">{t('business.what_you_get')}</p>
          {[t('business.get_1'), t('business.get_2'), t('business.get_3'), t('business.get_4')].map((f, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="size-1.5 rounded-full bg-amber-400" />
              <p className="text-white/70 text-xs">{f}</p>
            </div>
          ))}
        </div>

        {/* Formulario */}
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-white/40 block mb-1">{t('business.name_label')}</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('business.name_ph')}
              className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-white placeholder-white/20 text-sm focus:outline-none focus:border-amber-400/50"
            />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-white/40 block mb-1">{t('business.cat_label')}</label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`h-10 rounded-xl text-xs font-bold border transition-all ${category === cat.id ? 'bg-amber-400/20 border-amber-400/50 text-amber-400' : 'bg-white/5 border-white/10 text-white/50'}`}
                >
                  {t(cat.label)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-white/40 block mb-1">{t('business.desc_label')}</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={t('business.desc_ph')}
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 text-sm focus:outline-none focus:border-amber-400/50 resize-none"
            />
          </div>

          {/* Buscador de negocio / dirección */}
          <div className="relative">
            <label className="text-[10px] font-black uppercase tracking-widest text-white/40 block mb-1">
              <Search size={10} className="inline mr-1" />{t('business.search_label')} *
            </label>
            <div className="relative">
              <input
                value={address}
                onChange={e => handleAddressChange(e.target.value)}
                placeholder={t('business.search_ph')}
                className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 pr-10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-amber-400/50"
              />
              {searching ? (
                <Loader2 size={16} className="animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-white/40" />
              ) : address ? (
                <button
                  onClick={() => { setAddress(''); setSuggestions([]); setShowSuggestions(false); setLat(null); setLng(null); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"
                >
                  <X size={16} />
                </button>
              ) : null}
            </div>
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-30 mt-1 w-full bg-[#1a1a1f] border border-white/10 rounded-xl overflow-hidden shadow-2xl max-h-56 overflow-y-auto">
                {suggestions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => selectSuggestion(s)}
                    className="w-full text-left px-4 py-3 flex items-start gap-2 hover:bg-white/5 border-b border-white/5 last:border-0"
                  >
                    <MapPin size={14} className="text-amber-400 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm text-white font-semibold truncate">{s.name}</p>
                      {s.address && <p className="text-[11px] text-white/40 truncate">{s.address}</p>}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {showSuggestions && !searching && suggestions.length === 0 && address.trim().length >= 3 && (
              <p className="text-[11px] text-white/30 mt-1 px-1">{t('business.no_results')}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-white/40 block mb-1">
                <Phone size={10} className="inline mr-1" />{t('i18nfix.business_phone')}
              </label>
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+34 600 000 000"
                type="tel"
                className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-white placeholder-white/20 text-sm focus:outline-none focus:border-amber-400/50"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-white/40 block mb-1">
                <Globe size={10} className="inline mr-1" />Web
              </label>
              <input
                value={website}
                onChange={e => setWebsite(e.target.value)}
                placeholder="https://..."
                type="url"
                className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-white placeholder-white/20 text-sm focus:outline-none focus:border-amber-400/50"
              />
            </div>
          </div>

          {/* Estado de la ubicación + opción de ubicación actual */}
          <div>
            {lat && lng ? (
              <div className="h-12 bg-green-500/10 border border-green-500/30 rounded-xl flex items-center px-4 gap-2">
                <CheckCircle2 size={16} className="text-green-400 shrink-0" />
                <span className="text-green-400 text-xs font-bold truncate">{t('business.location_ok')}</span>
                <button onClick={() => { setLat(null); setLng(null); }} className="ml-auto text-white/30 text-xs shrink-0">{t('business.change')}</button>
              </div>
            ) : (
              <p className="text-[11px] text-white/30 px-1">{t('business.pick_location')}</p>
            )}
            {/* Ubicación actual: opcional (para quien esté en su negocio) */}
            <button
              onClick={locateMe}
              disabled={locating}
              className="w-full mt-2 h-10 bg-transparent border border-white/10 rounded-xl flex items-center justify-center gap-2 text-white/40 hover:text-white text-[11px] font-bold uppercase tracking-widest transition-colors"
            >
              {locating ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
              {locating ? t('business.getting_location') : t('business.use_current_optional')}
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-red-400 text-xs font-bold text-center">{error}</p>
          </div>
        )}
      </div>

      {/* Bottom CTA */}
      <div className="p-6 border-t border-white/5 bg-[#0d0d0d] space-y-3 shrink-0">
        <button
          onClick={handleSubmitAndPay}
          disabled={submitting}
          className="w-full h-14 bg-amber-400 hover:bg-amber-300 text-amber-900 rounded-2xl font-black uppercase tracking-widest text-sm transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-amber-400/20"
        >
          {submitting ? <Loader2 size={20} className="animate-spin" /> : <><Store size={18} /> {t('business.headline')} · {t('i18nfix.business_price_month')}</>}
        </button>
        {myListingId && !isPaid && (
          <button onClick={verifyPayment} disabled={submitting} className="w-full h-10 bg-white/5 border border-white/10 rounded-xl text-white/40 font-bold text-xs uppercase tracking-widest">
            {t('i18nfix.business_verify_paid')}
          </button>
        )}
        <p className="text-center text-white/20 text-[9px] uppercase tracking-widest">
          {t('i18nfix.business_secure_pay')}
        </p>
      </div>
    </div>
  );
};
