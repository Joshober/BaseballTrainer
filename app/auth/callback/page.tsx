'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    const userStr = searchParams.get('user');
    
    if (token && userStr) {
      try {
        const user = JSON.parse(decodeURIComponent(userStr));
        
        // Store token in localStorage (in production, use secure HTTP-only cookies)
        localStorage.setItem('auth_token', token);
        localStorage.setItem('auth_user', JSON.stringify(user));
        
        // Check if user has a profile
        checkUserProfile(token, user);
      } catch (error) {
        console.error('Failed to parse user data:', error);
        router.push('/login?error=parse_error');
      }
    } else {
      router.push('/login?error=no_token');
    }
  }, [searchParams, router]);

  const checkUserProfile = async (token: string, user: any) => {
    try {
      const response = await fetch(`/api/users?uid=${user.sub}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const userData = await response.json();
        if (userData.role === 'coach') {
          router.push('/coach');
        } else {
          router.push('/player');
        }
      } else {
        // User doesn't exist yet, redirect to signup
        router.push('/signup');
      }
    } catch (error) {
      console.error('Failed to get user data:', error);
      router.push('/signup');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Completing sign in...</p>
      </div>
    </div>
  );
}

