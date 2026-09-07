// Límite de rutas para usuarios GRATIS: 3 rutas al MES (se reinicia cada mes).
// Premium = ilimitado.

const FREE_MONTHLY_LIMIT = 3;
const STORAGE_KEY = 'redcarpet_monthly_routes';

interface RouteStats {
    period: string; // 'YYYY-MM'
    count: number;
}

// Periodo actual (año-mes), p.ej. "2026-08".
function currentPeriod(): string {
    return new Date().toISOString().slice(0, 7);
}

export function getRemainingRoutes(isPremium: boolean): number | 'unlimited' {
    if (isPremium) return 'unlimited';

    const period = currentPeriod();
    const stored = localStorage.getItem(STORAGE_KEY);

    if (stored) {
        try {
            const stats: RouteStats = JSON.parse(stored);
            if (stats.period === period) {
                return Math.max(0, FREE_MONTHLY_LIMIT - stats.count);
            }
        } catch (e) {
            console.error('Error parsing route stats', e);
        }
    }

    return FREE_MONTHLY_LIMIT;
}

export function canStartRoute(isPremium: boolean): boolean {
    if (isPremium) return true;
    const remaining = getRemainingRoutes(false);
    return remaining === 'unlimited' ? true : (remaining as number) > 0;
}

export function recordRouteStart(isPremium: boolean): void {
    if (isPremium) return; // Premium = ilimitado, no se cuenta

    const period = currentPeriod();
    const stored = localStorage.getItem(STORAGE_KEY);
    let stats: RouteStats = { period, count: 0 };

    if (stored) {
        try {
            const parsed: RouteStats = JSON.parse(stored);
            if (parsed.period === period) {
                stats = parsed;
            }
        } catch (e) {
            console.error('Error parsing route stats', e);
        }
    }

    stats.count += 1;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
}
