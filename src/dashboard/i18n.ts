// Dashboard strings — Spanish live, Valencian scaffolded (Task 5: bilingual-
// ready). Separate from the app's i18next catalogs on purpose: the dashboard
// ships to a different audience (Ajuntament staff) and its strings must not
// leak into the 7 mobile-app locale files. Swap language with setDashLang().

export type DashLang = 'es' | 'va';

const STRINGS: Record<DashLang, Record<string, string>> = {
    es: {
        title: 'Red Carpet — Ajuntament de València',
        nav_map: 'Mapa',
        nav_alerts: 'Alertas',
        nav_stats: 'Estadísticas',
        nav_audit: 'Auditoría',
        login_title: 'Acceso autoridades',
        login_email: 'Correo electrónico',
        login_password: 'Contraseña',
        login_submit: 'Entrar',
        login_error: 'Credenciales no válidas o usuario sin acceso al panel',
        logout: 'Cerrar sesión',
        layer_alerts: 'Alertas activas',
        layer_violeta: 'Puntos violeta',
        layer_closures: 'Cortes de calle',
        layer_incidents_7: 'Incidentes (7 días)',
        layer_incidents_30: 'Incidentes (30 días)',
        score: 'Índice de peligrosidad',
        confidence: 'Confianza',
        low_confidence: 'Datos limitados — puntuación cercana a la base municipal',
        alert_create: 'Crear alerta',
        alert_type: 'Tipo',
        alert_title: 'Título',
        alert_description: 'Descripción',
        alert_severity: 'Severidad',
        alert_radius: 'Radio (m)',
        alert_starts: 'Inicio',
        alert_expires: 'Caducidad (opcional)',
        alert_schedule: 'Horario diario (opcional)',
        alert_resolve: 'Marcar como resuelta',
        alert_delete: 'Eliminar definitivamente',
        alert_edit: 'Editar',
        alert_resolved: 'Resuelta',
        alert_active: 'Activa',
        type_street_closed: 'Calle cortada',
        type_danger_zone: 'Zona de peligro',
        type_punto_violeta: 'Punto violeta',
        type_event: 'Evento',
        type_poor_lighting: 'Iluminación deficiente',
        type_works: 'Obras',
        type_other: 'Otro',
        severity_low: 'Baja',
        severity_medium: 'Media',
        severity_high: 'Alta',
        search_placeholder: 'Buscar dirección en València…',
        click_map_hint: 'Haz clic en el mapa o busca una dirección para situar la alerta',
        stats_incidents_week: 'Incidentes por barrio y semana',
        stats_top_zones: 'Zonas más reportadas',
        stats_resolution: 'Tiempo medio de resolución de alertas',
        barrio_detail: 'Detalle del barrio',
        score_trend: 'Evolución del índice',
        data_sources: 'Fuentes de datos',
        incidents_recent: 'Incidentes recientes',
        audit_user: 'Usuario',
        audit_action: 'Acción',
        audit_when: 'Fecha',
        save: 'Guardar',
        cancel: 'Cancelar',
        loading: 'Cargando…',
        empty: 'Sin datos'
    },
    va: {
        title: 'Red Carpet — Ajuntament de València',
        nav_map: 'Mapa',
        nav_alerts: 'Alertes',
        nav_stats: 'Estadístiques',
        nav_audit: 'Auditoria',
        login_title: 'Accés autoritats',
        login_email: 'Correu electrònic',
        login_password: 'Contrasenya',
        login_submit: 'Entrar',
        login_error: 'Credencials no vàlides o usuari sense accés al panell',
        logout: 'Tancar sessió',
        layer_alerts: 'Alertes actives',
        layer_violeta: 'Punts violeta',
        layer_closures: 'Talls de carrer',
        layer_incidents_7: 'Incidents (7 dies)',
        layer_incidents_30: 'Incidents (30 dies)',
        score: 'Índex de perillositat',
        confidence: 'Confiança',
        low_confidence: 'Dades limitades — puntuació pròxima a la base municipal',
        alert_create: 'Crear alerta',
        alert_type: 'Tipus',
        alert_title: 'Títol',
        alert_description: 'Descripció',
        alert_severity: 'Severitat',
        alert_radius: 'Radi (m)',
        alert_starts: 'Inici',
        alert_expires: 'Caducitat (opcional)',
        alert_schedule: 'Horari diari (opcional)',
        alert_resolve: 'Marcar com a resolta',
        alert_delete: 'Eliminar definitivament',
        alert_edit: 'Editar',
        alert_resolved: 'Resolta',
        alert_active: 'Activa',
        type_street_closed: 'Carrer tallat',
        type_danger_zone: 'Zona de perill',
        type_punto_violeta: 'Punt violeta',
        type_event: 'Esdeveniment',
        type_poor_lighting: 'Il·luminació deficient',
        type_works: 'Obres',
        type_other: 'Altre',
        severity_low: 'Baixa',
        severity_medium: 'Mitjana',
        severity_high: 'Alta',
        search_placeholder: 'Cerca una adreça a València…',
        click_map_hint: "Fes clic al mapa o cerca una adreça per a situar l'alerta",
        stats_incidents_week: 'Incidents per barri i setmana',
        stats_top_zones: 'Zones més reportades',
        stats_resolution: "Temps mitjà de resolució d'alertes",
        barrio_detail: 'Detall del barri',
        score_trend: "Evolució de l'índex",
        data_sources: 'Fonts de dades',
        incidents_recent: 'Incidents recents',
        audit_user: 'Usuari',
        audit_action: 'Acció',
        audit_when: 'Data',
        save: 'Guardar',
        cancel: 'Cancel·lar',
        loading: 'Carregant…',
        empty: 'Sense dades'
    }
};

let lang: DashLang = (localStorage.getItem('dash_lang') as DashLang) || 'es';

export function setDashLang(l: DashLang) {
    lang = l;
    localStorage.setItem('dash_lang', l);
}

export function getDashLang(): DashLang {
    return lang;
}

export function dt(key: string): string {
    return STRINGS[lang][key] ?? STRINGS.es[key] ?? key;
}
