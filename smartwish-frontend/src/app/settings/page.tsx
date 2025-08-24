'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { useSession } from 'next-auth/react'
import { useUserProfile } from '@/hooks/useUserProfile'
import React from 'react'

/**
 * Minimal Sidebar placeholder used on the settings page.
 * If you have a shared Sidebar component in your project, replace this
 * implementation with: import Sidebar from '@/components/Sidebar'
 */
const Sidebar: React.FC = () => {
  return (
    <aside className="hidden md:block w-64" aria-hidden>
      {/* Placeholder sidebar - replace with real component if available */}
    </aside>
  )
}

interface FormData {
  name: string;
  email: string;
  phoneNumber: string;
  socialMedia: {
    facebook: string;
    instagram: string;
    tiktok: string;
    snapchat: string;
    whatsapp: string;
  };
  interests: string[];
  hobbies: string[];
}

interface PasswordFormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

// Brand icons (from Simple Icons), sized to fit 24x24 and using currentColor
function FacebookIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M22.675 0H1.325C.593 0 0 .593 0 1.325v21.35C0 23.407.593 24 1.325 24H12.82V14.706H9.69V11.09h3.13V8.413c0-3.1 1.893-4.788 4.66-4.788 1.325 0 2.463.097 2.795.141v3.24l-1.918.001c-1.504 0-1.796.715-1.796 1.764v2.319h3.59l-.467 3.616h-3.123V24h6.127C23.407 24 24 23.407 24 22.675V1.325C24 .593 23.407 0 22.675 0z"/>
    </svg>
  )
}

function InstagramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.35 3.608 1.325.975.975 1.263 2.242 1.325 3.608.058 1.266.07 1.646.07 4.85s-.012 3.584-.07 4.85c-.062 1.366-.35 2.633-1.325 3.608-.975.975-2.242 1.263-3.608 1.325-1.266.058-1.646.07-4.85.07s-3.584-.012-4.85-.07c-1.366-.062-2.633-.35-3.608-1.325-.975-.975-1.263-2.242-1.325-3.608C2.175 15.584 2.163 15.204 2.163 12s.012-3.584.07-4.85c.062-1.366.35-2.633 1.325-3.608C4.533 1.567 5.8 1.279 7.166 1.217 8.432 1.159 8.812 1.147 12 1.147m0-1.147C8.741 0 8.332.014 7.052.072 5.773.13 4.63.428 3.7 1.357 2.772 2.286 2.474 3.429 2.416 4.708 2.358 5.988 2.344 6.397 2.344 9.656v4.688c0 3.259.014 3.668.072 4.948.058 1.279.356 2.422 1.285 3.351.929.928 2.072 1.226 3.351 1.284 1.28.058 1.689.072 4.948.072s3.668-.014 4.948-.072c1.279-.058 2.422-.356 3.351-1.284.928-.929 1.226-2.072 1.284-3.351.058-1.28.072-1.689.072-4.948V9.656c0-3.259-.014-3.668-.072-4.948C21.556 3.429 21.258 2.286 20.33 1.357 19.401.428 18.258.13 16.979.072 15.699.014 15.289 0 12 0z"/>
      <path d="M12 5.838A6.162 6.162 0 1 0 18.162 12 6.169 6.169 0 0 0 12 5.838m0 10.188A4.025 4.025 0 1 1 16.025 12 4.03 4.03 0 0 1 12 16.026"/>
      <circle cx="18.406" cy="5.594" r="1.44"/>
    </svg>
  )
}

function TikTokIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12.5 3h2.665c.213 1.2.77 2.22 1.67 3.06.87.82 1.93 1.326 3.175 1.515V10.5c-1.47-.09-2.85-.53-4.14-1.32v5.415c0 3.7-2.765 6.405-6.36 6.405S3.15 18.295 3.15 14.595c0-3.28 2.315-5.97 5.43-6.36v3.02a3.13 3.13 0 0 0-2.31 3.015c0 1.74 1.41 3.15 3.15 3.15s3.15-1.41 3.15-3.15V3z"/>
    </svg>
  )
}

function SnapchatIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 2c3.26 0 5.57 2.23 5.57 5.43 0 1.02-.2 1.75-.2 1.75s.73.99 1.9 1.34c.62.19.96.86.69 1.45-.28.6-1.06.7-1.69.81-.52.09-.86.23-.86.23s.31.94 1.62 1.4c.41.15.65.63.53 1.07-.14.5-.64.78-1.15.69-.96-.17-1.65-.15-2.22.15-1 .5-1.9 1.95-3.19 1.95s-2.19-1.45-3.19-1.95c-.57-.3-1.26-.32-2.22-.15-.51.09-1.01-.19-1.15-.69-.12-.44.12-.92.53-1.07 1.31-.46 1.62-1.4 1.62-1.4s-.34-.14-.86-.23c-.63-.11-1.41-.21-1.69-.81-.27-.59.07-1.26.69-1.45 1.17-.35 1.9-1.34 1.9-1.34s-.2-.73-.2-1.75C6.43 4.23 8.74 2 12 2z"/>
    </svg>
  )
}

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const { user, loading, error, updateProfile, changePassword, uploadProfilePicture, clearError } = useUserProfile();
  
  // Form states
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phoneNumber: '',
    socialMedia: {
      facebook: '',
      instagram: '',
      tiktok: '',
      snapchat: '',
      whatsapp: ''
    },
    interests: [],
    hobbies: []
  });
  
  const [passwordData, setPasswordData] = useState<PasswordFormData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  const [interestInput, setInterestInput] = useState('');
  const [hobbyInput, setHobbyInput] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [passwordSuccessMessage, setPasswordSuccessMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [profilePicture, setProfilePicture] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Update form data when user data loads
  React.useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        phoneNumber: user.phoneNumber || '',
        socialMedia: {
          facebook: user.socialMedia?.facebook || '',
          instagram: user.socialMedia?.instagram || '',
          tiktok: user.socialMedia?.tiktok || '',
          snapchat: user.socialMedia?.snapchat || '',
          whatsapp: user.socialMedia?.whatsapp || ''
        },
        interests: user.interests || [],
        hobbies: user.hobbies || []
      });
    }
  }, [user]);

  // Show loading or error states
  if (status === 'loading' || loading) {
    return (
      <section className="w-full md:pl-16 lg:pl-20">
        <Sidebar />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
            <div className="space-y-4">
              <div className="h-32 bg-gray-200 rounded"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <section className="w-full md:pl-16 lg:pl-20">
        <Sidebar />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Please sign in</h1>
            <p className="mt-2 text-gray-600">You need to be signed in to access settings.</p>
          </div>
        </div>
      </section>
    );
  }

  const addInterest = () => {
    const trimmed = interestInput.trim();
    if (!trimmed) return;
    if (!formData.interests.includes(trimmed)) {
      setFormData(prev => ({
        ...prev,
        interests: [...prev.interests, trimmed]
      }));
    }
    setInterestInput('');
  };
  
  const removeInterest = (value: string) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.filter(v => v !== value)
    }));
  };
  
  const addHobby = () => {
    const trimmed = hobbyInput.trim();
    if (!trimmed) return;
    if (!formData.hobbies.includes(trimmed)) {
      setFormData(prev => ({
        ...prev,
        hobbies: [...prev.hobbies, trimmed]
      }));
    }
    setHobbyInput('');
  };
  
  const removeHobby = (value: string) => {
    setFormData(prev => ({
      ...prev,
      hobbies: prev.hobbies.filter(v => v !== value)
    }));
  };
  
  const handleInterestKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addInterest();
    }
  };
  
  const handleHobbyKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addHobby();
    }
  };
  
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    setSuccessMessage('');
    clearError();
    
    try {
      await updateProfile({
        name: formData.name,
        phoneNumber: formData.phoneNumber,
        socialMedia: formData.socialMedia,
        interests: formData.interests,
        hobbies: formData.hobbies
      });
      setSuccessMessage('Profile updated successfully!');
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      console.error('Failed to update profile:', err);
    } finally {
      setIsUpdating(false);
    }
  };
  
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear previous messages
    setPasswordSuccessMessage('');
    setPasswordError('');
    clearError();
    
    // Client-side validation
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    
    if (passwordData.newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long');
      return;
    }
    
    if (!passwordData.currentPassword) {
      setPasswordError('Current password is required');
      return;
    }
    
    setIsChangingPassword(true);
    
    try {
      const success = await changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
      
      if (success) {
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setPasswordSuccessMessage('Password changed successfully!');
        setTimeout(() => setPasswordSuccessMessage(''), 5000);
      } else {
        setPasswordError('Failed to change password. Please check your current password.');
      }
    } catch (err) {
      console.error('Failed to change password:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to change password';
      setPasswordError(errorMessage.includes('Current password is incorrect') 
        ? 'Current password is incorrect' 
        : 'Failed to change password. Please try again.');
    } finally {
      setIsChangingPassword(false);
    }
  };
  
  const handleProfilePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfilePicture(file);
      handleProfilePictureUpload(file);
    }
  };
  
  const handleProfilePictureUpload = async (file: File) => {
    setIsUpdating(true);
    clearError();
    
    try {
      const imageUrl = await uploadProfilePicture(file);
      if (imageUrl) {
        setSuccessMessage('Profile picture updated successfully!');
        setTimeout(() => setSuccessMessage(''), 5000);
      }
    } catch (err) {
      console.error('Failed to upload profile picture:', err);
    } finally {
      setIsUpdating(false);
      setProfilePicture(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <section className="w-full">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <main className="py-12 sm:py-16 lg:py-20">
          <h1 className="sr-only">Account Settings</h1>

          <div className="divide-y divide-gray-200 space-y-12">
            {/* Personal Information */}
            <div className="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 md:grid-cols-3">
              <div>
                <h2 className="text-base/7 font-semibold text-gray-900">Personal Information</h2>
                <p className="mt-1 text-sm/6 text-gray-500">Update your personal details and profile information.</p>
              </div>

              <form className="md:col-span-2" onSubmit={handleProfileSubmit}>
                <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:max-w-xl sm:grid-cols-6">
                  <div className="col-span-full flex items-center gap-x-8">
                    <Image
                      alt="Profile picture"
                      src={user?.profileImage || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"}
                      width={96}
                      height={96}
                      className="size-24 flex-none rounded-lg bg-gray-100 object-cover outline -outline-offset-1 outline-black/5"
                    />
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleProfilePictureChange}
                        className="hidden"
                        id="profile-picture-upload"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUpdating}
                        className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-xs inset-ring-1 inset-ring-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isUpdating ? 'Uploading...' : 'Change avatar'}
                      </button>
                      <p className="mt-2 text-xs/5 text-gray-500">JPG, GIF or PNG. 5MB max.</p>
                    </div>
                  </div>

                  {/* Email (read-only) */}
                  <div className="col-span-full">
                    <label className="block text-sm/6 font-medium text-gray-900">Email address</label>
                    <p className="mt-2 text-base text-gray-900">{user?.email}</p>
                  </div>

                  {/* Full Name */}
                  <div className="col-span-full">
                    <label htmlFor="full-name" className="block text-sm/6 font-medium text-gray-900">
                      Full name
                    </label>
                    <div className="mt-2">
                      <input
                        id="full-name"
                        name="full-name"
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        autoComplete="name"
                        className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
                      />
                    </div>
                  </div>
                  
                  {/* Phone Number */}
                  <div className="col-span-full">
                    <label htmlFor="phone" className="block text-sm/6 font-medium text-gray-900">
                      Phone number
                    </label>
                    <div className="mt-2">
                      <input
                        id="phone"
                        name="phone"
                        type="tel"
                        value={formData.phoneNumber}
                        onChange={(e) => setFormData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                        autoComplete="tel"
                        placeholder="+1 (555) 123-4567"
                        className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
                      />
                    </div>
                  </div>

                  {/* Social media (fixed platforms with logos) */}
                  <div className="col-span-full">
                    <label className="block text-sm/6 font-medium text-gray-900">Social profiles</label>
                    <div className="mt-3 space-y-3">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-white ring-1 ring-gray-200 text-[#1877F2]"><FacebookIcon className="h-5 w-5" /></span>
                        <input
                          value={formData.socialMedia.facebook}
                          onChange={(e) => setFormData(prev => ({ ...prev, socialMedia: { ...prev.socialMedia, facebook: e.target.value } }))}
                          placeholder="Facebook profile URL or @handle"
                          className="min-w-0 grow rounded-md bg-white px-3 py-2 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600"
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-white ring-1 ring-gray-200 text-[#E4405F]"><InstagramIcon className="h-5 w-5" /></span>
                        <input
                          value={formData.socialMedia.instagram}
                          onChange={(e) => setFormData(prev => ({ ...prev, socialMedia: { ...prev.socialMedia, instagram: e.target.value } }))}
                          placeholder="Instagram profile URL or @handle"
                          className="min-w-0 grow rounded-md bg-white px-3 py-2 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600"
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-white ring-1 ring-gray-200 text-black"><TikTokIcon className="h-5 w-5" /></span>
                        <input
                          value={formData.socialMedia.tiktok}
                          onChange={(e) => setFormData(prev => ({ ...prev, socialMedia: { ...prev.socialMedia, tiktok: e.target.value } }))}
                          placeholder="TikTok profile URL or @handle"
                          className="min-w-0 grow rounded-md bg-white px-3 py-2 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600"
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-[#FFFC00] ring-1 ring-gray-200 text-black"><SnapchatIcon className="h-5 w-5" /></span>
                        <input
                          value={formData.socialMedia.snapchat}
                          onChange={(e) => setFormData(prev => ({ ...prev, socialMedia: { ...prev.socialMedia, snapchat: e.target.value } }))}
                          placeholder="Snapchat profile URL or @handle"
                          className="min-w-0 grow rounded-md bg-white px-3 py-2 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600"
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-white ring-1 ring-gray-200 text-[#25D366]">📱</span>
                        <input
                          value={formData.socialMedia.whatsapp}
                          onChange={(e) => setFormData(prev => ({ ...prev, socialMedia: { ...prev.socialMedia, whatsapp: e.target.value } }))}
                          placeholder="WhatsApp number or @handle"
                          className="min-w-0 grow rounded-md bg-white px-3 py-2 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Interests (tags) */}
                  <div className="col-span-full">
                    <label className="block text-sm/6 font-medium text-gray-900">Interests</label>
                    <div className="mt-3">
                      <div className="flex flex-wrap gap-2">
                        {formData.interests.map((interest) => (
                          <span key={interest} className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-sm text-indigo-700">
                            {interest}
                            <button type="button" className="text-indigo-500 hover:text-indigo-700" onClick={() => removeInterest(interest)}>
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="mt-3 flex gap-2">
                        <input
                          value={interestInput}
                          onChange={(e) => setInterestInput(e.target.value)}
                          onKeyDown={handleInterestKey}
                          placeholder="Add interest and press Enter"
                          className="block min-w-0 grow rounded-md bg-white px-3 py-2 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
                        />
                        <button type="button" className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-xs inset-ring-1 inset-ring-gray-300 hover:bg-gray-100" onClick={addInterest}>
                          Add
                        </button>
                      </div>
                      <p className="mt-1 text-xs/5 text-gray-500">Use Enter or comma to add. You can add many.</p>
                    </div>
                  </div>
                  
                  {/* Hobbies (tags) */}
                  <div className="col-span-full">
                    <label className="block text-sm/6 font-medium text-gray-900">Hobbies</label>
                    <div className="mt-3">
                      <div className="flex flex-wrap gap-2">
                        {formData.hobbies.map((hobby) => (
                          <span key={hobby} className="inline-flex items-center gap-2 rounded-full bg-green-100 px-3 py-1 text-sm text-green-700">
                            {hobby}
                            <button type="button" className="text-green-500 hover:text-green-700" onClick={() => removeHobby(hobby)}>
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="mt-3 flex gap-2">
                        <input
                          value={hobbyInput}
                          onChange={(e) => setHobbyInput(e.target.value)}
                          onKeyDown={handleHobbyKey}
                          placeholder="Add hobby and press Enter"
                          className="block min-w-0 grow rounded-md bg-white px-3 py-2 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
                        />
                        <button type="button" className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-xs inset-ring-1 inset-ring-gray-300 hover:bg-gray-100" onClick={addHobby}>
                          Add
                        </button>
                      </div>
                      <p className="mt-1 text-xs/5 text-gray-500">Use Enter or comma to add. You can add many.</p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-4">
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="rounded-md mb-3 bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUpdating ? 'Saving...' : 'Save Profile'}
                  </button>
                  {successMessage && (
                    <p className="text-sm text-green-600">{successMessage}</p>
                  )}
                  {error && (
                    <p className="text-sm text-red-600">{error}</p>
                  )}
                </div>
              </form>
            </div>

            {/* Change password */}
            <div className="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 md:grid-cols-3 py-12 border-t border-gray-200">
              <div>
                <h2 className="text-base/7 font-semibold text-gray-900">Change password</h2>
                <p className="mt-1 text-sm/6 text-gray-500">Update your password associated with your account.</p>
              </div>

              <form className="md:col-span-2" onSubmit={handlePasswordSubmit}>
                <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:max-w-xl sm:grid-cols-6">
                  <div className="col-span-full">
                    <label htmlFor="current-password" className="block text-sm/6 font-medium text-gray-900">
                      Current password
                    </label>
                    <div className="mt-2">
                      <input
                        id="current-password"
                        name="current_password"
                        type="password"
                        value={passwordData.currentPassword}
                        onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                        autoComplete="current-password"
                        required
                        className="block w-full rounded-md bg-white px-3 py-2 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
                      />
                    </div>
                  </div>

                  <div className="col-span-full">
                    <label htmlFor="new-password" className="block text-sm/6 font-medium text-gray-900">
                      New password
                    </label>
                    <div className="mt-2">
                      <input
                        id="new-password"
                        name="new_password"
                        type="password"
                        value={passwordData.newPassword}
                        onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                        autoComplete="new-password"
                        minLength={8}
                        required
                        className="block w-full rounded-md bg-white px-3 py-2 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
                      />
                    </div>
                    <p className="mt-1 text-xs/5 text-gray-500">Must be at least 8 characters long.</p>
                  </div>

                  <div className="col-span-full">
                    <label htmlFor="confirm-password" className="block text-sm/6 font-medium text-gray-900">
                      Confirm password
                    </label>
                    <div className="mt-2">
                      <input
                        id="confirm-password"
                        name="confirm_password"
                        type="password"
                        value={passwordData.confirmPassword}
                        onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        autoComplete="new-password"
                        required
                        className="block w-full rounded-md bg-white px-3 py-2 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
                      />
                    </div>
                    {passwordData.newPassword && passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword && (
                      <p className="mt-1 text-xs text-red-600">Passwords do not match.</p>
                    )}
                  </div>
                </div>

                <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-4">
                  <button
                    type="submit"
                    disabled={isChangingPassword || !passwordData.currentPassword || !passwordData.newPassword || passwordData.newPassword !== passwordData.confirmPassword}
                    className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isChangingPassword ? 'Changing...' : 'Change Password'}
                  </button>
                  {passwordSuccessMessage && (
                    <p className="text-sm text-green-600">{passwordSuccessMessage}</p>
                  )}
                  {passwordError && (
                    <p className="text-sm text-red-600">{passwordError}</p>
                  )}
                  {error && (
                    <p className="text-sm text-red-600">{error}</p>
                  )}
                </div>
              </form>
            </div>

          </div>
        </main>
      </div>
    </section>
  )
}