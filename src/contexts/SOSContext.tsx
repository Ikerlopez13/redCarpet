import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { getFamilyData } from '../services/familyService';
import type { FamilyGroup } from '../services/database.types';
import { checkEmergencyConsent } from '../components/Legal/EmergencyConsentModal';
import { useAuth } from './AuthContext';
import { SOSContext, useSOS } from './SOSContext.base';

export { useSOS };

export function SOSProvider({ children }: { children: ReactNode }) {
    const [isSOSModalOpen, setIsSOSModalOpen] = useState(false);
    const [initialMode, setInitialMode] = useState<'discrete' | 'visible' | undefined>(undefined);
    const [showConsent, setShowConsent] = useState(false);
    const [familyGroup, setFamilyGroup] = useState<FamilyGroup | null>(null);
    const [isConfigured, setIsConfigured] = useState<boolean>(true); // Default to true to prevent flash
    const { user } = useAuth();

    useEffect(() => {
        const checkConfig = async () => {
            const { value } = await (await import('@capacitor/preferences')).Preferences.get({ key: 'sos_config' });
            const { value: completed } = await (await import('@capacitor/preferences')).Preferences.get({ key: 'sos_config_completed' });
            setIsConfigured(!!value || completed === 'true' || localStorage.getItem('sos_config_completed') === 'true');
        };
        checkConfig();

        if (user) {
            getFamilyData(user.id).then(({ group }) => {
                if (group) setFamilyGroup(group);
            });
        }
    }, [user]);

    const openSOSModal = async (mode?: 'discrete' | 'visible') => {
        setInitialMode(mode);
        const hasLocalConsent = await checkEmergencyConsent();
        const hasDBConsent = user?.profile?.privacy_policy_accepted === true;

        if (!hasLocalConsent && !hasDBConsent) {
            setShowConsent(true);
        } else {
            setIsSOSModalOpen(true);
        }
    };

    const closeSOSModal = () => setIsSOSModalOpen(false);

    const openPaywall = async (feature?: string) => {
        console.log(`Redirecting to subscription page for feature: ${feature}`);
        if (feature?.includes('Modo Discreto')) {
            window.location.hash = '/subscription';
        } else {
            window.location.reload();
        }
    };

    const handleConsentGiven = () => {
        setShowConsent(false);
        setIsSOSModalOpen(true);
    };

    // Public API for App.tsx to use for rendering the modals outside the context loop
    const providerValue = { 
        isSOSModalOpen, 
        initialMode, 
        openSOSModal, 
        closeSOSModal, 
        openPaywall, 
        familyGroup,
        // Internal state used by App.tsx
        showConsent,
        handleConsentGiven,
        setShowConsent,
        isConfigured,
        setIsConfigured
    };

    return (
        <SOSContext.Provider value={providerValue as any}>
            {children}
        </SOSContext.Provider>
    );
}
