'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { VirtualInput } from '@/components/VirtualInput';
import Link from 'next/link';
import { useKiosk } from '@/contexts/KioskContext';

interface AssignedKiosk {
  id: string;
  kioskId: string;
  name: string;
  storeId: string;
  assignedAt: string;
}

interface ManagerSession {
  id: string;
  email: string;
  name: string;
  token: string;
}

const MANAGER_SESSION_KEY = 'smartwish_manager_session';

export default function ManagerLoginPage() {
  const router = useRouter();
  const { activateKiosk } = useKiosk();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Logged in state
  const [session, setSession] = useState<ManagerSession | null>(null);
  const [kiosks, setKiosks] = useState<AssignedKiosk[]>([]);
  const [loadingKiosks, setLoadingKiosks] = useState(false);
  const [activatingKiosk, setActivatingKiosk] = useState<string | null>(null);

  // Check for existing session on mount
  useEffect(() => {
    const stored = localStorage.getItem(MANAGER_SESSION_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as ManagerSession;
        setSession(parsed);
      } catch {
        localStorage.removeItem(MANAGER_SESSION_KEY);
      }
    }
  }, []);

  // Load kiosks when session is available
  useEffect(() => {
    if (session?.token) {
      loadAssignedKiosks();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const loadAssignedKiosks = async () => {
    if (!session?.token) return;
    
    setLoadingKiosks(true);
    try {
      const response = await fetch('/api/managers/my-kiosks', {
        headers: {
          'Authorization': `Bearer ${session.token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setKiosks(data);
      } else if (response.status === 401) {
        // Token expired, clear session
        handleLogout();
      } else {
        console.error('Failed to load kiosks');
      }
    } catch (err) {
      console.error('Error loading kiosks:', err);
    } finally {
      setLoadingKiosks(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/managers/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        const newSession: ManagerSession = {
          id: data.id,
          email: data.email,
          name: data.name,
          token: data.token,
        };
        localStorage.setItem(MANAGER_SESSION_KEY, JSON.stringify(newSession));
        setSession(newSession);
        setEmail('');
        setPassword('');
      } else {
        setError(data.error || 'Invalid email or password');
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(MANAGER_SESSION_KEY);
    setSession(null);
    setKiosks([]);
  };

  const handleActivateKiosk = async (kiosk: AssignedKiosk) => {
    setActivatingKiosk(kiosk.id);
    try {
      // Use the KioskContext to activate
      await activateKiosk(kiosk.id);
      // Redirect to home/templates page
      router.push('/templates');
    } catch (err) {
      console.error('Failed to activate kiosk:', err);
      setError('Failed to activate kiosk. Please try again.');
    } finally {
      setActivatingKiosk(null);
    }
  };

  // Show dashboard if logged in
  if (session) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Manager Dashboard</h1>
              <p className="mt-1 text-gray-600">
                Welcome, {session.name} ({session.email})
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-500 hover:text-gray-700 font-medium"
            >
              Sign out
            </button>
          </div>

          {error && (
            <div className="mb-6 rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Assigned Kiosks */}
          <div className="bg-white shadow-sm rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Your Assigned Kiosks</h2>
              <p className="text-sm text-gray-500">
                Select a kiosk to activate it on this device
              </p>
            </div>

            {loadingKiosks ? (
              <div className="p-12 text-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent mx-auto"></div>
                <p className="mt-4 text-gray-500">Loading your kiosks...</p>
              </div>
            ) : kiosks.length === 0 ? (
              <div className="p-12 text-center">
                <svg className="h-12 w-12 text-gray-400 mx-auto" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
                </svg>
                <h3 className="mt-4 text-lg font-medium text-gray-900">No kiosks assigned</h3>
                <p className="mt-2 text-gray-500">
                  Contact your administrator to get kiosks assigned to your account.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {kiosks.map((kiosk) => (
                  <div
                    key={kiosk.id}
                    className="px-6 py-4 flex items-center justify-between hover:bg-gray-50"
                  >
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">
                        {kiosk.name || kiosk.kioskId}
                      </h3>
                      <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
                        <span>ID: {kiosk.kioskId}</span>
                        {kiosk.storeId && <span>Store: {kiosk.storeId}</span>}
                      </div>
                      <p className="mt-1 text-xs text-gray-400">
                        Assigned: {new Date(kiosk.assignedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleActivateKiosk(kiosk)}
                      disabled={activatingKiosk === kiosk.id}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {activatingKiosk === kiosk.id ? (
                        <>
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2"></span>
                          Activating...
                        </>
                      ) : (
                        'Activate on this Device'
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Refresh button */}
          <div className="mt-4 text-center">
            <button
              onClick={loadAssignedKiosks}
              disabled={loadingKiosks}
              className="text-sm text-indigo-600 hover:text-indigo-500 font-medium"
            >
              Refresh kiosk list
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Login form
  return (
    <div className="flex min-h-screen flex-col justify-center py-12 sm:px-6 lg:px-8 bg-gray-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h1 className="text-center text-3xl font-bold text-indigo-600">SmartWish</h1>
        <h2 className="mt-6 text-center text-2xl font-bold tracking-tight text-gray-900">
          Manager Login
        </h2>
        <p className="mt-2 text-center text-sm text-gray-500">
          Sign in to manage your kiosks
        </p>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-[480px]">
        <div className="bg-white px-6 py-12 shadow-sm sm:rounded-lg sm:px-12">
          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-900">
                Email address
              </label>
              <div className="mt-2">
                <VirtualInput
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-900">
                Password
              </label>
              <div className="mt-2">
                <VirtualInput
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm"
                  placeholder="Your password"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </div>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-gray-500">
          Need help?{' '}
          <Link href="mailto:support@smartwish.us" className="font-semibold text-indigo-600 hover:text-indigo-500">
            Contact support
          </Link>
        </p>
      </div>
    </div>
  );
}
