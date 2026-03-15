import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'com.redcarpet.help',
    appName: 'RedCarpet',
    webDir: 'dist',
    server: {
        androidScheme: 'https',
        // url: 'http://192.168.1.15:5173',
        // cleartext: true,
    },
    plugins: {
        PushNotifications: {
            presentationOptions: ['badge', 'sound', 'alert'],
        },
        SplashScreen: {
            launchAutoHide: true,
            launchShowDuration: 2000,
            backgroundColor: '#0f0808',
            androidScaleType: 'CENTER_CROP',
            showSpinner: false,
            splashFullScreen: true,
            splashImmersive: true,
        },
        StatusBar: {
            style: 'DARK',
            backgroundColor: '#1a1a1a',
        },
    },
};

export default config;
