// Contact types matching backend schema

export interface ContactEvent {
  id: number;
  contactId: number;
  title: string;
  type: 'birthday' | 'anniversary' | 'graduation' | 'wedding' | 'custom';
  date: string | Date;
  description?: string;
  isRecurring: boolean;
  reminderDays: number;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface ContactMedia {
  id: number;
  contactId: number;
  type: 'image' | 'video' | 'document';
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  description?: string;
  createdAt: string | Date;
}

export interface Contact {
  id: number;
  userId: number;
  firstName: string;
  lastName: string;
  email?: string;
  phoneNumber?: string;
  address?: string;
  relationship?: string;
  
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
  createdAt: string | Date;
  updatedAt: string | Date;
}

// Frontend-specific types
export interface ContactFormData {
  firstName: string;
  lastName: string;
  email?: string;
  phoneNumber?: string;
  address?: string;
  relationship?: string;
  socialMedia?: {
    facebook?: string;
    instagram?: string;
    tiktok?: string;
    snapchat?: string;
    twitter?: string;
    linkedin?: string;
    whatsapp?: string;
  };
  interests?: string[];
  hobbies?: string[];
  occupation?: string;
  company?: string;
  notes?: string;
}

export interface ContactsResponse {
  success: boolean;
  data: Contact[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ContactResponse {
  success: boolean;
  data: Contact;
}

// Legacy types for backward compatibility (to be removed gradually)
export interface LegacyContact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  avatar?: string;
  company?: string;
  address?: string;
  occupation?: string;
  notes?: string;
  relationship?: string;
  socialLinks?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
    whatsapp?: string;
  };
  interests?: string[];
  createdAt: string;
}