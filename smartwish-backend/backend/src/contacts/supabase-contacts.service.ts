import { Injectable } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { Contact, ContactEvent, ContactMedia } from './contact.entity';

@Injectable()
export class SupabaseContactsService {
  private supabase;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }

  // Contact CRUD operations
  async createContact(
    userId: string,
    contactData: Partial<Contact>,
  ): Promise<Contact> {
    console.log('Creating contact for userId:', userId);

    const newContact = {
      // Generate a fresh user_id (UUID) for the contact row while
      // keeping contact_owner set to the authenticated user for RLS/ownership
      user_id: uuidv4(),
      contact_owner: userId,
      first_name: contactData.firstName || '',
      last_name: contactData.lastName || '',
      email: contactData.email,
      phone_number: contactData.phoneNumber,
      address: contactData.address,
      relationship: contactData.relationship,
      social_media: contactData.socialMedia || {},
      interests: contactData.interests || [],
      hobbies: contactData.hobbies || [],
      occupation: contactData.occupation,
      company: contactData.company,
      notes: contactData.notes,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('contacts')
      .insert([newContact])
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to create contact: ${error.message}`);
    }

    return this.mapDatabaseRecordToContact(data);
  }

  async getContacts(userId: string): Promise<Contact[]> {
    const { data: contacts, error } = await this.supabase
      .from('contacts')
      .select('*')
      .eq('contact_owner', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch contacts: ${error.message}`);
    }

    // Load events and media for each contact
    const contactsWithRelations = await Promise.all(
      contacts.map(async (contact) => {
        const [events, media] = await Promise.all([
          this.getContactEvents(contact.id),
          this.getContactMedia(contact.id),
        ]);

        return {
          ...this.mapDatabaseRecordToContact(contact),
          events,
          media,
        };
      }),
    );

    return contactsWithRelations;
  }

  async getContact(userId: string, contactId: string): Promise<Contact | null> {
    const { data, error } = await this.supabase
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .eq('contact_owner', userId)
      .single();

    if (error || !data) {
      return null;
    }

    // Load events and media
    const [events, media] = await Promise.all([
      this.getContactEvents(contactId),
      this.getContactMedia(contactId),
    ]);

    return {
      ...this.mapDatabaseRecordToContact(data),
      events,
      media,
    };
  }

  async updateContact(
    userId: string,
    contactId: string,
    updateData: Partial<Contact>,
  ): Promise<Contact | null> {
    const updatePayload = {
      ...(updateData.firstName && { first_name: updateData.firstName }),
      ...(updateData.lastName && { last_name: updateData.lastName }),
      ...(updateData.email !== undefined && { email: updateData.email }),
      ...(updateData.phoneNumber !== undefined && {
        phone_number: updateData.phoneNumber,
      }),
      ...(updateData.address !== undefined && { address: updateData.address }),
      ...(updateData.relationship !== undefined && {
        relationship: updateData.relationship,
      }),
      ...(updateData.socialMedia && { social_media: updateData.socialMedia }),
      ...(updateData.interests && { interests: updateData.interests }),
      ...(updateData.hobbies && { hobbies: updateData.hobbies }),
      ...(updateData.occupation !== undefined && {
        occupation: updateData.occupation,
      }),
      ...(updateData.company !== undefined && { company: updateData.company }),
      ...(updateData.notes !== undefined && { notes: updateData.notes }),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('contacts')
      .update(updatePayload)
      .eq('id', contactId)
      .eq('contact_owner', userId)
      .select('*')
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapDatabaseRecordToContact(data);
  }

  async deleteContact(userId: string, contactId: string): Promise<boolean> {
    // Delete associated events and media first
    await Promise.all([
      this.supabase.from('contact_events').delete().eq('contact_id', contactId),
      this.supabase.from('contact_media').delete().eq('contact_id', contactId),
    ]);

    const { error } = await this.supabase
      .from('contacts')
      .delete()
      .eq('id', contactId)
      .eq('contact_owner', userId);

    return !error;
  }

  // Event operations
  async addEvent(
    contactId: string,
    eventData: Partial<ContactEvent>,
  ): Promise<ContactEvent> {
    const newEvent = {
      contact_id: contactId,
      title: eventData.title || '',
      type: eventData.type || 'custom',
      date: eventData.date
        ? new Date(eventData.date).toISOString()
        : new Date().toISOString(),
      description: eventData.description,
      is_recurring: eventData.isRecurring || false,
      reminder_days: eventData.reminderDays || 7,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('contact_events')
      .insert([newEvent])
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to create event: ${error.message}`);
    }

    return this.mapDatabaseRecordToEvent(data);
  }

  async updateEvent(
    eventId: string,
    updateData: Partial<ContactEvent>,
  ): Promise<ContactEvent | null> {
    const updatePayload = {
      ...(updateData.title && { title: updateData.title }),
      ...(updateData.type && { type: updateData.type }),
      ...(updateData.date && { date: new Date(updateData.date).toISOString() }),
      ...(updateData.description !== undefined && {
        description: updateData.description,
      }),
      ...(updateData.isRecurring !== undefined && {
        is_recurring: updateData.isRecurring,
      }),
      ...(updateData.reminderDays !== undefined && {
        reminder_days: updateData.reminderDays,
      }),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('contact_events')
      .update(updatePayload)
      .eq('id', eventId)
      .select('*')
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapDatabaseRecordToEvent(data);
  }

  async deleteEvent(eventId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('contact_events')
      .delete()
      .eq('id', eventId);

    return !error;
  }

  private async getContactEvents(contactId: string): Promise<ContactEvent[]> {
    const { data, error } = await this.supabase
      .from('contact_events')
      .select('*')
      .eq('contact_id', contactId)
      .order('date', { ascending: true });

    if (error || !data) {
      return [];
    }

    return data.map(this.mapDatabaseRecordToEvent);
  }

  // Calendar functionality
  async getUpcomingEvents(
    userId: string,
    days: number = 30,
  ): Promise<Array<{ contact: Contact; event: ContactEvent }>> {
    const now = new Date();
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    // Get all contacts for the user
    const contacts = await this.getContacts(userId);
    const upcomingEvents: Array<{ contact: Contact; event: ContactEvent }> = [];

    for (const contact of contacts) {
      for (const event of contact.events || []) {
        const eventDate = new Date(event.date);

        // For recurring events, check if they occur within the next X days
        if (event.isRecurring) {
          const currentYear = now.getFullYear();

          // Check current year and next year for recurring events
          for (let year = currentYear; year <= currentYear + 1; year++) {
            const recurringDate = new Date(eventDate);
            recurringDate.setFullYear(year);

            if (recurringDate >= now && recurringDate <= futureDate) {
              upcomingEvents.push({
                contact,
                event: { ...event, date: recurringDate },
              });
            }
          }
        } else {
          // For non-recurring events
          if (eventDate >= now && eventDate <= futureDate) {
            upcomingEvents.push({ contact, event });
          }
        }
      }
    }

    // Sort by date
    return upcomingEvents.sort(
      (a, b) =>
        new Date(a.event.date).getTime() - new Date(b.event.date).getTime(),
    );
  }

  // Media operations
  async addMedia(
    contactId: string,
    mediaData: Partial<ContactMedia>,
  ): Promise<ContactMedia> {
    const newMedia = {
      contact_id: contactId,
      type: mediaData.type || 'image',
      filename: mediaData.filename || '',
      original_name: mediaData.originalName || '',
      mime_type: mediaData.mimeType || '',
      file_size: mediaData.size || 0,
      file_path: mediaData.path || '',
      description: mediaData.description,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('contact_media')
      .insert([newMedia])
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to create media: ${error.message}`);
    }

    return this.mapDatabaseRecordToMedia(data);
  }

  async deleteMedia(mediaId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('contact_media')
      .delete()
      .eq('id', mediaId);

    return !error;
  }

  async getMedia(mediaId: string): Promise<ContactMedia | null> {
    const { data, error } = await this.supabase
      .from('contact_media')
      .select('*')
      .eq('id', mediaId)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapDatabaseRecordToMedia(data);
  }

  private async getContactMedia(contactId: string): Promise<ContactMedia[]> {
    const { data, error } = await this.supabase
      .from('contact_media')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false });

    if (error || !data) {
      return [];
    }

    return data.map(this.mapDatabaseRecordToMedia);
  }

  // Search functionality
  async searchContacts(userId: string, query: string): Promise<Contact[]> {
    const lowerQuery = query.toLowerCase();

    const { data, error } = await this.supabase
      .from('contacts')
      .select('*')
      .eq('contact_owner', userId)
      .or(
        `first_name.ilike.%${lowerQuery}%,last_name.ilike.%${lowerQuery}%,email.ilike.%${lowerQuery}%,phone_number.ilike.%${lowerQuery}%,relationship.ilike.%${lowerQuery}%,occupation.ilike.%${lowerQuery}%,company.ilike.%${lowerQuery}%,notes.ilike.%${lowerQuery}%`,
      );

    if (error || !data) {
      return [];
    }

    // Load events and media for search results
    const contactsWithRelations = await Promise.all(
      data.map(async (contact) => {
        const [events, media] = await Promise.all([
          this.getContactEvents(contact.id),
          this.getContactMedia(contact.id),
        ]);

        return {
          ...this.mapDatabaseRecordToContact(contact),
          events,
          media,
        };
      }),
    );

    return contactsWithRelations;
  }

  // Helper methods to map database records to entities
  private mapDatabaseRecordToContact(record: any): Contact {
    return {
      id: record.id,
      // Prefer explicit user_id if present, otherwise fall back to contact_owner
      userId: record.user_id || record.contact_owner,
      firstName: record.first_name,
      lastName: record.last_name,
      email: record.email,
      phoneNumber: record.phone_number,
      address: record.address,
      relationship: record.relationship,
      socialMedia: record.social_media || {},
      interests: record.interests || [],
      hobbies: record.hobbies || [],
      occupation: record.occupation,
      company: record.company,
      notes: record.notes,
      events: [], // Will be populated by calling code
      media: [], // Will be populated by calling code
      createdAt: new Date(record.created_at),
      updatedAt: new Date(record.updated_at),
    };
  }

  private mapDatabaseRecordToEvent(record: any): ContactEvent {
    return {
      id: record.id,
      contactId: record.contact_id,
      title: record.title,
      type: record.type,
      date: new Date(record.date),
      description: record.description,
      isRecurring: record.is_recurring,
      reminderDays: record.reminder_days,
      createdAt: new Date(record.created_at),
      updatedAt: new Date(record.updated_at),
    };
  }

  private mapDatabaseRecordToMedia(record: any): ContactMedia {
    return {
      id: record.id,
      contactId: record.contact_id,
      type: record.type,
      filename: record.filename,
      originalName: record.original_name,
      mimeType: record.mime_type,
      size: record.file_size,
      path: record.file_path,
      description: record.description,
      createdAt: new Date(record.created_at),
    };
  }
}
