'use client';

import { useState, useEffect } from 'react';
import { User, LogOut, LogIn } from 'lucide-react';
import { signInWithGoogle, signOutUser, onAuthChange } from '@/lib/firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';

export default function AuthButton() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthChange((user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Sign in error:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 animate-pulse">
        <div className="w-6 h-6 rounded-full bg-gray-300" />
        <div className="w-20 h-4 bg-gray-300 rounded" />
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-50 text-blue-700">
          <User className="w-5 h-5" />
          <span className="text-sm font-medium">{user.displayName || user.email}</span>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-sm font-medium">Sign Out</span>
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleSignIn}
      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
    >
      <LogIn className="w-5 h-5" />
      <span className="text-sm font-medium">Sign In</span>
    </button>
  );
}


