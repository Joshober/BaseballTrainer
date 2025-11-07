'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, Loader2 } from 'lucide-react';
import { onAuthChange } from '@/lib/hooks/useAuth';
import { getAuthUser, getAuthToken } from '@/lib/auth0/client';
import ProfileForm from '@/components/Profile/ProfileForm';
import ProfileStats from '@/components/Profile/ProfileStats';
import PageContainer from '@/components/Layout/PageContainer';
import type { User as UserType } from '@/types/user';
import type { Session } from '@/types/session';

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserType | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [authUser, setAuthUser] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthChange((authUser) => {
      if (!authUser) {
        router.push('/login');
      } else {
        setAuthUser(authUser);
        loadUserData();
      }
    });

    return () => unsubscribe();
  }, [router]);

  const loadUserData = async () => {
    try {
      const auth0User = getAuthUser();
      if (!auth0User) {
        setLoading(false);
        return;
      }

      const token = getAuthToken();
      if (!token) {
        setLoading(false);
        return;
      }

      // Load user profile
      const userResponse = await fetch(`/api/users?uid=${auth0User.sub}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (userResponse.ok) {
        const userData = await userResponse.json();
        setUser(userData);
      }

      // Load user sessions
      if (auth0User) {
        const sessionsResponse = await fetch(`/api/sessions?uid=${auth0User.sub}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (sessionsResponse.ok) {
          const sessionsData = await sessionsResponse.json();
          setSessions(sessionsData);
        }
      }
    } catch (error) {
      console.error('Failed to load user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = (updatedUser: UserType) => {
    setUser(updatedUser);
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="flex items-center gap-3 mb-8">
        <User className="w-8 h-8 text-blue-600" />
        <h1 className="text-3xl font-bold text-gray-900">Profile</h1>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <ProfileForm user={user} onUpdate={handleUpdate} />
        <ProfileStats sessions={sessions} />
      </div>
    </PageContainer>
  );
}

