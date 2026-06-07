# Red Carpet Safe Score - ETL Pipeline

Este directorio contiene los scripts de ingesta de datos (ETL) necesarios para poblar la base de datos propietaria de Supabase con información de OpenStreetMap, Ministerio del Interior (MIR) y Datos Abiertos Municipales.

Con esta información, el motor matemático de `pgRouting` podrá calcular la **Ruta Segura** (evitando zonas aisladas, oscuras y con alta criminalidad).

## Requisitos Previos

1. Asegúrate de tener Node.js instalado.
2. Clona el proyecto y ve a este directorio:
   ```bash
   cd scripts/safe-score-etl
   ```
3. Instala las dependencias:
   ```bash
   npm install
   ```
4. Configura tus variables de entorno en un archivo `.env` en la raíz del proyecto (o se cogerán automáticamente si ya existe `VITE_SUPABASE_URL` y `VITE_SUPABASE_SERVICE_ROLE_KEY`).

## Scripts Disponibles

El pipeline está dividido en 3 procesos independientes que pueden correrse por separado o todos a la vez.

### 1. Ingesta de Criminalidad (MIR)
Descarga y procesa el CSV del Portal Estadístico de Criminalidad. Ajusta el `crime_index` de los distritos en base a los delitos violentos, agresiones sexuales y hurtos.
```bash
npm run sync:mir
```

### 2. Ingesta de Datos Municipales (Alumbrado)
Descarga los archivos GeoJSON de farolas/cámaras de los portales Open Data (ej. datos.madrid.es, Barcelona Open Data) y cruza espacialmente la luz con las calles.
```bash
npm run sync:city
```

### 3. Ingesta del Grafo (OpenStreetMap)
Descarga el mapa de calles (vías peatonales, carriles bici, carreteras) desde la API de Overpass y genera las aristas (Edges) en la tabla `rc_street_edges` de Supabase.
```bash
npm run sync:osm
```

### Ejecutar todo el Pipeline
Si quieres actualizar todo el ecosistema de golpe (recomendado hacerlo 1 vez al mes en un servidor dedicado):
```bash
npm run sync:all
```

## Arquitectura de Datos

- **Supabase / PostGIS:** Actúa como nuestro Data Warehouse geolocalizado.
- **pgRouting:** Ejecuta el Algoritmo de Dijkstra dinámicamente cuando un usuario solicita una ruta.
- **Node.js Scripts:** Se encargan del trabajo sucio de limpiar CSVs/JSONs dispares y meterlos organizados en la BD.
