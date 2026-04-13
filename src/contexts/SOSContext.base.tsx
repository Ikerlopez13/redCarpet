import { createContext, useContext } from 'react';
import type { FamilyGroup } from '../services/database.types';

export interface SOSContextType {
    isSOSModalOpen: boolean;
    initialMode?: 'discrete' | 'visible';
    openSOSModal: (initialMode?: 'discrete' | 'visible', forceImmediate?: boolean) => void;
    closeSOSModal: () => void;
    openPaywall: (feature?: string) => void;
    familyGroup: FamilyGroup | null;
}

export const SOSContext = createContext<SOSContextType | undefined>(undefined);

export function useSOS() {
    const context = useContext(SOSContext);
    if (context === undefined) {
        throw new Error('useSOS must be used within a SOSProvider');
    }
    return context;
}
