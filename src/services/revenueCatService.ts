// Real RevenueCat Service Implementation
import { Capacitor } from '@capacitor/core';
import { Purchases, LOG_LEVEL } from '@revenuecat/purchases-capacitor';
import type { PurchasesPackage, CustomerInfo } from '@revenuecat/purchases-capacitor';

export type { PurchasesPackage, CustomerInfo };

const API_KEY_IOS = import.meta.env.VITE_REVENUECAT_APPLE_KEY || 'test_ndCUkCyVbXkBpJLIuXGDlsfFvJU';
const API_KEY_ANDROID = import.meta.env.VITE_REVENUECAT_GOOGLE_KEY || 'test_ndCUkCyVbXkBpJLIuXGDlsfFvJU';

export class RevenueCatService {
    static isConfigured = false;
    static readonly PRODUCTS = {
        MONTHLY: 'monthly',
        YEARLY: 'yearly',
        LIFETIME: 'lifetime',
    };

    static readonly ENTITLEMENT_ID = 'Urban Guide Pro';

    static async initialize(appUserId?: string) {
        if (!Capacitor.isNativePlatform()) {
            console.warn('RevenueCat is not supported on web. Running empty stub.');
            return;
        }

        if (this.isConfigured) return;

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
                return;
            }

            await Purchases.configure({
                apiKey,
                appUserID: appUserId || undefined
            });

