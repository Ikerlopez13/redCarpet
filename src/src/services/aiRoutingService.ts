// src/services/aiRoutingService.ts

/**
 * AI Adaptive Night Mode Service
 * Analyzes time of day, estimated light levels, and activity to prioritize
 * well-lit streets and avoid risky zones based on historical data.
 */

// Simple time-based heuristic for MVP
export function isNightTime(): boolean {
    const hour = new Date().getHours();
    // Night is considered from 19:00 to 06:59
    return hour >= 19 || hour < 7;
}

/**
 * Mocks the AI analysis of a route
 */
export function analyzeRouteSecurity() {
    const nightModeActive = isNightTime();

    return {
        isNightModeActive: nightModeActive,
        riskLevel: nightModeActive ? 'medium' : 'low',
        description: nightModeActive
            ? '🌙 AI Night Mode Activo: Ruta optimizada evitando parques y callejones. Priorizando avenidas con alumbrado público y comercios.'
            : 'Calles principales y transitadas.',
        aiAdjustmentsApplied: nightModeActive
    };
}
