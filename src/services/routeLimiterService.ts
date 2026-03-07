// Service to manage daily route limits for free users

const FREE_DAILY_LIMIT = 3;
const STORAGE_KEY = 'redcarpet_daily_routes';

interface RouteStats {
    date: string;
    count: number;
}

export function getRemainingRoutes(isPremium: boolean): number | 'unlimited' {
    if (isPremium) return 'unlimited';

    const today = new Date().toISOString().split('T')[0];
    const stored = localStorage.getItem(STORAGE_KEY);

    if (stored) {
        try {
            const stats: RouteStats = JSON.parse(stored);
            if (stats.date === today) {
                return Math.max(0, FREE_DAILY_LIMIT - stats.count);
            }
        } catch (e) {
            console.error('Error parsing route stats', e);
        }
    }

    return FREE_DAILY_LIMIT;
}

export function canStartRoute(isPremium: boolean): boolean {
    if (isPremium) return true;
    const remaining = getRemainingRoutes(false);
    return remaining === 'unlimited' ? true : (remaining as number) > 0;
}

export function recordRouteStart(isPremium: boolean): void {
    if (isPremium) return; // Don't track if premium

    const today = new Date().toISOString().split('T')[0];
    const stored = localStorage.getItem(STORAGE_KEY);
    let stats: RouteStats = { date: today, count: 0 };

    if (stored) {
        try {
            const parsed: RouteStats = JSON.parse(stored);
            if (parsed.date === today) {
                stats = parsed;
            }
        } catch (e) {
            console.error('Error parsing route stats', e);
        }
    }

    stats.count += 1;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
}
