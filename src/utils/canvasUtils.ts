/**
 * Stitches two images into a BeReal-style Picture-in-Picture layout.
 * @param backBase64 The background image (Rear camera)
 * @param frontBase64 The foreground image (Front camera)
 * @returns Combined base64 image string
 */
export async function stitchBeRealImage(backBase64: string, frontBase64: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject('Could not get canvas context');

        const backImg = new Image();
        const frontImg = new Image();

        backImg.onload = () => {
            // Set canvas size to match back image (1080x1440 ratio usually)
            canvas.width = backImg.width;
            canvas.height = backImg.height;

            // Draw Background (Rear)
            ctx.drawImage(backImg, 0, 0);

            frontImg.onload = () => {
                // Calculate PIP size (1/3 width)
                const pipWidth = canvas.width * 0.3;
                const pipHeight = (frontImg.height / frontImg.width) * pipWidth;
                const margin = 40;

                // Draw PIP Shadow
                ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
                ctx.shadowBlur = 30;
                ctx.shadowOffsetX = 10;
                ctx.shadowOffsetY = 10;

                // Create Rounded Clipping Path for Front Camera
                const radius = 40;
                ctx.beginPath();
                ctx.moveTo(margin + radius, margin);
                ctx.lineTo(margin + pipWidth - radius, margin);
                ctx.quadraticCurveTo(margin + pipWidth, margin, margin + pipWidth, margin + radius);
                ctx.lineTo(margin + pipWidth, margin + pipHeight - radius);
                ctx.quadraticCurveTo(margin + pipWidth, margin + pipHeight, margin + pipWidth - radius, margin + pipHeight);
                ctx.lineTo(margin + radius, margin + pipHeight);
                ctx.quadraticCurveTo(margin, margin + pipHeight, margin, margin + pipHeight - radius);
                ctx.lineTo(margin, margin + radius);
                ctx.quadraticCurveTo(margin, margin, margin + radius, margin);
                ctx.closePath();

                ctx.save();
                ctx.clip();
                
                // Draw Front Image (Mirrored if it's the front camera, but usually base64 is already what we saw)
                // If it needs mirroring, we could add ctx.scale(-1, 1). 
                // But for a simple stitch, we just draw it.
                ctx.drawImage(frontImg, margin, margin, pipWidth, pipHeight);
                ctx.restore();

                // Draw White Border
                ctx.lineWidth = 10;
                ctx.strokeStyle = 'white';
                ctx.shadowBlur = 0; // Remove shadow for border
                ctx.stroke();

                resolve(canvas.toDataURL('image/jpeg', 0.8));
            };
            frontImg.src = frontBase64.startsWith('data:') ? frontBase64 : `data:image/jpeg;base64,${frontBase64}`;
        };
        backImg.onerror = reject;
        frontImg.onerror = reject;
        backImg.src = backBase64.startsWith('data:') ? backBase64 : `data:image/jpeg;base64,${backBase64}`;
    });
}
