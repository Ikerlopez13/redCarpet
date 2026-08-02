import { Plugins } from '@capacitor/core';


/**
 * Request required permissions for alert media capture and storage.
 */
export const requestAlertPermissions = async (): Promise<void> => {
  const { Camera, Microphone, Filesystem } = Plugins;

  // Camera permission
  const camStatus = await Camera.requestPermissions();
  if (camStatus.camera !== 'granted') {
    throw new Error('Camera permission denied');
  }

  // Microphone permission
  const micStatus = await Microphone.requestPermissions();
  if (micStatus.microphone !== 'granted') {
    throw new Error('Microphone permission denied');
  }

  // Filesystem permission (if needed on native platforms)
  if (Filesystem && Filesystem.requestPermissions) {
    const fsStatus = await Filesystem.requestPermissions();
    if (fsStatus.publicStorage !== 'granted') {
      throw new Error('Filesystem permission denied');
    }
  }
};
