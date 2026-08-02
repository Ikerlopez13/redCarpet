import { supabase, getIsMockMode } from './supabaseClient';
import type { FamilyGroup, FamilyMember, Profile, Location } from './database.types';

// Mock data for development
const mockFamilyGroup: FamilyGroup = {
    id: 'mock-family-123',
    name: 'Familia García',
    relationship_type: 'parental',
    admin_id: 'mock-user-123',
    created_at: new Date().toISOString(),
};

const mockMembers: (FamilyMember & { profile: Profile })[] = [
    {
        id: 'member-1',
        group_id: 'mock-family-123',
        user_id: 'mock-user-123',
        role: 'admin',
        permissions: { location_sharing: true, sos_alerts: true },
        joined_at: new Date().toISOString(),
        profile: {
            id: 'mock-user-123',
            full_name: 'Alejandro García',
            avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=260',
            phone: '+34 600 000 000',
            has_accepted_privacy_policy: true,
            sos_pin: null,
            created_at: new Date().toISOString(),
        }
    },
    {
        id: 'member-2',
        group_id: 'mock-family-123',
        user_id: 'mock-user-456',
        role: 'member',
        permissions: { location_sharing: true, sos_alerts: true },
        joined_at: new Date().toISOString(),
        profile: {
            id: 'mock-user-456',
            full_name: 'María García',
            avatar_url: null,
            phone: '+34 600 000 000',
            has_accepted_privacy_policy: true,
            sos_pin: null,
            created_at: new Date().toISOString(),
        }
    },
    {
        id: 'member-3',
        group_id: 'mock-family-123',
        user_id: 'mock-user-789',
        role: 'child',
        permissions: { location_sharing: true, sos_alerts: true },
        joined_at: new Date().toISOString(),
        profile: {
            id: 'mock-user-789',
            full_name: 'Carlos García',
            avatar_url: null,
            phone: null,
            has_accepted_privacy_policy: true,
            sos_pin: null,
            created_at: new Date().toISOString(),
        }
    }
];

/**
 * Get user's family group
 */

export async function getFamilyGroup(userId: string): Promise<FamilyGroup | null> {
    // Only return mock data for specific debug user
    if (getIsMockMode() && userId === 'debug_user') {
        return mockFamilyGroup;
    }

    if (getIsMockMode()) {
        // For other users in mock mode, simulate empty state or local storage if we were using it
        // For now, return null to show empty state
        return null;
    }

    const { data: memberships } = await (supabase.from('family_members') as any)
        .select('group_id')
        .eq('user_id', userId)
        .limit(1);

    if (!memberships || memberships.length === 0) return null;
    const membership = memberships[0];

    const { data: group } = await supabase
        .from('family_groups')
        .select('*')
        .eq('id', membership.group_id)
        .single();

    return group;
}

/**
 * Get all members of a family group
 */
export async function getFamilyMembers(groupId: string): Promise<(FamilyMember & { profile: Profile })[]> {
    if (getIsMockMode()) {
        // If the group ID matches our mock group, return mock members
        if (groupId === mockFamilyGroup.id) {
            return mockMembers;
        }
        return [];
    }

    const { data } = await supabase
        .from('family_members')
        .select(`
            *,
            profile:profiles(*)
        `)
        .eq('group_id', groupId);

    return (data || []) as (FamilyMember & { profile: Profile })[];
}

/**
 * Optimized function to get all family data for a user in one go
 */

// ... existing mock data ...

/**
 * Optimized function to get all family data for a user in one go
 */
export async function getFamilyData(userId: string): Promise<{
    group: FamilyGroup | null;
    members: (FamilyMember & { profile: Profile; location?: Location })[]
}> {
    if (getIsMockMode() && userId === 'debug_user') {
        // Return mock data with mock locations
        const membersWithLoc = mockMembers.map((m, i) => ({
            ...m,
            location: {
                id: `loc-${i}`,
                user_id: m.user_id,
                lat: i === 0 ? 41.4095 : i === 1 ? 41.4060 : 41.4110,
                lng: i === 0 ? 2.1870 : i === 1 ? 2.1910 : 2.1860,
                accuracy: 10,
                battery_level: 100,
                speed: 0,
                heading: 0,
                created_at: new Date().toISOString()
            } as Location
        }));
        return { group: mockFamilyGroup, members: membersWithLoc };
    }

    if (getIsMockMode()) {
        // Only return mock data if specifically requested for debug, otherwise clean slate
        return { group: null, members: [] };
    }

    // 1. Get user's group ID safely (in case they got duplicate memberships somehow)
    const { data: memberships } = await (supabase.from('family_members') as any)
        .select('group_id')
        .eq('user_id', userId)
        .limit(1);

    if (!memberships || memberships.length === 0) return { group: null, members: [] };
    const membership = memberships[0];

    // 2. Fetch group details and members
    const [groupResult, membersResult] = await Promise.all([
        supabase
            .from('family_groups')
            .select('*')
            .eq('id', membership.group_id)
            .single(),
        supabase
            .from('family_members')
            .select(`
                *,
                profile:profiles(*)
            `)
            .eq('group_id', membership.group_id)
    ]);

    const members = (membersResult.data || []) as (FamilyMember & { profile: Profile })[];

    if (members.length === 0) {
        return { group: groupResult.data, members: [] };
    }

    // 3. Fetch latest location for each member
    // We'll fetch the last location for each user in the group
    // In a production app with many locations, we might want a Postgres Function or a View for "latest_locations"
    const userIds = members.map(m => m.user_id);

    const { data } = await supabase
        .from('locations')
        .select('*')
        .in('user_id', userIds)
        .order('created_at', { ascending: false });

    const locations = (data || []) as Location[];

    // Map latest location to each member
    const membersWithLocation = members.map(member => {
        // Find the most recent location for this user
        // Since we ordered by created_at desc, the first match is the latest
        const loc = locations?.find(l => l.user_id === member.user_id);
        return {
            ...member,
            location: loc
        };
    });

    return {
        group: groupResult.data,
        members: membersWithLocation
    };
}

