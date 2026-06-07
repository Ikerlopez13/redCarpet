import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Madrid Bounding Box for the PoC
const BBOX = '40.4000,-3.7200,40.4300,-3.6800'; 

// Basic Overpass QL query to get highways and lighting nodes
const OVERPASS_QUERY = `
  [out:json][timeout:250];
  (
    // Get all walkable/drivable streets
    way["highway"](${BBOX});
    // Get street lamps for lighting calculations
    node["highway"="street_lamp"](${BBOX});
  );
  out body;
  >;
  out skel qt;
`;

async function fetchOSMData() {
  console.log('🌍 Fetching OSM Data via Overpass API...');
  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: 'data=' + encodeURIComponent(OVERPASS_QUERY),
  });

  if (!response.ok) {
    throw new Error(`Overpass API error: ${response.statusText}`);
  }

  const data = await response.json();
  console.log(`✅ Downloaded ${data.elements.length} OSM elements.`);
  return data.elements;
}

function calculateSafeScore(way, hasLighting, commercialDensity) {
  let cost = 1.0; // Base cost (multiplier)

  // 1. Penalties (Increase cost)
  // If it's a completely isolated path or industrial zone
  if (way.tags?.landuse === 'industrial') cost += 0.5;
  if (way.tags?.highway === 'path' && !hasLighting) cost += 0.8; // Dark path at night = high risk
  
  // 2. Rewards (Decrease cost)
  // Good lighting reduces risk
  if (hasLighting || way.tags?.lit === 'yes') {
    cost -= 0.2;
  }

  // Commercial activity reduces risk
  if (commercialDensity > 0) {
    cost -= (commercialDensity * 0.1); 
  }

  // Ensure cost never goes below 0.1
  return Math.max(0.1, cost);
}

async function processAndInsertEdges() {
  const elements = await fetchOSMData();
  
  // Create a map of nodes
  const nodes = new Map();
  const streetLamps = [];

  elements.forEach(el => {
    if (el.type === 'node') {
      nodes.set(el.id, { lat: el.lat, lon: el.lon });
      if (el.tags?.highway === 'street_lamp') {
        streetLamps.push({ lat: el.lat, lon: el.lon });
      }
    }
  });

  console.log('🔄 Processing Ways into routing edges...');
  const edges = [];

  for (const el of elements) {
    if (el.type === 'way' && el.tags?.highway) {
      // Simulate safe score calculation
      const hasLighting = el.tags.lit === 'yes'; // Simplified
      const commercialDensity = 0.5; // Simulated: Would be a spatial query to shops
      const safeCost = calculateSafeScore(el, hasLighting, commercialDensity);

      // Convert a Way with N nodes into N-1 edges
      for (let i = 0; i < el.nodes.length - 1; i++) {
        const sourceId = el.nodes[i];
        const targetId = el.nodes[i+1];
        const sourceNode = nodes.get(sourceId);
        const targetNode = nodes.get(targetId);

        if (sourceNode && targetNode) {
          edges.push({
            id: Number(`${el.id}${i}`), // Synthetic unique ID for the edge
            osm_id: el.id,
            source: sourceId,
            target: targetId,
            cost: safeCost,
            reverse_cost: el.tags.oneway === 'yes' ? 1000000 : safeCost,
            x1: sourceNode.lon,
            y1: sourceNode.lat,
            x2: targetNode.lon,
            y2: targetNode.lat,
            has_lighting: hasLighting,
            commercial_density: commercialDensity,
            // Construct a simple LineString WKT
            geom: `SRID=4326;LINESTRING(${sourceNode.lon} ${sourceNode.lat}, ${targetNode.lon} ${targetNode.lat})`
          });
        }
      }
    }
  }

  console.log(`📦 Prepared ${edges.length} edges for insertion. Sending to Supabase...`);
  
  // Insert in batches of 1000 to avoid payload limits
  const BATCH_SIZE = 1000;
  for (let i = 0; i < edges.length; i += BATCH_SIZE) {
    const batch = edges.slice(i, i + BATCH_SIZE);
    
    // In a real app, we'd use PostGIS ST_GeomFromEWKT to insert the geometry.
    // For this ETL script, we use a raw SQL call via Supabase RPC, or just insert the raw text 
    // if the table accepts string casting to Geometry.
    
    const { error } = await supabase.from('rc_street_edges').upsert(batch);
    if (error) {
      console.error('❌ Error inserting batch:', error);
    } else {
      console.log(`✅ Inserted batch ${i / BATCH_SIZE + 1} / ${Math.ceil(edges.length / BATCH_SIZE)}`);
    }
  }
  console.log('🚀 ETL Process Finished Successfully!');
}

processAndInsertEdges().catch(console.error);
