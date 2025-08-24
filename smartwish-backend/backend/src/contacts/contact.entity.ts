export class Contact {
  id: string;
  userId: string; // Owner of the contact
  firstName: string;
  lastName: string;
  email?: string;
  phoneNumber?: string;
  address?: string;
  relationship?: string; // Friend, Family, Colleague, etc.

  // Events/Important Dates
  events: ContactEvent[];

  // Social Media
  socialMedia?: {
    facebook?: string;
    instagram?: string;
    tiktok?: string;
    snapchat?: string;
    twitter?: string;
    linkedin?: string;
    whatsapp?: string;
  };

  // Personal Information
  interests?: string[];
  hobbies?: string[];
  occupation?: string;
  company?: string;

  // Notes and Media
  notes?: string;
  media: ContactMedia[];

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export class ContactEvent {
  id: string;
  contactId: string;
  title: string;
  type: 'birthday' | 'anniversary' | 'graduation' | 'wedding' | 'custom';
  date: Date;
  description?: string;
  isRecurring: boolean; // For annual events like birthdays
  reminderDays: number; // Days before event to remind
  createdAt: Date;
  updatedAt: Date;
}

export class ContactMedia {
  id: string;
  contactId: string;
  type: 'image' | 'video' | 'document';
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  description?: string;
  createdAt: Date;
}
