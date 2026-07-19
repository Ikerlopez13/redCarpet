// Paleta compartida con ReportDangerModal: un color por tipo de incidencia.
// La clave es la etiqueta que se guarda en danger_zones.description ("Etiqueta - SUBTÍTULO").
export const INCIDENT_COLORS: Record<string, string> = {
    'poca luz': '#eab308',
    'ambiente inseguro': '#ef4444',
    'acceso limitado': '#a855f7',
    'acceso seguro': '#22c55e',
    'zona inclusiva': '#ec4899',
    'calle cortada': '#f97316',
    'calle en mal estado': '#14b8a6',
    'autoridades presentes': '#3b82f6',
    // Etiquetas de versiones anteriores del modal que siguen vivas en la BD
    'seguridad': '#3b82f6',
};

export const DEFAULT_INCIDENT_COLOR = '#f59e0b';

export function getIncidentColor(title?: string): string {
    if (!title) return DEFAULT_INCIDENT_COLOR;
    return INCIDENT_COLORS[title.trim().toLowerCase()] ?? DEFAULT_INCIDENT_COLOR;
}
