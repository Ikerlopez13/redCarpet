import { useState, useRef, useEffect } from 'react';

/**
 * Hook to manage audio/video recording using the MediaRecorder API.
 * Returns URLs for the recorded media and control functions.
 */
export const useAlertMedia = () => {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    // Request camera and microphone permissions
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;
    chunksRef.current = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
      const url = URL.createObjectURL(blob);
      // Simple heuristic: if video tracks present, treat as video, else audio
      const hasVideo = stream.getVideoTracks().length > 0;
      if (hasVideo) setVideoUrl(url);
      else setAudioUrl(url);
    };
    mediaRecorder.start();
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    // Stop all tracks to release camera/mic
    mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    mediaRecorderRef.current = null;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return { videoUrl, audioUrl, startRecording, stopRecording };
};
