-- Añadir campos analíticos y demográficos al perfil
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS dob DATE,
ADD COLUMN IF NOT EXISTS habitual_city TEXT,
ADD COLUMN IF NOT EXISTS walking_alone_frequency TEXT, -- 'daily', 'occasional', 'rarely'
ADD COLUMN IF NOT EXISTS risk_exposure_level TEXT, -- 'high', 'medium', 'low'
ADD COLUMN IF NOT EXISTS habitual_zones JSONB; -- Store array of strings/zones

-- Añadir campos de contexto multimedia y analítico a las alertas SOS
ALTER TABLE public.sos_alerts
ADD COLUMN IF NOT EXISTS media_video_url TEXT,
ADD COLUMN IF NOT EXISTS media_audio_url TEXT,
ADD COLUMN IF NOT EXISTS context_payload JSONB; -- Analytical payload snapshot
