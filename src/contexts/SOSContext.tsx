import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { SOSRequestModal } from '../components/SOS/SOSRequestModal';
import { EmergencyConsentModal, checkEmergencyConsent } from '../components/Legal/EmergencyConsentModal';
import { RevenueCatService } from '../services/revenueCatService';

interface SOSContextType {
    isSOSModalOpen: boolean;
    openSOSModal: () => void;
    closeSOSModal: () => void;
    openPaywall: (feature?: string) => void;
}

const SOSContext = createContext<SOSContextType | undefined>(undefined);

export function SOSProvider({ children }: { children: ReactNode }) {
    const [isSOSModalOpen, setIsSOSModalOpen] = useState(false);
    const [showConsent, setShowConsent] = useState(false);

    const openSOSModal = async () => {
        const hasConsent = await checkEmergencyConsent();
        if (!hasConsent) {
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
        <SOSContext.Provider value={{ isSOSModalOpen, openSOSModal, closeSOSModal, openPaywall }}>
            {children}
            <SOSRequestModal
                isOpen={isSOSModalOpen}
                onClose={closeSOSModal}
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
