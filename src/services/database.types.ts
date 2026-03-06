// Auto-generated types for Supabase tables
// Run `npx supabase gen types typescript` to regenerate after schema changes

export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[];

export interface Database {
    public: {
        Tables: {
            push_tokens: {
                Row: {
                    token: string;
                    user_id: string;
                    platform: 'ios' | 'android' | 'web' | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    token: string;
                    user_id: string;
                    platform?: 'ios' | 'android' | 'web' | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    token?: string;
                    user_id?: string;
                    platform?: 'ios' | 'android' | 'web' | null;
                    created_at?: string;
                    updated_at?: string;
                };
            };
            profiles: {
                Row: {
                    id: string;
                    full_name: string | null;
                    avatar_url: string | null;
                    phone: string | null;
                    created_at: string;
                };
                Insert: {
                    id: string;
                    full_name?: string | null;
                    avatar_url?: string | null;
                    phone?: string | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    full_name?: string | null;
                    avatar_url?: string | null;
                    phone?: string | null;
                    created_at?: string;
                };
            };
            family_groups: {
                Row: {
                    id: string;
                    name: string;
                    relationship_type: 'parental' | 'couple' | 'roommates' | 'extended';
                    admin_id: string;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    name: string;
                    relationship_type: 'parental' | 'couple' | 'roommates' | 'extended';
                    admin_id: string;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    name?: string;
                    relationship_type?: 'parental' | 'couple' | 'roommates' | 'extended';
                    admin_id?: string;
                    created_at?: string;
                };
            };
            family_members: {
                Row: {
                    id: string;
                    group_id: string;
                    user_id: string;
                    role: 'admin' | 'member' | 'child';
                    permissions: Json;
                    joined_at: string;
                };
                Insert: {
                    id?: string;
                    group_id: string;
                    user_id: string;
                    role: 'admin' | 'member' | 'child';
                    permissions?: Json;
                    joined_at?: string;
                };
                Update: {
                    id?: string;
                    group_id?: string;
                    user_id?: string;
                    role?: 'admin' | 'member' | 'child';
                    permissions?: Json;
                    joined_at?: string;
                };
            };
            locations: {
                Row: {
                    id: string;
                    user_id: string;
                    lat: number;
                    lng: number;
                    accuracy: number | null;
                    battery_level: number | null;
                    speed: number | null;
                    heading: number | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    lat: number;
                    lng: number;
                    accuracy?: number | null;
                    battery_level?: number | null;
                    speed?: number | null;
                    heading?: number | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    user_id?: string;
                    lat?: number;
                    lng?: number;
                    accuracy?: number | null;
                    battery_level?: number | null;
                    speed?: number | null;
                    heading?: number | null;
                    created_at?: string;
                };
            };
            sos_alerts: {
                Row: {
                    id: string;
                    user_id: string;
                    group_id: string;
                    lat: number | null;
                    lng: number | null;
                    status: 'active' | 'resolved' | 'cancelled';
                    message: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    group_id: string;
                    lat?: number | null;
                    lng?: number | null;
                    status?: 'active' | 'resolved' | 'cancelled';
                    message?: string | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    user_id?: string;
                    group_id?: string;
                    lat?: number | null;
                    lng?: number | null;
                    status?: 'active' | 'resolved' | 'cancelled';
                    message?: string | null;
                    created_at?: string;
                };
            };
            safe_zones: {
                Row: {
                    id: string;
                    family_id: string;
                    name: string;
                    lat: number;
                    lng: number;
                    radius: number;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    family_id: string;
                    name: string;
                    lat: number;
                    lng: number;
                    radius?: number;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    family_id?: string;
                    name?: string;
                    lat?: number;
                    lng?: number;
                    radius?: number;
                    created_at?: string;
                };
            };
            danger_zones: {
                Row: {
                    id: string;
                    reporter_id: string;
                    lat: number;
                    lng: number;
                    radius: number;
                    type: 'dark' | 'incident' | 'construction' | 'traffic';
                    description: string | null;
                    votes_up: number;
                    votes_down: number;
                    expires_at: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    reporter_id: string;
                    lat: number;
                    lng: number;
                    radius?: number;
                    type: 'dark' | 'incident' | 'construction' | 'traffic';
                    description?: string | null;
                    votes_up?: number;
                    votes_down?: number;
                    expires_at?: string | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    reporter_id?: string;
                    lat?: number;
                    lng?: number;
                    radius?: number;
                    type?: 'dark' | 'incident' | 'construction' | 'traffic';
                    description?: string | null;
                    votes_up?: number;
                    votes_down?: number;
                    expires_at?: string | null;
                    created_at?: string;
                };
            };
            saved_places: {
                Row: {
                    id: string;
                    user_id: string;
                    name: string;
                    address: string | null;
                    lat: number;
                    lng: number;
                    icon: string;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    name: string;
                    address?: string | null;
                    lat: number;
                    lng: number;
                    icon?: string;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    user_id?: string;
                    name?: string;
                    address?: string | null;
                    lat?: number;
                    lng?: number;
                    icon?: string;
                    created_at?: string;
                };
            };
            emergency_contacts: {
                Row: {
                    id: string;
                    user_id: string;
                    name: string;
                    phone: string;
                    relationship: string | null;
                    notify_on_sos: boolean;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    name: string;
                    phone: string;
                    relationship?: string | null;
                    notify_on_sos?: boolean;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    user_id?: string;
                    name?: string;
                    phone?: string;
                    relationship?: string | null;
                    notify_on_sos?: boolean;
                    created_at?: string;
                };
            };
            family_stats: {
                Row: {
                    id: string;
                    family_id: string;
                    week_start_date: string;
                    safe_arrivals_count: number;
                    risk_alerts_count: number;
                    routes_completed_count: number;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    family_id: string;
                    week_start_date: string;
                    safe_arrivals_count?: number;
                    risk_alerts_count?: number;
                    routes_completed_count?: number;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    family_id?: string;
                    week_start_date?: string;
                    safe_arrivals_count?: number;
                    risk_alerts_count?: number;
                    routes_completed_count?: number;
                    updated_at?: string;
                };
            };
            subscriptions: {
                Row: {
                    id: string;
                    user_id: string;
                    plan_id: string;
                    status: 'active' | 'cancelled' | 'expired' | 'trial';
                    expires_at: string | null;
                    revenuecat_id: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    plan_id: string;
                    status?: 'active' | 'cancelled' | 'expired' | 'trial';
                    expires_at?: string | null;
                    revenuecat_id?: string | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    user_id?: string;
                    plan_id?: string;
                    status?: 'active' | 'cancelled' | 'expired' | 'trial';
                    expires_at?: string | null;
                    revenuecat_id?: string | null;
                    created_at?: string;
                };
            };
        };
        Views: {};
        Functions: {};
        Enums: {};
    };
}

// Helper types
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type FamilyGroup = Database['public']['Tables']['family_groups']['Row'];
export type FamilyMember = Database['public']['Tables']['family_members']['Row'];
export type Location = Database['public']['Tables']['locations']['Row'];
export type SOSAlert = Database['public']['Tables']['sos_alerts']['Row'];
export type SafeZone = Database['public']['Tables']['safe_zones']['Row'];
export type DangerZone = Database['public']['Tables']['danger_zones']['Row'];
export type SavedPlace = Database['public']['Tables']['saved_places']['Row'];
export type EmergencyContact = Database['public']['Tables']['emergency_contacts']['Row'];
export type Subscription = Database['public']['Tables']['subscriptions']['Row'];
