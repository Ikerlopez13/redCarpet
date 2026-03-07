// Real RevenueCat Service Implementation
import { Capacitor } from '@capacitor/core';
import { Purchases, LOG_LEVEL } from '@revenuecat/purchases-capacitor';
import { RevenueCatUI } from '@revenuecat/purchases-capacitor-ui';
import type { PurchasesPackage, CustomerInfo } from '@revenuecat/purchases-capacitor';

export type { PurchasesPackage, CustomerInfo };

// These should be configured in your .env.production file.
// If you don't have them yet, they will show warnings but won't crash the app.
const API_KEY_IOS = import.meta.env.VITE_REVENUECAT_APPLE_KEY || 'test_ndCUkCyVbXkBpJLIuXGDlsfFvJU';
const API_KEY_ANDROID = import.meta.env.VITE_REVENUECAT_GOOGLE_KEY || 'test_ndCUkCyVbXkBpJLIuXGDlsfFvJU';

export class RevenueCatService {
    static readonly PRODUCTS = {
        MONTHLY: 'monthly',
        YEARLY: 'yearly',
        LIFETIME: 'lifetime',
    };

    static readonly ENTITLEMENT_ID = 'RedCarpet Pro';

    static async initialize(appUserId?: string) {
        if (!Capacitor.isNativePlatform()) {
            console.warn('RevenueCat is not supported on web. Running empty stub.');
            return;
        }

        try {
            await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });

            let apiKey = '';
            if (Capacitor.getPlatform() === 'ios') {
                apiKey = API_KEY_IOS;
            } else if (Capacitor.getPlatform() === 'android') {
                apiKey = API_KEY_ANDROID;
            }

            if (!apiKey || apiKey.includes('placeholder')) {
                console.error('⚠️ RevenueCat API Keys are missing! RevenueCat will not work properly.');
                return; // Optionally, depending on your setup, it might fail configure()
            }

            await Purchases.configure({
                apiKey,
                appUserID: appUserId || undefined
            });

            console.log('💳 RevenueCat initialized successfully');
        } catch (error) {
            console.error('Error initializing RevenueCat', error);
        }
    }

    static async getOfferings(): Promise<PurchasesPackage[]> {
        if (!Capacitor.isNativePlatform()) {
            return []; // Web fallback
        }

        try {
            const offerings = await Purchases.getOfferings();
            if (offerings.current !== null && offerings.current.availablePackages.length !== 0) {
                return offerings.current.availablePackages;
            }
        } catch (error) {
            console.error('Error getting offerings', error);
        }
        return [];
    }

    static async purchasePackage(rcPackage: PurchasesPackage): Promise<{ customerInfo: CustomerInfo; productIdentifier: string; } | null> {
        if (!Capacitor.isNativePlatform()) return null;

        try {
            const { customerInfo } = await Purchases.purchasePackage({ aPackage: rcPackage });
            return {
                customerInfo,
                productIdentifier: rcPackage.product.identifier
            };
        } catch (error: any) {
            if (!error.userCancelled) {
                console.error('Error purchasing package', error);
            }
            return null;
        }
    }

    static async checkEntitlement(entitlementId: string = RevenueCatService.ENTITLEMENT_ID): Promise<boolean> {
        if (!Capacitor.isNativePlatform()) return false;

        try {
            const { customerInfo } = await Purchases.getCustomerInfo();
            // This checks if there is any active entitlement with that ID
            if (customerInfo.entitlements.active[entitlementId] !== undefined) {
                return true;
            }
        } catch (error) {
            console.error('Error checking entitlements', error);
        }
        return false;
    }

    static async getCustomerInfo(): Promise<CustomerInfo | null> {
        if (!Capacitor.isNativePlatform()) return null;

        try {
            const { customerInfo } = await Purchases.getCustomerInfo();
            return customerInfo;
        } catch (error) {
            console.error('Error fetching customer info', error);
            return null;
        }
    }

    static async checkIntroEligibility(productIdentifiers: string[]): Promise<Record<string, any>> {
        if (!Capacitor.isNativePlatform()) return {};

        try {
            const eligibilityMap = await Purchases.checkTrialOrIntroductoryPriceEligibility({
                productIdentifiers
            });
            return eligibilityMap;
        } catch (error) {
            console.error('Error checking intro eligibility', error);
            return {};
        }
    }

    static async restorePurchases(): Promise<CustomerInfo | null> {
        if (!Capacitor.isNativePlatform()) return null;

        try {
            const { customerInfo } = await Purchases.restorePurchases();
            return customerInfo;
        } catch (error: any) {
            console.error('Error restoring purchases', error);
            return null;
        }
    }

    static async presentPaywall(offeringToPresent?: any): Promise<boolean> {
        if (!Capacitor.isNativePlatform()) {
            console.warn('RevenueCat UI is not supported on web. Triggering fake web purchase.');
            return true; // Fake success for web/dev
        }

        try {
            const paywallResult = await RevenueCatUI.presentPaywall({
                offering: offeringToPresent || undefined
            });
            // According to docs, paywallResult can be PURCHASED, RESTORED, CANCELLED, ERROR
            // 'PURCHASED' and 'RESTORED' mean they got access.
            if (paywallResult.result === 'PURCHASED' || paywallResult.result === 'RESTORED') {
                return true;
            }
            return false;

        } catch (error) {
            console.error('Error presenting paywall:', error);
            return false;
        }
    }

    static async presentCustomerCenter(): Promise<void> {
        if (!Capacitor.isNativePlatform()) {
            console.warn('Customer Center is not supported on web.');
            return;
        }

        try {
            await RevenueCatUI.presentCustomerCenter();
        } catch (error) {
            console.error('Error presenting Customer Center:', error);
        }
    }
}
