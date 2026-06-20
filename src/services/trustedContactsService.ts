import { supabase } from './supabaseClient';

// Derives a human-readable short ID from a Supabase UUID
// e.g. "3925dd37-27cf-..." -> "#3925DD3"
export function getShortId(userId: string): string {
    return '#' + userId.replace(/-/g, '').substring(0, 7).toUpperCase();
}

// Finds a user by their short ID (prefix search on uuid)
export async function findUserByShortId(shortId: string): Promise<{ id: string; full_name: string | null } | null> {
    // Remove leading # and lowercase to match UUID prefix
    const clean = shortId.replace(/^#/, '').toLowerCase();
    if (clean.length < 7) return null;
    
    // UUID cannot be queried with ILIKE directly from the client.
    // We use a custom RPC to cast and search.
    const { data, error } = await supabase.rpc('match_user_by_short_id', {
        p_short_id: clean
    });
    
    if (error || !data || data.length === 0) return null;
    return data[0] as { id: string; full_name: string | null };
}


export interface TrustedContact {
    id: string;
    user_id: string;
    name: string;
    phone: string;
    relation: string;
    share_location: boolean;
    notify_emergency: boolean;
    associated_user_id: string | null;
    status: 'pending' | 'accepted' | 'rejected';
    created_at: string;
}

export interface PendingRequest {
    request_id: string;
    requester_id: string;
    requester_name: string;
    requester_avatar: string | null;
    requested_as_name: string;
    requested_phone: string;
    created_at: string;
}

export class TrustedContactsService {
    /**
     * Get all trusted contacts for a given user
     */
    static async getContacts(userId: string): Promise<TrustedContact[]> {
        const { data, error } = await supabase
            .from('trusted_contacts')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching trusted contacts:', error);
            return [];
        }

        return data as TrustedContact[];
    }

    static async addContact(
        userId: string,
        name: string,
        phone: string,
        email?: string,
        relation: string = 'Familiar'
    ): Promise<{ contact: TrustedContact | null; error: string | null; isPendingRequest: boolean }> {
        if (!userId || userId.trim() === '') {
            throw new Error("Sesión no válida");
        }
        
        // 1. Look for an existing app user with this phone number or email using the secure RPC
        let matchedId = null;
        try {
            const { data, error: rpcError } = await (supabase.rpc as any)('match_user_for_contact', {
                p_phone: phone || null,
                p_email: email || null
            });
            if (!rpcError) matchedId = data;
        } catch (e) {
            console.error('RPC match_user_for_contact failed or not available', e);
        }

        const associatedUserId = matchedId || null;
        const initialStatus = associatedUserId ? 'pending' : 'accepted';

        // Check for existing contact to avoid unique constraint violations
        if (associatedUserId) {
            const { data: existing } = await (supabase.from('trusted_contacts') as any)
                .select('id, status')
                .eq('user_id', userId)
                .eq('associated_user_id', associatedUserId)
                .maybeSingle();

            if (existing) {
                if (existing.status === 'pending') {
                    return { contact: null, error: 'Ya tienes una solicitud pendiente con este contacto.', isPendingRequest: true };
                }
                const { data: updated, error: updateError } = await (supabase.from('trusted_contacts') as any)
                    .update({ name, phone, relation, status: initialStatus } as any)
                    .eq('id', existing.id)
                    .select('*')
                    .single();
                if (updateError) return { contact: null, error: updateError.message, isPendingRequest: false };
                return { contact: updated as TrustedContact, error: null, isPendingRequest: initialStatus === 'pending' };
            }
        } else {
            const { data: existingPhone } = await (supabase.from('trusted_contacts') as any)
                .select('id')
                .eq('user_id', userId)
                .eq('phone', phone)
                .maybeSingle();
            if (existingPhone) {
                return { contact: null, error: 'Ya tienes un contacto con este número de teléfono.', isPendingRequest: false };
            }
        }

        const { data, error } = await (supabase.from('trusted_contacts') as any)
            .insert({
                user_id: userId,
                name,
                phone,
                relation,
                share_location: true,
                notify_emergency: true,
                associated_user_id: associatedUserId,
                status: initialStatus
            } as any)
            .select('*')
            .single();

        if (error) {
            console.error('Error adding trusted contact:', error);
            return { contact: null, error: error.message, isPendingRequest: false };
        }

        return { contact: data as TrustedContact, error: null, isPendingRequest: initialStatus === 'pending' };
    }

    /**
     * Update a specific toggle for a contact
     */
    static async updateToggle(
        contactId: string,
        field: 'share_location' | 'notify_emergency',
        value: boolean
    ): Promise<{ error: string | null }> {
        const { error } = await (supabase.from('trusted_contacts') as any)
            .update({
                [field]: value
            } as any)
            .eq('id', contactId);

        if (error) {
            console.error(`Error updating contact ${field}:`, error);
            return { error: error.message };
        }

        return { error: null };
    }

    /**
     * Delete a contact
     */
    static async deleteContact(contactId: string): Promise<{ error: string | null }> {
        const { error } = await supabase
            .from('trusted_contacts')
            .delete()
            .eq('id', contactId);

        if (error) {
            console.error('Error deleting contact:', error);
            return { error: error.message };
        }

        return { error: null };
    }

    /**
     * Get pending friend requests received by the user
     */
    static async getPendingRequests(userId: string): Promise<PendingRequest[]> {
        // Query the view we created in the migration
        const { data, error } = await supabase
            .from('pending_contact_requests' as any)
            .select('*')
            .eq('associated_user_id', userId); // Although RLS filters it, we explicitly request it

        if (error) {
            console.error('Error fetching pending requests:', error);
            return [];
        }

        return data as PendingRequest[];
    }

    /**
     * Respond to a friend request and create a reciprocal connection if accepted
     */
    static async respondToRequest(requestId: string, accept: boolean, currentUserId?: string): Promise<{ error: string | null }> {
        // Fetch the pending request details first if accepting
        let requestInfo = null;
        if (accept && currentUserId) {
            const { data } = await supabase.from('pending_contact_requests' as any)
                .select('*')
                .eq('request_id', requestId)
                .single();
            requestInfo = data;
        }

        const { error } = await (supabase.from('trusted_contacts') as any)
            .update({
                status: accept ? 'accepted' : 'rejected'
            } as any)
            .eq('id', requestId);

        if (error) {
            console.error('Error responding to request:', error);
            return { error: error.message };
        }

        // If accepted, add the original requester to the current user's contact list
        if (accept && requestInfo && currentUserId) {
            try {
                await (supabase.from('trusted_contacts') as any).insert({
                    user_id: currentUserId,
                    name: requestInfo.requester_name || 'Amigo',
                    phone: '', // Number hidden for privacy if we don't have it, but they are linked
                    relation: 'Familiar',
                    share_location: true,
                    notify_emergency: true,
                    associated_user_id: requestInfo.requester_id,
                    status: 'accepted'
                });
            } catch (err) {
                console.error('Error creating reciprocal contact', err);
            }
        }

        return { error: null };
    }
}
