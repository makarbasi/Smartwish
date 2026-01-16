# User Management API Documentation

This document outlines the enhanced user management API endpoints with password reset functionality and profile picture upload to Supabase storage.

## Table of Contents

1. [Authentication Endpoints](#authentication-endpoints)
2. [User Profile Endpoints](#user-profile-endpoints)
3. [Password Management](#password-management)
4. [Profile Picture Management](#profile-picture-management)
5. [Usage Examples](#usage-examples)

## Authentication Endpoints

### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "access_token": "jwt_token_here",
  "refresh_token": "refresh_token_here",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "User Name",
    "role": "user",
    "status": "active"
  }
}
```

### Register
```http
POST /auth/signup
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "name": "User Name"
}
```

### Forgot Password
```http
POST /auth/forgot-password
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "message": "If the email exists, a password reset link has been sent",
  "resetToken": "development_token_here",
  "expiresAt": "2025-08-24T12:00:00.000Z"
}
```

## User Profile Endpoints

### Get Profile
```http
GET /user/profile
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "User Name",
  "phoneNumber": "+1234567890",
  "profileImage": "https://supabase_url/profile-images/profile_uuid.jpg",
  "socialMedia": {
    "facebook": "@username",
    "instagram": "@username",
    "tiktok": "@username",
    "snapchat": "@username",
    "whatsapp": "+1234567890"
  },
  "interests": ["technology", "design", "art"],
  "hobbies": ["photography", "reading"],
  "status": "active",
  "isEmailVerified": true,
  "isPhoneVerified": false,
  "createdAt": "2025-08-20T00:58:15.134Z",
  "updatedAt": "2025-08-24T01:36:30.825Z"
}
```

### Update Profile
```http
PUT /user/profile
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "name": "Updated Name",
  "phoneNumber": "+1234567890",
  "socialMedia": {
    "facebook": "@newfacebook",
    "instagram": "@newinstagram",
    "tiktok": "@newtiktok",
    "snapchat": "@newsnapchat",
    "whatsapp": "+1234567890"
  },
  "interests": ["technology", "design", "art", "music"],
  "hobbies": ["photography", "reading", "gaming"]
}
```

## Password Management

### Change Password
```http
POST /user/change-password
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "currentPassword": "oldpassword123",
  "newPassword": "newpassword123"
}
```

**Response:**
```json
{
  "message": "Password changed successfully"
}
```

### Request Password Reset
```http
POST /user/request-password-reset
Content-Type: application/json

{
  "email": "user@example.com"
}
```

### Reset Password
```http
POST /user/reset-password
Content-Type: application/json

{
  "token": "reset_token_from_email",
  "newPassword": "newpassword123"
}
```

**Response:**
```json
{
  "message": "Password reset successfully"
}
```

## Profile Picture Management

### Upload Profile Picture
```http
POST /user/profile/image
Authorization: Bearer <jwt_token>
Content-Type: multipart/form-data

Form data:
- image: (file) - Image file (JPG, PNG, GIF - max 5MB)
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "User Name",
    "profileImage": "https://supabase_url/profile-images/profile_uuid.jpg"
  },
  "imageUrl": "https://supabase_url/profile-images/profile_uuid.jpg"
}
```

### Update Phone Number
```http
PUT /user/phone
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "phoneNumber": "+1234567890"
}
```

## Usage Examples

### Frontend Integration Examples

#### JavaScript/TypeScript API Client

```typescript
class UserAPI {
  private baseURL = 'http://localhost:3000'; // Your backend URL
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
  }

  private getHeaders(includeAuth = true) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (includeAuth && this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    
    return headers;
  }

  // Authentication
  async login(email: string, password: string) {
    const response = await fetch(`${this.baseURL}/auth/login`, {
      method: 'POST',
      headers: this.getHeaders(false),
      body: JSON.stringify({ email, password }),
    });
    
    if (!response.ok) throw new Error('Login failed');
    
    const data = await response.json();
    this.setToken(data.access_token);
    return data;
  }

  async register(email: string, password: string, name: string) {
    const response = await fetch(`${this.baseURL}/auth/signup`, {
      method: 'POST',
      headers: this.getHeaders(false),
      body: JSON.stringify({ email, password, name }),
    });
    
    if (!response.ok) throw new Error('Registration failed');
    return response.json();
  }

  // Profile Management
  async getProfile() {
    const response = await fetch(`${this.baseURL}/user/profile`, {
      headers: this.getHeaders(),
    });
    
    if (!response.ok) throw new Error('Failed to get profile');
    return response.json();
  }

  async updateProfile(profileData: {
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
  }) {
    const response = await fetch(`${this.baseURL}/user/profile`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(profileData),
    });
    
    if (!response.ok) throw new Error('Failed to update profile');
    return response.json();
  }

  // Password Management
  async changePassword(currentPassword: string, newPassword: string) {
    const response = await fetch(`${this.baseURL}/user/change-password`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    
    if (!response.ok) throw new Error('Failed to change password');
    return response.json();
  }

  async requestPasswordReset(email: string) {
    const response = await fetch(`${this.baseURL}/user/request-password-reset`, {
      method: 'POST',
      headers: this.getHeaders(false),
      body: JSON.stringify({ email }),
    });
    
    if (!response.ok) throw new Error('Failed to request password reset');
    return response.json();
  }

  async resetPassword(token: string, newPassword: string) {
    const response = await fetch(`${this.baseURL}/user/reset-password`, {
      method: 'POST',
      headers: this.getHeaders(false),
      body: JSON.stringify({ token, newPassword }),
    });
    
    if (!response.ok) throw new Error('Failed to reset password');
    return response.json();
  }

  // Profile Picture
  async uploadProfilePicture(imageFile: File) {
    const formData = new FormData();
    formData.append('image', imageFile);

    const response = await fetch(`${this.baseURL}/user/profile/image`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
      },
      body: formData,
    });
    
    if (!response.ok) throw new Error('Failed to upload profile picture');
    return response.json();
  }
}
```

#### React Hook Example

```typescript
import { useState, useEffect } from 'react';

