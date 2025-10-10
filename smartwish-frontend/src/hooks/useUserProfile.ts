// hooks/useUserProfile.ts
import { useState, useEffect, useCallback, useRef } from 'react';
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

// Cache to prevent excessive API calls
const profileCache = new Map<string, { data: User; timestamp: number }>();
const CACHE_DURATION = 60000; // 1 minute cache
const MIN_REQUEST_INTERVAL = 2000; // Minimum 2 seconds between requests

export const useUserProfile = (): UseUserProfileReturn => {
  const { data: session, status } = useSession();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastFetchTime = useRef<number>(0);
  const isFetching = useRef<boolean>(false);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const fetchProfile = useCallback(async (forceRefresh: boolean = false) => {
    if (!session?.user?.access_token || status === 'loading') {
      setLoading(false);
      return;
    }

    const userId = session.user.id;
    const now = Date.now();

    // Prevent rapid successive requests
    if (!forceRefresh && (now - lastFetchTime.current < MIN_REQUEST_INTERVAL)) {
      console.log('⏱️ Skipping profile fetch - too soon after last request');
      setLoading(false);
      return;
    }

    // Check if already fetching
    if (isFetching.current && !forceRefresh) {
      console.log('⏱️ Profile fetch already in progress');
      return;
    }

    // Check cache first
    if (!forceRefresh && profileCache.has(userId)) {
      const cached = profileCache.get(userId)!;
      if (now - cached.timestamp < CACHE_DURATION) {
        console.log('📦 Using cached profile data');
        setUser(cached.data);
        setLoading(false);
        return;
      }
    }

    try {
      isFetching.current = true;
      setLoading(true);
      setError(null);
      lastFetchTime.current = now;

      const profile = await userAPI.getProfile(session as any);
      setUser(profile);

      // Update cache
      profileCache.set(userId, { data: profile, timestamp: now });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load profile';
      setError(errorMessage);
      console.error('Error fetching user profile:', err);
    } finally {
      setLoading(false);
      isFetching.current = false;
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

      // Update cache
      const userId = session.user.id;
      profileCache.set(userId, { data: updatedProfile, timestamp: Date.now() });

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

      // Update cache
      const userId = session.user.id;
      profileCache.set(userId, { data: result.user, timestamp: Date.now() });

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

      // Update cache
      const userId = session.user.id;
      profileCache.set(userId, { data: updatedProfile, timestamp: Date.now() });

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

  const refetch = useCallback(async () => {
    await fetchProfile(true); // Force refresh on manual refetch
  }, [fetchProfile]);

  return {
    user,
    loading,
    error,
    updateProfile,
    changePassword,
    uploadProfilePicture,
    updatePhoneNumber,
    refetch,
    clearError,
  };
};