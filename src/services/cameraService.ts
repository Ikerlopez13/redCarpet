import { CameraPreview } from '@capacitor-community/camera-preview';
import { stitchBeRealImage } from '../utils/canvasUtils';

export interface DualCaptureOptions {
    quality?: number;
    delayMs?: number;
}

/**
 * Executes a BeReal-style dual capture:
 * 1. Captures current view (typically Rear).
 * 2. Flips the camera.
 * 3. Waits for focus/exposure.
 * 4. Captures second view (typically Front).
 * 5. Flips back to original.
 * 6. Stitches images.
 */
export async function captureBeRealDual(options: DualCaptureOptions = {}): Promise<string> {
    const { quality = 80, delayMs = 600 } = options;

    try {
        // 1. Capture First Image (Wait for current frame)
        const result1 = await CameraPreview.capture({ quality });
        const img1 = result1.value;

        // 2. Flip Camera
        await CameraPreview.flip();

        // 3. Wait for camera transition & stabilization
        await new Promise(r => setTimeout(r, delayMs));

        // 4. Capture Second Image
        const result2 = await CameraPreview.capture({ quality });
        const img2 = result2.value;

        // 5. Flip Back to Original (Good UX)
        await CameraPreview.flip();

        // 6. Stitch them (Back, then Front)
        // We assume we started with 'rear', but if we didn't, we can pass flip logic
        // For SOS, we always start with 'rear' usually.
        return await stitchBeRealImage(img1, img2);

    } catch (err) {
        console.error('[Camera-Service] Dual capture failed:', err);
        throw err;
    }
}
