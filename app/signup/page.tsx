'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { UserPlus, Mail, Lock, User } from 'lucide-react';
import { signUpWithGoogle, signUpWithEmail, getAuthUser, getAuthToken } from '@/lib/auth0/client';

export default function SignUpPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<'player' | 'coach'>('player');

  useEffect(() => {
    // Check if user is already authenticated
    const token = getAuthToken();
    const user = getAuthUser();
    
    if (token && user) {
      checkUserProfile(token, user);
    }
    
    // Check for error from callback
    const errorParam = searchParams.get('error');
    if (errorParam) {
      setError(decodeURIComponent(errorParam));
    }
  }, [searchParams]);

  const checkUserProfile = async (token: string, user: any) => {
    try {
      const response = await fetch(`/api/users?uid=${user.sub}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        // User exists, redirect to appropriate dashboard
        const userData = await response.json();
        if (userData.role === 'coach') {
          router.push('/coach');
        } else {
          router.push('/player');
        }
      }
      // If user doesn't exist, they need to complete signup
    } catch (error) {
      console.error('Failed to get user data:', error);
    }
  };

  const handleGoogleSignUp = () => {
    setLoading(true);
    setError(null);
    
    // Check if role is selected
    if (!selectedRole) {
      setError('Please select whether you are a Player or Coach');
      setLoading(false);
      return;
    }
    
    // Store selected role in session storage before redirect
    sessionStorage.setItem('selectedRole', selectedRole);
    signUpWithGoogle();
  };

  const handleEmailSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    // Validate password length
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    // Store selected role in session storage
    sessionStorage.setItem('selectedRole', selectedRole);
    
    try {
      const result = await signUpWithEmail(email, password);
      if (result && result.success) {
        // Check if user was automatically signed in
        const token = getAuthToken();
        const user = getAuthUser();
        
        if (token && user) {
          // User was automatically signed in, create profile
          await createUserProfile(token, user, selectedRole);
        } else {
          // User needs to sign in manually
          setError('Account created successfully. Please sign in.');
          setLoading(false);
          // Redirect to login after a short delay
          setTimeout(() => {
            router.push('/login?email=' + encodeURIComponent(email));
          }, 2000);
        }
      }
    } catch (error: any) {
      setError(error.message || 'Registration failed. Please try again.');
      setLoading(false);
    }
  };
  
  const createUserProfile = async (token: string, user: any, role: string) => {
    try {
      // Check if user already exists
      const checkResponse = await fetch(`/api/users?uid=${user.sub}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!checkResponse.ok) {
        // User doesn't exist, create user with selected role
        const createResponse = await fetch('/api/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            uid: user.sub,
            displayName: user.name || user.nickname || user.email?.split('@')[0] || 'User',
            email: user.email || '',
            role: role,
          }),
        });
        
        if (createResponse.ok) {
          sessionStorage.removeItem('selectedRole');
          
          // Redirect based on selected role
          if (role === 'coach') {
            router.push('/coach');
          } else {
            router.push('/player');
          }
        } else {
          const errorData = await createResponse.json();
          setError(errorData.error || 'Failed to create user profile');
          setLoading(false);
        }
      } else {
        // User exists, redirect will be handled by checkUserProfile
        sessionStorage.removeItem('selectedRole');
        await checkUserProfile(token, user);
      }
    } catch (error) {
      console.error('Failed to create user profile:', error);
      setError('Failed to create user profile. Please try again.');
      setLoading(false);
    }
  };

  // After Auth0 callback (for Google OAuth), create user profile
  useEffect(() => {
    const handleGoogleCallback = async () => {
      const token = getAuthToken();
      const user = getAuthUser();
      
      if (!token || !user) return;
      
      const storedRole = sessionStorage.getItem('selectedRole');
      if (!storedRole) return; // No role selected, skip
      
      try {
        // Check if user already exists
        const checkResponse = await fetch(`/api/users?uid=${user.sub}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (!checkResponse.ok) {
          // User doesn't exist, create user with selected role
          await createUserProfile(token, user, storedRole);
        } else {
          // User exists, redirect will be handled by checkUserProfile
          sessionStorage.removeItem('selectedRole');
          await checkUserProfile(token, user);
        }
      } catch (error) {
        console.error('Failed to create user profile:', error);
      }
    };

    const token = getAuthToken();
    const user = getAuthUser();
    if (token && user) {
      handleGoogleCallback();
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-white rounded-xl shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserPlus className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Account</h1>
          <p className="text-gray-600">Sign up to get started</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          {/* Role Selection */}
          <div className="bg-gray-50 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              I am signing up as:
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setSelectedRole('player')}
                disabled={loading}
                className={`flex-1 px-4 py-3 rounded-lg transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                  selectedRole === 'player'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-blue-400'
                }`}
              >
                <User className="w-5 h-5" />
                Player
              </button>
              <button
                type="button"
                onClick={() => setSelectedRole('coach')}
                disabled={loading}
                className={`flex-1 px-4 py-3 rounded-lg transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                  selectedRole === 'coach'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-blue-400'
                }`}
              >
                <User className="w-5 h-5" />
                Coach
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500 text-center">
              Selected: <span className="font-semibold capitalize">{selectedRole}</span>
            </p>
          </div>

          {/* Google Sign Up */}
          <button
            onClick={handleGoogleSignUp}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {loading ? 'Signing up...' : 'Continue with Google'}
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or sign up with email</span>
            </div>
          </div>

          {/* Email/Password Sign Up */}
          <form onSubmit={handleEmailSignUp} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  disabled={loading}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="you@example.com"
                />
              </div>
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  id="password"
                  name="password"
                  required
                  disabled={loading}
                  minLength={6}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="At least 6 characters"
                />
              </div>
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  required
                  disabled={loading}
                  minLength={6}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="Confirm your password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Creating account...
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  Create Account as {selectedRole === 'coach' ? 'Coach' : 'Player'}
                </>
              )}
            </button>
          </form>
        </div>

        <div className="mt-6 text-center space-y-2">
          <p className="text-sm text-gray-600">
            Already have an account?{' '}
            <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
              Sign in here
            </Link>
          </p>
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
