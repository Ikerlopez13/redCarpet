import React, { useEffect, useState } from 'react';
import { Marker } from 'react-map-gl/mapbox';
import { Store } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';

interface BusinessListing {
  id: string;
  name: string;
  description?: string;
  category?: string;
  lat: number;
  lng: number;
  phone?: string;
  website?: string;
}

interface BusinessMarkersProps {
  onBusinessClick?: (biz: BusinessListing) => void;
}

export const BusinessMarkers: React.FC<BusinessMarkersProps> = ({ onBusinessClick }) => {
  const [businesses, setBusinesses] = useState<BusinessListing[]>([]);

  useEffect(() => {
    const fetchBusinesses = async () => {
      const { data } = await supabase
        .from('business_listings')
        .select('id, name, description, category, lat, lng, phone, website')
        .eq('is_active', true);
      if (data) setBusinesses(data);
    };

    fetchBusinesses();

    const channel = supabase
      .channel('business-listings-map')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'business_listings' }, fetchBusinesses)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  if (businesses.length === 0) return null;

  return (
    <>
      {businesses.map(biz => (
        <Marker
          key={biz.id}
          latitude={biz.lat}
          longitude={biz.lng}
          anchor="bottom"
        >
          <div
            className="flex flex-col items-center gap-1 cursor-pointer group"
            onClick={() => onBusinessClick?.(biz)}
          >
            {/* Pin dorado con icono de tienda */}
            <div className="relative size-10 rounded-full bg-amber-400 border-2 border-amber-200 flex items-center justify-center shadow-lg shadow-amber-400/40 group-hover:scale-110 transition-transform">
              <Store size={18} className="text-amber-900" />
              <div className="absolute inset-0 rounded-full border-2 border-amber-300 animate-ping opacity-30 pointer-events-none" />
            </div>
            {/* Etiqueta */}
            <div className="bg-amber-400/90 backdrop-blur-md px-2 py-0.5 rounded-full shadow-md whitespace-nowrap">
              <span className="text-amber-900 text-[8px] font-black uppercase tracking-wider">{biz.name}</span>
            </div>
          </div>
        </Marker>
      ))}
    </>
  );
};
