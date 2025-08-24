// hooks/useUserProfile.ts
import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { userAPI, User, UpdateProfileData, ChangePasswordData } from '@/utils/userAPI';

interface UseUserProfileReturn {
  user: User | null;
  loading: boolean;
  error: string | null;
  updateProfile: (data: UpdateProfileData) => Promise<User | null>;
  changePassword: (data: ChangePasswordData) => Promise<boolean>;
  uploadProfilePicture: (file: File) => Promise<string | null>;
  updatePhoneNumber: (phoneNumber: string) => Promise<User | null>;
  refetch: () => Promise<void>;
  clearError: () => void;
}

export const useUserProfile = (): UseUserProfileReturn => {
  const { data: session, status } = useSession();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const fetchProfile = useCallback(async () => {
    if (!session?.user?.access_token || status === 'loading') {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const profile = await userAPI.getProfile(session as any);
      setUser(profile);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load profile';
      setError(errorMessage);
      console.error('Error fetching user profile:', err);
    } finally {
      setLoading(false);
    }
  }, [session, status]);

  const updateProfile = useCallback(async (profileData: UpdateProfileData): Promise<User | null> => {
    if (!session?.user?.access_token) {
      setError('Not authenticated');
      return null;
    }

    try {
      setError(null);
      const updatedProfile = await userAPI.updateProfile(profileData, session as any);
      setUser(updatedProfile);
      return updatedProfile;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update profile';
      setError(errorMessage);
      console.error('Error updating profile:', err);
      return null;
    }
  }, [session]);

  const changePassword = useCallback(async (passwordData: ChangePasswordData): Promise<boolean> => {
    if (!session?.user?.access_token) {
      setError('Not authenticated');
      return false;
    }

    try {
      setError(null);
      await userAPI.changePassword(passwordData, session as any);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to change password';
      setError(errorMessage);
      console.error('Error changing password:', err);
      return false;
    }
  }, [session]);

  const uploadProfilePicture = useCallback(async (file: File): Promise<string | null> => {
    if (!session?.user?.access_token) {
      setError('Not authenticated');
      return null;
    }

    try {
      setError(null);
      const result = await userAPI.uploadProfilePicture(file, session as any);
      setUser(result.user);
      return result.imageUrl;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload profile picture';
      setError(errorMessage);
      console.error('Error uploading profile picture:', err);
      return null;
    }
  }, [session]);

  const updatePhoneNumber = useCallback(async (phoneNumber: string): Promise<User | null> => {
    if (!session?.user?.access_token) {
      setError('Not authenticated');
      return null;
    }

    try {
      setError(null);
      const updatedProfile = await userAPI.updatePhoneNumber(phoneNumber, session as any);
      setUser(updatedProfile);
      return updatedProfile;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update phone number';
      setError(errorMessage);
      console.error('Error updating phone number:', err);
      return null;
    }
  }, [session]);

  // Fetch profile on mount and when session changes
  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return {
    user,
    loading,
    error,
    updateProfile,
    changePassword,
    uploadProfilePicture,
    updatePhoneNumber,
    refetch: fetchProfile,
    clearError,
  };
};