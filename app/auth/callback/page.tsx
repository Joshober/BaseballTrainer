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
        // Decode the token and user from URL parameters
        const decodedToken = decodeURIComponent(token);
        const user = JSON.parse(decodeURIComponent(userStr));
        
        // Validate token format
        // Auth0 can return either:
        // - Regular JWT (3 parts: header.payload.signature)
        // - Encrypted JWT/JWE (5 parts: header.encrypted_key.iv.ciphertext.tag)
        const tokenParts = decodedToken.split('.');
        if (tokenParts.length !== 3 && tokenParts.length !== 5) {
          console.error('Invalid token format. Expected 3 or 5 parts, got:', tokenParts.length);
          console.error('Token preview:', decodedToken.substring(0, 100));
          router.push('/login?error=invalid_token');
          return;
        }
        
        // Store token in localStorage (in production, use secure HTTP-only cookies)
        localStorage.setItem('auth_token', decodedToken);
        localStorage.setItem('auth_user', JSON.stringify(user));
        
        // Check if user has a profile
        checkUserProfile(decodedToken, user);
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
        // Respect returnTo saved before redirect (if any)
        const rt = localStorage.getItem('auth_return_to');
        if (rt) {
          localStorage.removeItem('auth_return_to');
          router.push(rt);
          return;
        }
        router.push('/player');
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

