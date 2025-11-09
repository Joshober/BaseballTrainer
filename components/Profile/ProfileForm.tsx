'use client';

import React, { useState, useEffect } from 'react';
import { Save, Loader2, CheckCircle } from 'lucide-react';
import { getAuthToken } from '@/lib/auth0/client';
import type { User } from '@/types/user';

interface ProfileFormProps {
  user: User | null;
  onUpdate?: (user: User) => void;
}

export default function ProfileForm({ user, onUpdate }: ProfileFormProps) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'player' | 'coach'>('player');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
      setEmail(user.email || '');
      setRole(user.role || 'player');
    }
  }, [user]);

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/users?uid=${user.uid}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          displayName,
          email,
          role,
        }),
      });

      if (!response.ok) {
        let errorMessage = `Failed to update profile: ${response.statusText}`;
        try {
          const text = await response.text();
          if (text) {
            const errorData = JSON.parse(text);
            errorMessage = errorData.error || errorMessage;
          }
        } catch {
          // ignore
        }
        throw new Error(errorMessage);
      }

      const updatedUser = await response.json();
      setSuccess(true);
      if (onUpdate) {
        onUpdate(updatedUser);
      }
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error('Profile update error:', err);
      setError(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const errorId = error ? 'profile-error' : undefined;
  const successId = success ? 'profile-success' : undefined;

  return (
    <div className="bg-white rounded-lg shadow-md p-6" aria-live="polite">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Profile Information</h2>

      {error && (
        <div
          id="profile-error"
          className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700"
          role="alert"
          aria-live="assertive"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          id="profile-success"
          className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700"
          role="status"
          aria-live="polite"
        >
          <CheckCircle className="w-5 h-5" aria-hidden="true" focusable="false" />
          <span>Profile updated successfully!</span>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="profile-display-name" className="block text-sm font-medium text-gray-700 mb-2">
            Display Name
          </label>
          <input
            id="profile-display-name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            aria-describedby={errorId ?? successId}
          />
        </div>

        <div>
          <label htmlFor="profile-email" className="block text-sm font-medium text-gray-700 mb-2">
            Email
          </label>
          <input
            id="profile-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled
            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
            aria-describedby="profile-email-help"
          />
          <p id="profile-email-help" className="mt-1 text-xs text-gray-500">
            Email cannot be changed
          </p>
        </div>

        <div>
          <label htmlFor="profile-role" className="block text-sm font-medium text-gray-700 mb-2">
            Role
          </label>
          <select
            id="profile-role"
            value={role}
            onChange={(e) => setRole(e.target.value as 'player' | 'coach')}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="player">Player</option>
            <option value="coach">Coach</option>
          </select>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          aria-busy={saving}
        >
          {saving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" focusable="false" />
              Saving…
            </>
          ) : (
            <>
              <Save className="w-5 h-5" aria-hidden="true" focusable="false" />
              Save Changes
            </>
          )}
        </button>
      </div>
    </div>
  );
}

