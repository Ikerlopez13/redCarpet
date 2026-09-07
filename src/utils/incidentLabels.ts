import type { TFunction } from 'i18next';

// Las incidencias se guardan en español (canónico) como "Etiqueta - SUBTÍTULO".
// Estos mapas las convierten a claves i18n para mostrarlas en el idioma del usuario.
export const INCIDENT_LABEL_KEYS: Record<string, string> = {
    'Poca luz': 'report.cat.dark_light',
    'Ambiente Inseguro': 'report.cat.unsafe_env',
    'Acceso limitado': 'report.cat.limited_mobility',
    'Acceso seguro': 'report.cat.safe_mobility',
    'Zona inclusiva': 'report.cat.inclusive_zone',
    'Calle cortada': 'report.cat.street_closed',
    'Calle en mal estado': 'report.cat.street_damaged',
    'Autoridades presentes': 'report.cat.security',
};

const INCIDENT_SUB_KEYS: Record<string, string> = {
    'BAJA VISIBILIDAD': 'report.sub.low_visibility',
    'PELIGRO': 'report.sub.danger',
    'MOVILIDAD REDUCIDA': 'report.sub.reduced_mobility',
    'INCLUSIVIDAD': 'report.sub.inclusivity',
    'VIALIDAD': 'report.sub.roadway',
    'SEGURIDAD': 'report.sub.safety',
};

// Categorías POSITIVAS: son alertas "buenas" (mejoran la seguridad). La ruta
// segura NO debe evitarlas — al contrario, puede preferirlas.
export const POSITIVE_INCIDENT_LABELS = new Set<string>([
    'Acceso seguro',         // acceso adaptado / seguro
    'Zona inclusiva',        // espacio inclusivo
    'Autoridades presentes', // presencia policial / seguridad
]);

/**
 * ¿Es una incidencia "buena" (a preferir, no a evitar)? Clasifica por la
 * etiqueta de la descripción canónica "Etiqueta - SUBTÍTULO".
 */
export function isPositiveIncident(desc: string | null | undefined): boolean {
    if (!desc) return false;
    const label = desc.split(' - ')[0].trim();
    return POSITIVE_INCIDENT_LABELS.has(label);
}

/** Traduce solo la etiqueta (p.ej. "Acceso seguro"). Si no la reconoce, la devuelve igual. */
export function translateIncidentLabel(label: string | null | undefined, t: TFunction): string {
    if (!label) return '';
    const key = INCIDENT_LABEL_KEYS[label.trim()];
    return key ? t(key) : label;
}

/** Traduce la descripción completa "Etiqueta - SUBTÍTULO". */
export function translateIncidentDescription(desc: string | null | undefined, t: TFunction): string {
    if (!desc) return '';
    if (desc.includes(' - ')) {
        const [rawLabel, rawSub] = desc.split(' - ');
        const l = translateIncidentLabel(rawLabel, t);
        const subKey = INCIDENT_SUB_KEYS[(rawSub || '').trim().toUpperCase()];
        const s = subKey ? t(subKey) : (rawSub || '').trim();
        return s ? `${l} - ${s}` : l;
    }
    return translateIncidentLabel(desc, t);
}