            this.isConfigured = true;
            console.log('💳 RevenueCat initialized successfully with key:', apiKey.substring(0, 8) + '...');
        } catch (error) {
            console.error('❌ Error initializing RevenueCat:', error);
            this.isConfigured = false;
        }
    }

    static async getOfferings(): Promise<PurchasesPackage[]> {
        if (!Capacitor.isNativePlatform()) {
            console.warn('⚠️ Web Mock: Simulando paquetes de RevenueCat para el navegador');
            return [
                { identifier: 'redcarpet.premium.onemonths', product: { identifier: 'redcarpet.premium.onemonths', priceString: '12,99 €', title: 'Mensual' } } as any,
                { identifier: 'redcarpet.premium.oneyear', product: { identifier: 'redcarpet.premium.oneyear', priceString: '79,99 €', title: 'Anual' } } as any,
                { identifier: 'redcarpet.premium.72h', product: { identifier: 'redcarpet.premium.72h', priceString: '4,99 €', title: 'Pase 72h' } } as any,
                { identifier: 'redcarpet.premium.family', product: { identifier: 'redcarpet.premium.family', priceString: '119,99 €', title: 'Familiar' } } as any,
            ];
        }
        
        if (!this.isConfigured) {
            console.error('❌ RevenueCat not configured. Initializing now...');
            await this.initialize();
        }

        try {
            console.log('🔍 Fetching offerings from RevenueCat...');
            const offerings = await Purchases.getOfferings();
            
            if (offerings.current !== null && offerings.current.availablePackages.length !== 0) {
                console.log(`✅ Found ${offerings.current.availablePackages.length} packages in current offering`);
                return offerings.current.availablePackages;
            }
            
            // Fallbacks in case "current" is not set but the offering exists
            if (offerings.all['default'] && offerings.all['default'].availablePackages.length !== 0) {
                console.log(`✅ Found packages in 'default' offering fallback`);
                return offerings.all['default'].availablePackages;
            }
            if (offerings.all['ofrngdd8378ed83'] && offerings.all['ofrngdd8378ed83'].availablePackages.length !== 0) {
                console.log(`✅ Found packages in 'ofrngdd8378ed83' offering fallback`);
                return offerings.all['ofrngdd8378ed83'].availablePackages;
            }
            
            console.warn('⚠️ No active offerings found in RevenueCat');
        } catch (error) {
            console.error('❌ Error getting offerings:', error);
        }
        return [];
    }
    static async getProductsByIds(identifiers: string[]): Promise<any[]> {
        if (!Capacitor.isNativePlatform() || !this.isConfigured) return [];
        try {
            const { products } = await Purchases.getProducts({ productIdentifiers: identifiers });
            return products || [];
        } catch (error) {
            console.error('❌ Error in getProductsByIds:', error);
            return [];
        }
    }

    static async purchasePackage(rcPackage: PurchasesPackage): Promise<{ customerInfo: CustomerInfo; productIdentifier: string; } | null> {
        if (!Capacitor.isNativePlatform()) {
            console.log('🌐 Web Mock: Simulando compra exitosa de', rcPackage.product.identifier);
            // Simulate native purchase modal delay
            await new Promise(resolve => setTimeout(resolve, 2000));
            return {
                customerInfo: { entitlements: { active: { [this.ENTITLEMENT_ID]: {} } } } as any,
                productIdentifier: rcPackage.product.identifier
            };
        }

        if (!this.isConfigured) {
            console.error('❌ Cannot purchase: Native/Config check failed', { isConfigured: this.isConfigured });
            return null;
        }

        try {
            console.log('🚀 Initiating purchase for:', rcPackage.product.identifier);
            const { customerInfo } = await Purchases.purchasePackage({ aPackage: rcPackage });
            console.log('💰 Purchase successful:', customerInfo);
            return {
                customerInfo,
                productIdentifier: rcPackage.product.identifier
            };
        } catch (error: any) {
            if (error.userCancelled) {
                console.log('ℹ️ User cancelled the purchase');
                return null;
            } else {
                console.error('❌ Error purchasing package:', error.message || error);
                throw error;
            }
        }
    }

    static async purchaseProductById(productIdentifier: string): Promise<{ customerInfo: CustomerInfo; productIdentifier: string; } | null> {
        if (!Capacitor.isNativePlatform()) {
            console.log('🌐 Web Mock: Simulando compra exitosa del producto', productIdentifier);
            await new Promise(resolve => setTimeout(resolve, 2000));
            return {
                customerInfo: { entitlements: { active: { [this.ENTITLEMENT_ID]: {} } } } as any,
                productIdentifier
            };
        }

        if (!this.isConfigured) {
            console.error('❌ Cannot purchase: Native/Config check failed', { isConfigured: this.isConfigured });
            return null;
        }

        try {
            console.log('🚀 Initiating direct product purchase for:', productIdentifier);
            const { products } = await Purchases.getProducts({ productIdentifiers: [productIdentifier] });
            if (!products || products.length === 0) {
                 throw new Error(`Producto ${productIdentifier} no encontrado en la tienda`);
            }
            const { customerInfo } = await Purchases.purchaseStoreProduct({ product: products[0] });
            console.log('💰 Direct purchase successful:', customerInfo);
            return {
                customerInfo,
                productIdentifier
            };
        } catch (error: any) {
            if (error.userCancelled) {
                console.log('ℹ️ User cancelled the direct purchase');
                return null;
            } else {
                console.error('❌ Error with direct product purchase:', error.message || error);
                throw error;
            }
        }
    }

    static async checkEntitlement(entitlementId: string = RevenueCatService.ENTITLEMENT_ID): Promise<boolean> {
        if (!Capacitor.isNativePlatform() || !this.isConfigured) return false;

        try {
            const { customerInfo } = await Purchases.getCustomerInfo();
            if (customerInfo.entitlements.active[entitlementId] !== undefined) {
                return true;
            }
        } catch (error) {
            console.error('Error checking entitlements', error);
        }
        return false;
    }

    static async getCustomerInfo(): Promise<CustomerInfo | null> {
        if (!Capacitor.isNativePlatform() || !this.isConfigured) return null;

        try {
            const { customerInfo } = await Purchases.getCustomerInfo();
            return customerInfo;
        } catch (error) {
            console.error('Error fetching customer info', error);
            return null;
        }
    }

    static async checkIntroEligibility(productIdentifiers: string[]): Promise<Record<string, any>> {
        if (!Capacitor.isNativePlatform() || !this.isConfigured) return {};

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
        if (!Capacitor.isNativePlatform() || !this.isConfigured) return null;

        try {
            const { customerInfo } = await Purchases.restorePurchases();
            return customerInfo;
        } catch (error: any) {
            console.error('Error restoring purchases', error);
            return null;
        }
    }

    static async presentPaywall(): Promise<boolean> {
        console.warn('RevenueCat UI (Paywalls) is not supported on this version of Capacitor. Use the custom Subscription UI instead.');
        window.location.hash = '/subscription';
        return false;
    }

    static async presentCustomerCenter(): Promise<void> {
        console.warn('Customer Center is not supported on this version of Capacitor.');
    }
}
