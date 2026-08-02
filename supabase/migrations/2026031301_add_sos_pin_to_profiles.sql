-- Add sos_pin column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sos_pin TEXT;

-- Update comments
COMMENT ON COLUMN public.profiles.sos_pin IS 'Secure PIN for deactivating SOS alerts';
