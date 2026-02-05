import { supabase, isMockMode } from './supabaseClient';
import type { FamilyGroup, FamilyMember, Profile } from './database.types';

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
            phone: '+34 612 345 678',
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
            phone: '+34 612 345 679',
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
            created_at: new Date().toISOString(),
        }
    }
];

/**
 * Get user's family group
 */
export async function getFamilyGroup(userId: string): Promise<FamilyGroup | null> {
    if (isMockMode) {
        return mockFamilyGroup;
    }

    // First check if user is a member of any group
    const { data: membership } = await supabase
        .from('family_members')
        .select('group_id')
        .eq('user_id', userId)
        .single();

    if (!membership) return null;

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
    if (isMockMode) {
        return mockMembers;
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
 * Create a new family group
 */
export async function createFamilyGroup(
    name: string,
    relationshipType: FamilyGroup['relationship_type'],
    adminId: string
): Promise<{ group: FamilyGroup | null; error: string | null }> {
    if (isMockMode) {
        const group: FamilyGroup = {
            id: `group-${Date.now()}`,
            name,
            relationship_type: relationshipType,
            admin_id: adminId,
            created_at: new Date().toISOString(),
        };
        return { group, error: null };
    }

    const { data: group, error } = await supabase
        .from('family_groups')
        .insert({
            name,
            relationship_type: relationshipType,
            admin_id: adminId,
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
 * Generate invite link for family group
 */
export async function generateInviteLink(groupId: string): Promise<string> {
    // In production, this would create a secure invite token in the database
    const inviteCode = btoa(`${groupId}:${Date.now()}`);
    return `${window.location.origin}/join/${inviteCode}`;
}

/**
 * Join a family group via invite link
 */
export async function joinFamilyGroup(
    inviteCode: string,
    userId: string,
    role: FamilyMember['role'] = 'member'
): Promise<{ error: string | null }> {
    try {
        const decoded = atob(inviteCode);
        const [groupId] = decoded.split(':');

        if (isMockMode) {
            return { error: null };
        }

        const { error } = await supabase.from('family_members').insert({
            group_id: groupId,
            user_id: userId,
            role,
        } as any);

        return { error: error?.message || null };
    } catch {
        return { error: 'Invalid invite code' };
    }
}

/**
 * Update member permissions
 */
export async function updateMemberPermissions(
    memberId: string,
    permissions: Record<string, boolean>
): Promise<{ error: string | null }> {
    if (isMockMode) {
        return { error: null };
    }

    const { error } = await supabase
        .from('family_members')
        .update({ permissions } as any)
        .eq('id', memberId);

    return { error: error?.message || null };
}

/**
 * Remove member from group
 */
export async function removeFamilyMember(memberId: string): Promise<{ error: string | null }> {
    if (isMockMode) {
        return { error: null };
    }

    const { error } = await supabase
        .from('family_members')
        .delete()
        .eq('id', memberId);

    return { error: error?.message || null };
}

/**
 * Leave family group
 */
export async function leaveFamilyGroup(userId: string, groupId: string): Promise<{ error: string | null }> {
    if (isMockMode) {
        return { error: null };
    }

    const { error } = await supabase
        .from('family_members')
        .delete()
        .eq('user_id', userId)
        .eq('group_id', groupId);

    return { error: error?.message || null };
}
