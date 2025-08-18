import { Injectable } from '@nestjs/common';
import { Contact, ContactEvent, ContactMedia } from './contact.entity';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ContactsService {
  private contactsFile = path.join(__dirname, '../../downloads/contacts.json');
  private eventsFile = path.join(
    __dirname,
    '../../downloads/contact-events.json',
  );
  private mediaFile = path.join(
    __dirname,
    '../../downloads/contact-media.json',
  );

  constructor() {
    this.ensureFilesExist();
  }

  private ensureFilesExist() {
    const dir = path.dirname(this.contactsFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (!fs.existsSync(this.contactsFile)) {
      fs.writeFileSync(this.contactsFile, JSON.stringify([], null, 2));
    }

    if (!fs.existsSync(this.eventsFile)) {
      fs.writeFileSync(this.eventsFile, JSON.stringify([], null, 2));
    }

    if (!fs.existsSync(this.mediaFile)) {
      fs.writeFileSync(this.mediaFile, JSON.stringify([], null, 2));
    }
  }

  private readContacts(): Contact[] {
    try {
      const data = fs.readFileSync(this.contactsFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }

  private writeContacts(contacts: Contact[]) {
    fs.writeFileSync(this.contactsFile, JSON.stringify(contacts, null, 2));
  }

  private readEvents(): ContactEvent[] {
    try {
      const data = fs.readFileSync(this.eventsFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }

  private writeEvents(events: ContactEvent[]) {
    fs.writeFileSync(this.eventsFile, JSON.stringify(events, null, 2));
  }

  private readMedia(): ContactMedia[] {
    try {
      const data = fs.readFileSync(this.mediaFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }

  private writeMedia(media: ContactMedia[]) {
    fs.writeFileSync(this.mediaFile, JSON.stringify(media, null, 2));
  }

  // Contact CRUD operations
  async createContact(
    userId: number,
    contactData: Partial<Contact>,
  ): Promise<Contact> {
    const contacts = this.readContacts();
    const newContact: Contact = {
      id: Date.now(),
      userId,
      firstName: contactData.firstName || '',
      lastName: contactData.lastName || '',
      email: contactData.email,
      phoneNumber: contactData.phoneNumber,
      address: contactData.address,
      relationship: contactData.relationship,
      socialMedia: contactData.socialMedia || {},
      interests: contactData.interests || [],
      hobbies: contactData.hobbies || [],
      occupation: contactData.occupation,
      company: contactData.company,
      notes: contactData.notes,
      events: [],
      media: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    contacts.push(newContact);
    this.writeContacts(contacts);
    return newContact;
  }

  async getContacts(userId: number): Promise<Contact[]> {
    const contacts = this.readContacts();
    const userContacts = contacts.filter((c) => c.userId === userId);

    // Load events and media for each contact
    const events = this.readEvents();
    const media = this.readMedia();

    return userContacts.map((contact) => ({
      ...contact,
      events: events.filter((e) => e.contactId === contact.id),
      media: media.filter((m) => m.contactId === contact.id),
    }));
  }

  async getContact(userId: number, contactId: number): Promise<Contact | null> {
    const contacts = this.readContacts();
    const contact = contacts.find(
      (c) => c.id === contactId && c.userId === userId,
    );

    if (!contact) return null;

    const events = this.readEvents();
    const media = this.readMedia();

    return {
      ...contact,
      events: events.filter((e) => e.contactId === contact.id),
      media: media.filter((m) => m.contactId === contact.id),
    };
  }

  async updateContact(
    userId: number,
    contactId: number,
    updateData: Partial<Contact>,
  ): Promise<Contact | null> {
    const contacts = this.readContacts();
    const contactIndex = contacts.findIndex(
      (c) => c.id === contactId && c.userId === userId,
    );

    if (contactIndex === -1) return null;

    contacts[contactIndex] = {
      ...contacts[contactIndex],
      ...updateData,
      updatedAt: new Date(),
    };

    this.writeContacts(contacts);
    return contacts[contactIndex];
  }

  async deleteContact(userId: number, contactId: number): Promise<boolean> {
    const contacts = this.readContacts();
    const contactIndex = contacts.findIndex(
      (c) => c.id === contactId && c.userId === userId,
    );

    if (contactIndex === -1) return false;

    contacts.splice(contactIndex, 1);
    this.writeContacts(contacts);

    // Delete associated events and media
    const events = this.readEvents();
    const filteredEvents = events.filter((e) => e.contactId !== contactId);
    this.writeEvents(filteredEvents);

    const media = this.readMedia();
    const filteredMedia = media.filter((m) => m.contactId !== contactId);
    this.writeMedia(filteredMedia);

    return true;
  }

  // Event operations
  async addEvent(
    contactId: number,
    eventData: Partial<ContactEvent>,
  ): Promise<ContactEvent> {
    const events = this.readEvents();
    const newEvent: ContactEvent = {
      id: Date.now(),
      contactId,
      title: eventData.title || '',
      type: eventData.type || 'custom',
      date: new Date(eventData.date || Date.now()),
      description: eventData.description,
      isRecurring: eventData.isRecurring || false,
      reminderDays: eventData.reminderDays || 7,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    events.push(newEvent);
    this.writeEvents(events);
    return newEvent;
  }

  async updateEvent(
    eventId: number,
    updateData: Partial<ContactEvent>,
  ): Promise<ContactEvent | null> {
    const events = this.readEvents();
    const eventIndex = events.findIndex((e) => e.id === eventId);

    if (eventIndex === -1) return null;

    events[eventIndex] = {
      ...events[eventIndex],
      ...updateData,
      updatedAt: new Date(),
    };

    this.writeEvents(events);
    return events[eventIndex];
  }

  async deleteEvent(eventId: number): Promise<boolean> {
    const events = this.readEvents();
    const eventIndex = events.findIndex((e) => e.id === eventId);

    if (eventIndex === -1) return false;

    events.splice(eventIndex, 1);
    this.writeEvents(events);
    return true;
  }

  // Calendar functionality
  async getUpcomingEvents(
    userId: number,
    days: number = 30,
  ): Promise<Array<{ contact: Contact; event: ContactEvent }>> {
    const contacts = await this.getContacts(userId);
    const now = new Date();
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    // Calendar events logic

    const upcomingEvents: Array<{ contact: Contact; event: ContactEvent }> = [];

    for (const contact of contacts) {
      // Use events from the contact object directly
      const contactEvents = contact.events || [];
      console.log(
        `getUpcomingEvents - contact ${contact.firstName} ${contact.lastName} has ${contactEvents.length} events`,
      );

      for (const event of contactEvents) {
        const eventDate = new Date(event.date);
        console.log(
          `getUpcomingEvents - checking event: ${event.title} on ${eventDate.toISOString()}, recurring: ${event.isRecurring}`,
        );

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
    const sortedEvents = upcomingEvents.sort(
      (a, b) =>
        new Date(a.event.date).getTime() - new Date(b.event.date).getTime(),
    );
    console.log('getUpcomingEvents - found events:', sortedEvents.length);
    return sortedEvents;
  }

  // Media operations
  async addMedia(
    contactId: number,
    mediaData: Partial<ContactMedia>,
  ): Promise<ContactMedia> {
    const media = this.readMedia();
    const newMedia: ContactMedia = {
      id: Date.now(),
      contactId,
      type: mediaData.type || 'image',
      filename: mediaData.filename || '',
      originalName: mediaData.originalName || '',
      mimeType: mediaData.mimeType || '',
      size: mediaData.size || 0,
      path: mediaData.path || '',
      description: mediaData.description,
      createdAt: new Date(),
    };

    media.push(newMedia);
    this.writeMedia(media);
    return newMedia;
  }

  async deleteMedia(mediaId: number): Promise<boolean> {
    const media = this.readMedia();
    const mediaIndex = media.findIndex((m) => m.id === mediaId);

    if (mediaIndex === -1) return false;

    // Delete the actual file
    const mediaItem = media[mediaIndex];
    try {
      if (fs.existsSync(mediaItem.path)) {
        fs.unlinkSync(mediaItem.path);
      }
    } catch (error) {
      console.error('Error deleting media file:', error);
    }

    media.splice(mediaIndex, 1);
    this.writeMedia(media);
    return true;
  }

  // Search functionality
  async searchContacts(userId: number, query: string): Promise<Contact[]> {
    const contacts = await this.getContacts(userId);
    const lowerQuery = query.toLowerCase();

    return contacts.filter(
      (contact) =>
        contact.firstName.toLowerCase().includes(lowerQuery) ||
        contact.lastName.toLowerCase().includes(lowerQuery) ||
        contact.email?.toLowerCase().includes(lowerQuery) ||
        contact.phoneNumber?.includes(lowerQuery) ||
        contact.relationship?.toLowerCase().includes(lowerQuery) ||
        contact.occupation?.toLowerCase().includes(lowerQuery) ||
        contact.company?.toLowerCase().includes(lowerQuery) ||
        contact.notes?.toLowerCase().includes(lowerQuery),
    );
  }

  // Get media by ID
  async getMedia(mediaId: number): Promise<ContactMedia | null> {
    const media = this.readMedia();
    return media.find((m) => m.id === mediaId) || null;
  }
}
