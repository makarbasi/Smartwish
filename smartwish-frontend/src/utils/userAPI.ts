// utils/userAPI.ts
import { authGet, postRequest, putRequest } from './request_utils';

// Types based on your users table structure
export interface User {
  id: string;
  email: string;
  name: string;
  password?: never; // Never exposed in frontend
  role: 'user' | 'admin' | 'moderator';
  oauthProvider: 'local' | 'google' | 'instagram' | 'whatsapp';
  oauthId?: string;
  oauthAccessToken?: string;
  oauthRefreshToken?: string;
  profileImage?: string;
  phoneNumber?: string;
  socialMedia?: {
    facebook?: string;
    instagram?: string;
    tiktok?: string;
    snapchat?: string;
    whatsapp?: string;
  };
  interests?: string[];
  hobbies?: string[];
  status: 'active' | 'inactive' | 'suspended' | 'pending_verification';
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  lastLoginAt?: string;
  lastPasswordChangeAt?: string;
  loginAttempts: number;
  lockedUntil?: string;
  metadata?: Record<string, any>;
  canPublishTemplates: boolean;
  canModerateTemplates: boolean;
  authorProfileId?: string;
  totalTemplatesPublished: number;
  totalTemplateDownloads: number;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfileData {
  email?: string;
  name?: string;
  phoneNumber?: string;
  socialMedia?: {
    facebook?: string;
    instagram?: string;
    tiktok?: string;
    snapchat?: string;
    whatsapp?: string;
  };
  interests?: string[];
  hobbies?: string[];
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

export interface ResetPasswordData {
  token: string;
  newPassword: string;
}

export interface AuthSession {
  user: {
    id: string;
    email: string;
    name: string;
    access_token: string;
    refresh_token?: string;
    access_expires?: number;
  };
}

export class UserAPI {
  private baseURL: string;

  constructor() {
    this.baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  }

  /**
   * Get the current user's profile
   */
  async getProfile(session: AuthSession): Promise<User> {
    const response = await authGet<User>(`${this.baseURL}/user/profile`, session);
    return response.data || response as any;
  }

  /**
   * Update the current user's profile
   */
  async updateProfile(profileData: UpdateProfileData, session: AuthSession): Promise<User> {
    const response = await putRequest<User>(
      `${this.baseURL}/user/profile`,
      profileData,
      session
    );
    return response.data || response as any;
  }

  /**
   * Upload a profile picture
   */
  async uploadProfilePicture(imageFile: File, session: AuthSession): Promise<{ user: User; imageUrl: string }> {
    const formData = new FormData();
    formData.append('image', imageFile);

    const response = await postRequest<{ user: User; imageUrl: string }>(
      `${this.baseURL}/user/profile/image`,
      formData,
      session
    );
    return response.data || response as any;
  }

  /**
   * Change password (requires current password)
   */
  async changePassword(passwordData: ChangePasswordData, session: AuthSession): Promise<{ message: string }> {
    const response = await postRequest<{ message: string }>(
      `${this.baseURL}/user/change-password`,
      passwordData,
      session
    );
    return response.data || response as any;
  }

  /**
   * Request a password reset (public endpoint)
   */
  async requestPasswordReset(email: string): Promise<{ message: string; resetToken?: string; expiresAt?: string }> {
    const response = await postRequest<{ message: string; resetToken?: string; expiresAt?: string }>(
      `${this.baseURL}/user/request-password-reset`,
      { email }
    );
    return response.data || response as any;
  }

  /**
   * Reset password using token (public endpoint)
   */
  async resetPassword(resetData: ResetPasswordData): Promise<{ message: string }> {
    const response = await postRequest<{ message: string }>(
      `${this.baseURL}/user/reset-password`,
      resetData
    );
    return response.data || response as any;
  }

  /**
   * Update phone number
   */
  async updatePhoneNumber(phoneNumber: string, session: AuthSession): Promise<User> {
    const response = await putRequest<User>(
      `${this.baseURL}/user/phone`,
      { phoneNumber },
      session
    );
    return response.data || response as any;
  }

  /**
   * Alternative forgot password endpoint
   */
  async forgotPassword(email: string): Promise<{ message: string; resetToken?: string; expiresAt?: string }> {
    const response = await postRequest<{ message: string; resetToken?: string; expiresAt?: string }>(
      `${this.baseURL}/auth/forgot-password`,
      { email }
    );
    return response.data || response as any;
  }

  /**
   * Test Supabase storage configuration
   */
  async testStorageStatus(): Promise<{ supabaseConfigured: boolean; message: string }> {
    const response = await fetch(`${this.baseURL}/user/storage-test`);
    return await response.json();
  }
}

// Export a singleton instance
export const userAPI = new UserAPI();