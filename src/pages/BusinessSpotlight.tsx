import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Store, MapPin, Phone, Globe, Loader2, CheckCircle2 } from 'lucide-react';
import { Browser } from '@capacitor/browser';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabaseClient';

const CATEGORIES = [
  { id: 'restaurant', label: '🍽 Restaurante' },
  { id: 'bar', label: '🍺 Bar / Café' },
  { id: 'shop', label: '🛍 Tienda' },
  { id: 'hotel', label: '🏨 Hotel / Alojamiento' },
  { id: 'health', label: '⚕️ Salud / Farmacia' },
  { id: 'services', label: '🔧 Servicios' },
  { id: 'beauty', label: '💈 Belleza / Estética' },
  { id: 'general', label: '📍 Otro' },
];

export const BusinessSpotlight: React.FC = () => {
  const navigate = useNavigate();
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
  const [myListingId, setMyListingId] = useState<string | null>(null);
  const [isPaid, setIsPaid] = useState(false);

  const locateMe = async () => {
    setLocating(true);
    try {
      const { Geolocation } = await import('@capacitor/geolocation');
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 8000 });
      setLat(pos.coords.latitude);
      setLng(pos.coords.longitude);
    } catch {
      setError('No se pudo obtener la ubicación. Activa el GPS.');
    } finally {
      setLocating(false);
    }
  };

  const handleSubmitAndPay = async () => {
    if (!user) return;
    if (!name.trim()) { setError('El nombre del negocio es obligatorio.'); return; }
    if (!lat || !lng) { setError('Necesitamos tu ubicación. Pulsa "Usar mi ubicación actual".'); return; }

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

      if (dbErr || !data) throw new Error(dbErr?.message || 'Error guardando el negocio');

      const listingId = data.id;
      setMyListingId(listingId);

      // 2. Crear sesión de pago en Stripe
      const r = await fetch('https://tryredcarpet.com/api/create-business-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, listingId })
      });
      const session = await r.json();

      if (!session.url) throw new Error(session.error || 'Error al crear el pago');

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
      setError(e.message || 'Error inesperado');
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
    else setError('El pago aún no se ha confirmado. Espera unos segundos y vuelve a intentarlo.');
    setSubmitting(false);
  };

  if (isPaid) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-8 text-center bg-[#0d0d0d] text-white">
        <div className="size-24 rounded-[2rem] bg-amber-400/20 flex items-center justify-center mb-6 shadow-[0_0_60px_rgba(251,191,36,0.3)]">
          <CheckCircle2 size={56} className="text-amber-400" />
        </div>
        <h1 className="text-3xl font-black italic uppercase tracking-tighter mb-2">¡Negocio Activo!</h1>
        <p className="text-white/60 text-sm mb-2">{name} ya aparece destacado en el mapa de RedCarpet.</p>
        <p className="text-white/30 text-xs mb-8">Los usuarios verán tu pin dorado y podrán ver los detalles de tu negocio.</p>
        <button onClick={() => navigate('/')} className="h-12 px-8 bg-amber-400 text-amber-900 rounded-xl font-black uppercase tracking-widest text-sm">
          Ver en el mapa
        </button>
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
          <h1 className="text-xl font-black uppercase italic tracking-tighter">Destaca tu negocio</h1>
          <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Pin dorado en el mapa · 50€/mes</p>
        </div>
        <div className="size-10 rounded-xl bg-amber-400/20 flex items-center justify-center">
          <Store size={20} className="text-amber-400" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5 no-scrollbar pb-32">
        {/* Propuesta de valor */}
        <div className="bg-amber-400/10 border border-amber-400/30 rounded-2xl p-4 space-y-2">
          <p className="text-amber-400 font-black uppercase text-xs tracking-widest">¿Qué consigues?</p>
          {['Pin dorado visible en el mapa para todos los usuarios', 'Tu nombre y descripción al tocar el pin', 'Enlace a tu web y teléfono directo', 'Actualizable en cualquier momento'].map((f, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="size-1.5 rounded-full bg-amber-400" />
              <p className="text-white/70 text-xs">{f}</p>
            </div>
          ))}
        </div>

        {/* Formulario */}
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-white/40 block mb-1">Nombre del negocio *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej: Bar El Rincón"
              className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-white placeholder-white/20 text-sm focus:outline-none focus:border-amber-400/50"
            />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-white/40 block mb-1">Categoría</label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`h-10 rounded-xl text-xs font-bold border transition-all ${category === cat.id ? 'bg-amber-400/20 border-amber-400/50 text-amber-400' : 'bg-white/5 border-white/10 text-white/50'}`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-white/40 block mb-1">Descripción breve</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Ej: Cocina tradicional catalana, menú del día..."
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 text-sm focus:outline-none focus:border-amber-400/50 resize-none"
            />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-white/40 block mb-1">Dirección</label>
            <input
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="Calle, número, ciudad"
              className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-white placeholder-white/20 text-sm focus:outline-none focus:border-amber-400/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-white/40 block mb-1">
                <Phone size={10} className="inline mr-1" />Teléfono
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

          {/* Ubicación */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-white/40 block mb-1">
              <MapPin size={10} className="inline mr-1" />Ubicación en el mapa *
            </label>
            {lat && lng ? (
              <div className="h-12 bg-green-500/10 border border-green-500/30 rounded-xl flex items-center px-4 gap-2">
                <MapPin size={16} className="text-green-400 shrink-0" />
                <span className="text-green-400 text-xs font-bold">{lat.toFixed(5)}, {lng.toFixed(5)}</span>
                <button onClick={() => { setLat(null); setLng(null); }} className="ml-auto text-white/30 text-xs">Cambiar</button>
              </div>
            ) : (
              <button
                onClick={locateMe}
                disabled={locating}
                className="w-full h-12 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center gap-2 text-white/50 hover:text-white transition-colors"
              >
                {locating ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}
                <span className="text-xs font-bold uppercase tracking-widest">
                  {locating ? 'Obteniendo ubicación...' : 'Usar mi ubicación actual'}
                </span>
              </button>
            )}
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
          {submitting ? <Loader2 size={20} className="animate-spin" /> : <><Store size={18} /> Destacar negocio · 50€/mes</>}
        </button>
        {myListingId && !isPaid && (
          <button onClick={verifyPayment} disabled={submitting} className="w-full h-10 bg-white/5 border border-white/10 rounded-xl text-white/40 font-bold text-xs uppercase tracking-widest">
            Ya pagué · Verificar activación
          </button>
        )}
        <p className="text-center text-white/20 text-[9px] uppercase tracking-widest">
          Pago seguro con Stripe · Cancela en cualquier momento
        </p>
      </div>
    </div>
  );
};
