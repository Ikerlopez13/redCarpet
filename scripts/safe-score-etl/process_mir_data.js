import fs from 'fs';
import csv from 'csv-parser';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * process_mir_data.js
 * 
 * Este script simula la ingesta del CSV del Portal Estadístico de Criminalidad (MIR).
 * 1. Lee un CSV con tasas de criminalidad por Distrito/Municipio.
 * 2. Cruza esa información con los distritos en nuestra base de datos.
 * 3. Actualiza el "crime_index" en Supabase para las calles que estén dentro de esos polígonos.
 */

async function processMirData() {
  console.log('🚔 Iniciando procesamiento de datos del Ministerio del Interior (MIR)...');
  
  // Simulamos que hemos descargado el CSV oficial del trimestre
  const mockMirData = [
    { municipio: 'Madrid', distrito: 'Centro', delitos_violentos: 1500, agresiones_sexuales: 45, hurtos: 8000 },
    { municipio: 'Madrid', distrito: 'Salamanca', delitos_violentos: 300, agresiones_sexuales: 5, hurtos: 3000 },
    { municipio: 'Barcelona', distrito: 'Ciutat Vella', delitos_violentos: 2100, agresiones_sexuales: 60, hurtos: 15000 },
  ];

  for (const record of mockMirData) {
    // Calculamos un índice de peligrosidad bruto
    // Ponderación (basada en el plan): Violentos (35%), Sexuales (25%), Hurtos (15%)
    // Como los números absolutos varían, usamos una fórmula normalizada (simplificada aquí para el MVP)
    const rawDangerScore = (record.delitos_violentos * 0.35) + (record.agresiones_sexuales * 0.25) + (record.hurtos * 0.15);
    
    // Normalizamos el score a un valor entre 0 y 10 (10 = máximo peligro)
    const normalizedCrimeIndex = Math.min(10, rawDangerScore / 1000); 

    console.log(`[MIR] ${record.municipio} - ${record.distrito}: Riesgo Calculado -> ${normalizedCrimeIndex.toFixed(2)} / 10`);

    // En un entorno de producción con PostGIS, lanzaríamos un UPDATE espacial:
    // UPDATE rc_street_edges SET crime_index = $1 
    // FROM districts WHERE districts.name = $2 AND ST_Contains(districts.geom, rc_street_edges.geom)
    
    // Aquí hacemos un dummy call para ejemplificar la estructura:
    const { error } = await supabase.rpc('update_crime_index_by_district', {
      p_municipio: record.municipio,
      p_distrito: record.distrito,
      p_crime_index: normalizedCrimeIndex
    });

    if (error && error.code !== '42883') { // Ignorar error si la función no existe en este MVP
      console.warn(`⚠️ Aviso al actualizar ${record.distrito}:`, error.message);
    }
  }

  console.log('✅ Datos del MIR procesados correctamente.');
}

processMirData().catch(console.error);
