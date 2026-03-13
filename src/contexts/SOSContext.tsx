import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { SOSRequestModal } from '../components/SOS/SOSRequestModal';
import { EmergencyConsentModal, checkEmergencyConsent } from '../components/Legal/EmergencyConsentModal';
import { getFamilyData } from '../services/familyService';
import type { FamilyGroup } from '../services/database.types';
import { RevenueCatService } from '../services/revenueCatService';
import { useAuth } from './AuthContext';

interface SOSContextType {
    isSOSModalOpen: boolean;
    initialMode?: 'discrete' | 'visible';
    openSOSModal: (initialMode?: 'discrete' | 'visible') => void;
    closeSOSModal: () => void;
    openPaywall: (feature?: string) => void;
    familyGroup: FamilyGroup | null;
}

const SOSContext = createContext<SOSContextType | undefined>(undefined);

export function SOSProvider({ children }: { children: ReactNode }) {
    const [isSOSModalOpen, setIsSOSModalOpen] = useState(false);
    const [initialMode, setInitialMode] = useState<'discrete' | 'visible' | undefined>(undefined);
    const [showConsent, setShowConsent] = useState(false);
    const [familyGroup, setFamilyGroup] = useState<FamilyGroup | null>(null);
    const { user } = useAuth();

    useEffect(() => {
        if (user) {
            getFamilyData(user.id).then(({ group }) => {
                if (group) setFamilyGroup(group);
            });
        }
    }, [user]);

    const openSOSModal = async (mode?: 'discrete' | 'visible') => {
        setInitialMode(mode);
        // Evaluate both local preference and DB profile
        const hasLocalConsent = await checkEmergencyConsent();
        const hasDBConsent = user?.profile?.has_accepted_privacy_policy === true;

        if (!hasLocalConsent && !hasDBConsent) {
            setShowConsent(true);
        } else {
            setIsSOSModalOpen(true);
        }
    };

    const closeSOSModal = () => setIsSOSModalOpen(false);

    const openPaywall = async (feature?: string) => {
        // Feature string can be used for analytics or custom offering mappings in the future
        console.log(`Opening paywall for feature: ${feature}`);
        const success = await RevenueCatService.presentPaywall();
        if (success) {
            // Reload the app to re-fetch entitlements and re-render unrestricted UI
            window.location.reload();
        }
    };

    const handleConsentGiven = () => {
        setShowConsent(false);
        setIsSOSModalOpen(true);
    };

    return (
        <SOSContext.Provider value={{ isSOSModalOpen, initialMode, openSOSModal, closeSOSModal, openPaywall, familyGroup }}>
            {children}
            <SOSRequestModal
                isOpen={isSOSModalOpen}
                onClose={closeSOSModal}
                initialMode={initialMode}
                onRequestUpgrade={() => openPaywall('Modo Discreto')}
            />
            <EmergencyConsentModal
                isOpen={showConsent}
                onConsent={handleConsentGiven}
                onDecline={() => setShowConsent(false)}
            />
        </SOSContext.Provider>
    );
}

export function useSOS() {
    const context = useContext(SOSContext);
    if (context === undefined) {
        throw new Error('useSOS must be used within a SOSProvider');
    }
    return context;
}
