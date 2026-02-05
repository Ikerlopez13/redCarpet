-- RedCarpet Database Schema
-- Run this in Supabase SQL Editor

-- Enable PostGIS for geospatial queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================
-- PROFILES (extends auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT,
    avatar_url TEXT,
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS for profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- ============================================
-- FAMILY GROUPS
-- ============================================
CREATE TABLE IF NOT EXISTS family_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    relationship_type TEXT CHECK (relationship_type IN ('parental', 'couple', 'roommates', 'extended')),
    admin_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    invite_code TEXT UNIQUE DEFAULT encode(gen_random_bytes(6), 'hex'),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE family_groups ENABLE ROW LEVEL SECURITY;

-- ============================================
-- FAMILY MEMBERS
-- ============================================
CREATE TABLE IF NOT EXISTS family_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES family_groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('admin', 'member', 'child')) DEFAULT 'member',
    permissions JSONB DEFAULT '{"location_sharing": true, "sos_alerts": true, "route_sharing": true}',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(group_id, user_id)
);

ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;

-- Users can see members in their groups
CREATE POLICY "View group members" ON family_members FOR SELECT USING (
    group_id IN (SELECT group_id FROM family_members WHERE user_id = auth.uid())
);

-- ============================================
-- LOCATIONS (realtime tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    accuracy DOUBLE PRECISION,
    battery_level INTEGER CHECK (battery_level >= 0 AND battery_level <= 100),
    speed DOUBLE PRECISION,
    heading DOUBLE PRECISION,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_locations_user_time ON locations(user_id, created_at DESC);

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- Users can insert own location
CREATE POLICY "Insert own location" ON locations FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can view locations of family members with location_sharing enabled
CREATE POLICY "View family locations" ON locations FOR SELECT USING (
    user_id IN (
        SELECT fm.user_id FROM family_members fm
        WHERE fm.group_id IN (SELECT group_id FROM family_members WHERE user_id = auth.uid())
        AND (fm.permissions->>'location_sharing')::boolean = true
    )
);

-- Auto-cleanup old locations (keep last 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_locations()
RETURNS void AS $$
BEGIN
    DELETE FROM locations WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SOS ALERTS
-- ============================================
CREATE TABLE IF NOT EXISTS sos_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    group_id UUID REFERENCES family_groups(id) ON DELETE CASCADE,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    status TEXT CHECK (status IN ('active', 'resolved', 'cancelled')) DEFAULT 'active',
    message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sos_active ON sos_alerts(group_id, status) WHERE status = 'active';

ALTER TABLE sos_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Insert own SOS" ON sos_alerts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "View group SOS" ON sos_alerts FOR SELECT USING (
    group_id IN (SELECT group_id FROM family_members WHERE user_id = auth.uid())
);
CREATE POLICY "Update own SOS" ON sos_alerts FOR UPDATE USING (auth.uid() = user_id);

-- ============================================
-- DANGER ZONES (community reported)
-- ============================================
CREATE TABLE IF NOT EXISTS danger_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    radius INTEGER DEFAULT 100,
    type TEXT CHECK (type IN ('dark', 'incident', 'construction', 'traffic', 'unsafe')) NOT NULL,
    description TEXT,
    votes_up INTEGER DEFAULT 0,
    votes_down INTEGER DEFAULT 0,
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Geospatial index
CREATE INDEX IF NOT EXISTS idx_danger_zones_geo ON danger_zones 
    USING GIST (ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography);

ALTER TABLE danger_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view danger zones" ON danger_zones FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can report" ON danger_zones FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================
-- SAVED PLACES
-- ============================================
CREATE TABLE IF NOT EXISTS saved_places (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    icon TEXT DEFAULT 'place',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE saved_places ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CRUD own places" ON saved_places USING (auth.uid() = user_id);

-- ============================================
-- EMERGENCY CONTACTS
-- ============================================
CREATE TABLE IF NOT EXISTS emergency_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    relationship TEXT,
    notify_on_sos BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE emergency_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CRUD own contacts" ON emergency_contacts USING (auth.uid() = user_id);

-- ============================================
-- SUBSCRIPTIONS (synced with RevenueCat)
-- ============================================
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
    plan_id TEXT NOT NULL,
    status TEXT CHECK (status IN ('active', 'cancelled', 'expired', 'trial')) DEFAULT 'trial',
    expires_at TIMESTAMPTZ,
    revenuecat_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own subscription" ON subscriptions FOR SELECT USING (auth.uid() = user_id);

-- ============================================
-- PUSH TOKENS
-- ============================================
CREATE TABLE IF NOT EXISTS push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    platform TEXT CHECK (platform IN ('ios', 'android', 'web')),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, token)
);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Manage own tokens" ON push_tokens USING (auth.uid() = user_id);

-- ============================================
-- REALTIME SUBSCRIPTIONS
-- ============================================
-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE locations;
ALTER PUBLICATION supabase_realtime ADD TABLE sos_alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE family_members;