interface User {
  id: string;
  email: string;
  name: string;
  phoneNumber?: string;
  profileImage?: string;
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

export const useUserProfile = (api: UserAPI) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const profile = await api.getProfile();
      setUser(profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (profileData: Partial<User>) => {
    try {
      setError(null);
      const updatedProfile = await api.updateProfile(profileData);
      setUser(updatedProfile);
      return updatedProfile;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
      throw err;
    }
  };

  const uploadProfilePicture = async (file: File) => {
    try {
      setError(null);
      const result = await api.uploadProfilePicture(file);
      setUser(result.user);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload image');
      throw err;
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  return {
    user,
    loading,
    error,
    updateProfile,
    uploadProfilePicture,
    refetch: fetchProfile,
  };
};
```

### Settings Page Integration Example

```typescript
// Updated Settings Page Component
import { useState } from 'react';
import { useUserProfile } from './hooks/useUserProfile';
import { UserAPI } from './api/userAPI';

export default function SettingsPage() {
  const api = new UserAPI();
  const { user, updateProfile, uploadProfilePicture, loading, error } = useUserProfile(api);
  
  const [profilePicture, setProfilePicture] = useState<File | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleProfilePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfilePicture(file);
    }
  };

  const handleUploadProfilePicture = async () => {
    if (!profilePicture) return;
    
    try {
      await uploadProfilePicture(profilePicture);
      setProfilePicture(null);
      alert('Profile picture updated successfully!');
    } catch (err) {
      alert('Failed to upload profile picture');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      alert('New passwords do not match');
      return;
    }

    try {
      await api.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      alert('Password changed successfully!');
    } catch (err) {
      alert('Failed to change password');
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    
    try {
      await updateProfile({
        name: formData.get('name') as string,
        phoneNumber: formData.get('phoneNumber') as string,
        socialMedia: {
          facebook: formData.get('facebook') as string,
          instagram: formData.get('instagram') as string,
          tiktok: formData.get('tiktok') as string,
          snapchat: formData.get('snapchat') as string,
        },
      });
      alert('Profile updated successfully!');
    } catch (err) {
      alert('Failed to update profile');
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {/* Your existing JSX with added functionality */}
      <form onSubmit={handleUpdateProfile}>
        {/* Profile form fields */}
        <input name="name" defaultValue={user?.name} />
        <input name="phoneNumber" defaultValue={user?.phoneNumber} />
        {/* Add other fields */}
      </form>
      
      {/* Profile Picture Upload */}
      <div>
        <input type="file" accept="image/*" onChange={handleProfilePictureChange} />
        <button onClick={handleUploadProfilePicture} disabled={!profilePicture}>
          Upload Picture
        </button>
      </div>

      {/* Password Change Form */}
      <form onSubmit={handleChangePassword}>
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="Current Password"
        />
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="New Password"
        />
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirm New Password"
        />
        <button type="submit">Change Password</button>
      </form>
    </div>
  );
}
```

## Environment Variables

Make sure your `.env` file includes the following Supabase configuration:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

## Supabase Storage Setup

1. Create a bucket named `smartwish-assets` in your Supabase Storage
2. Create the following folder structure:
   - `profile-images/`
   - `users/{user_id}/designs/{design_id}/`
3. Set appropriate RLS (Row Level Security) policies for your storage bucket

## Security Features

1. **Password Reset**: Uses secure tokens with 15-minute expiration
2. **Profile Pictures**: Uploaded to Supabase Storage with proper validation
3. **Rate Limiting**: Built-in protection against brute force attacks
4. **Audit Logging**: All user actions are logged for security monitoring
5. **Account Lockout**: Automatic lockout after 5 failed login attempts
6. **Email Enumeration Protection**: Consistent responses regardless of email existence

## Error Handling

All endpoints return appropriate HTTP status codes:
- `200`: Success
- `400`: Bad Request (validation errors)
- `401`: Unauthorized (authentication required)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found
- `409`: Conflict (email already exists, etc.)
- `500`: Internal Server Error

Error responses include a descriptive message:
```json
{
  "statusCode": 400,
  "message": "Password must be at least 8 characters long",
  "error": "Bad Request"
}
```