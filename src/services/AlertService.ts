import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { useAlertMedia } from '../hooks/useAlertMedia';
import { TrustedContactsService, type TrustedContact } from './trustedContactsService';

/**
 * Determines alert duration using an AI endpoint. Placeholder implementation returns
 * a duration based on alert type.
 */
export const determineDuration = async (alertType: string): Promise<number> => {
  // TODO: replace with actual AI call
  const mapping: Record<string, number> = {
    'emergency': 30,
    'info': 10,
    'default': 15,
  };
  return mapping[alertType] ?? mapping['default'];
};

/**
 * Saves media blobs locally using Capacitor Filesystem. Returns the file paths.
 */
export const saveMediaLocally = async (
  videoBlob: Blob | null,
  audioBlob: Blob | null,
  alertId: string
): Promise<{ videoPath?: string; audioPath?: string }> => {
  const result: { videoPath?: string; audioPath?: string } = {};
  if (videoBlob) {
    const videoData = await videoBlob.text(); // base64 string if needed
    const videoPath = await Filesystem.writeFile({
      path: `alerts/${alertId}/video.webm`,
      data: videoData,
      directory: Directory.Data,
      recursive: true,
    });
    result.videoPath = videoPath.uri;
  }
  if (audioBlob) {
    const audioData = await audioBlob.text();
    const audioPath = await Filesystem.writeFile({
      path: `alerts/${alertId}/audio.webm`,
      data: audioData,
      directory: Directory.Data,
      recursive: true,
    });
    result.audioPath = audioPath.uri;
  }
  return result;
};

/**
 * Constructs a WhatsApp share link with the provided media URL(s).
 */
export const sendWhatsAppLink = (mediaUrl: string, contacts: TrustedContact[]): string => {
  // Build a comma‑separated list of phone numbers (international format without +)
  const numbers = contacts.map((c) => c.phone.replace(/[+\s-]/g, '')).join(',');
  const encodedMessage = encodeURIComponent(`Alerta activada. Revisa el video aquí: ${mediaUrl}`);
  // Using the wa.me URL scheme – many devices will open WhatsApp with the pre‑filled text.
  return `https://wa.me/${numbers}?text=${encodedMessage}`;
};

/**
 * Starts an alert: records media, determines duration, saves media, and returns a WhatsApp link.
 */
export const startAlert = async (
  alertType: string,
  contacts: TrustedContact[]
): Promise<{ whatsappLink: string; localPaths: { videoPath?: string; audioPath?: string } }> => {
  // 1. Determine how long the alert should stay active
  const durationSec = await determineDuration(alertType);

  // 2. Start media recording (using the hook programmatically)
  // NOTE: This is a simplified approach – in a real React component you would call the hook.
  // Here we directly use the MediaRecorder API.
  const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  const mediaRecorder = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  mediaRecorder.start();

  // Stop after duration
  await new Promise((resolve) => setTimeout(resolve, durationSec * 1000));
  mediaRecorder.stop();

  // Wait for stop event
  await new Promise<void>((res) => {
    mediaRecorder.onstop = () => res();
  });

  const blob = new Blob(chunks, { type: mediaRecorder.mimeType });
  const videoUrl = URL.createObjectURL(blob);

  // 3. Save locally
  const alertId = `${Date.now()}`;
  const localPaths = await saveMediaLocally(blob, null, alertId);

  // 4. Build WhatsApp link
  const whatsappLink = sendWhatsAppLink(videoUrl, contacts);

  // Cleanup media streams
  stream.getTracks().forEach((t) => t.stop());

  return { whatsappLink, localPaths };
};