/**
 * Create a new family group
 */
export async function createFamilyGroup(
    name: string,
    relationshipType: FamilyGroup['relationship_type'],
    adminId: string
): Promise<{ group: FamilyGroup | null; error: string | null }> {
    if (!adminId || adminId.trim() === '') {
        return { group: null, error: 'Sesión no válida: Falta el ID del administrador' };
    }

    if (getIsMockMode()) {
        const group: FamilyGroup = {
            id: `group-${Date.now()}`,
            name,
            relationship_type: relationshipType,
            admin_id: adminId,
            created_at: new Date().toISOString(),
        };
        return { group, error: null };
    }

    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const { data: group, error } = await (supabase.from('family_groups') as any)
        .insert({
            name,
            relationship_type: relationshipType,
            admin_id: adminId,
            invite_code: inviteCode,
        } as any)
        .select()
        .single();

    if (error) return { group: null, error: error.message };

    // Add admin as first member
    await supabase.from('family_members').insert({
        group_id: (group as any).id,
        user_id: adminId,
        role: 'admin',
    } as any);

    return { group, error: null };
}

/**
 * Get the invite code for family group
 */
export async function generateInviteLink(groupId: string): Promise<string> {
    if (getIsMockMode()) return 'MOCK-TAG';

    const { data } = await (supabase.from('family_groups') as any)
        .select('*')
        .eq('id', groupId)
        .single();

    return (data as any)?.invite_code || '';
}

/**
 * Join a family group via 6-character tag
 */
export async function joinFamilyGroup(
    inviteCode: string,
    userId: string,
    role: FamilyMember['role'] = 'member'
): Promise<{ error: string | null }> {
    try {
        if (getIsMockMode()) {
            return { error: null };
        }

        const cleanCode = inviteCode.replace('#', '').trim().toUpperCase();

        // Use RPC to bypass RLS — non-members can't SELECT from family_groups
        const { data: groupId, error: rpcError } = await (supabase.rpc as any)(
            'lookup_family_by_invite_code',
            { p_invite_code: cleanCode }
        );

        if (rpcError || !groupId) {
            return { error: 'Código de familia inválido' };
        }

        const { error } = await supabase.from('family_members').insert({
            group_id: groupId,
            user_id: userId,
            role,
        } as any);

        return { error: error?.message || null };
    } catch {
        return { error: 'Error al unirse a la familia' };
    }
}

/**
 * Update member permissions
 */
export async function updateMemberPermissions(
    memberId: string,
    permissions: Record<string, boolean>
): Promise<{ error: string | null }> {
    if (getIsMockMode()) {
        return { error: null };
    }

    const { error } = await (supabase.from('family_members') as any)
        .update({ permissions } as any)
        .eq('id', memberId);

    return { error: error?.message || null };
}

/**
 * Remove member from group
 */
export async function removeFamilyMember(memberId: string): Promise<{ error: string | null }> {
    if (getIsMockMode()) {
        return { error: null };
    }

    const { error } = await supabase
        .from('family_members')
        .delete()
        .eq('id', memberId);

    return { error: error?.message || null };
}

/**
 * Remove member from group by user_id and group_id
 */
export async function removeFamilyMemberByUserId(userId: string, groupId: string): Promise<{ error: string | null }> {
    if (getIsMockMode()) {
        return { error: null };
    }

    const { error } = await supabase
        .from('family_members')
        .delete()
        .eq('user_id', userId)
        .eq('group_id', groupId);

    return { error: error?.message || null };
}

/**
 * Leave family group
 */
export async function leaveFamilyGroup(userId: string, groupId: string): Promise<{ error: string | null }> {
    if (getIsMockMode()) {
        return { error: null };
    }

    const { error } = await supabase
        .from('family_members')
        .delete()
        .eq('user_id', userId)
        .eq('group_id', groupId);

    return { error: error?.message || null };
}
