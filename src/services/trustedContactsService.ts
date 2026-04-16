import { supabase } from './supabaseClient';


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
        const { data: matchedId, error: rpcError } = await (supabase.rpc as any)('match_user_for_contact', {
            p_phone: phone || null,
            p_email: email || null
        });

        if (rpcError) {
            console.error('Error matching user:', rpcError);
        }

        const associatedUserId = matchedId || null;
        const initialStatus = associatedUserId ? 'pending' : 'accepted';

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
     * Respond to a friend request
     */
    static async respondToRequest(requestId: string, accept: boolean): Promise<{ error: string | null }> {
        const { error } = await (supabase.from('trusted_contacts') as any)
            .update({
                status: accept ? 'accepted' : 'rejected'
            } as any)
            .eq('id', requestId);

        if (error) {
            console.error('Error responding to request:', error);
            return { error: error.message };
        }

        return { error: null };
    }
}
