'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Activity } from 'lucide-react';
import { onAuthChange } from '@/lib/hooks/useAuth';
import { getBlastSessions, getBlastSession, syncBlastSession, syncBlastMetrics, compareBlastWithPose } from '@/lib/services/blast-connector';
import { getAuthToken, getAuthUser } from '@/lib/auth0/client';
import BlastConnection from '@/components/Blast/BlastConnection';
import BlastMetrics from '@/components/Blast/BlastMetrics';
import PageContainer from '@/components/Layout/PageContainer';
import type { BlastData, BlastSession } from '@/lib/services/blast-connector';

export default function BlastPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [connectedDeviceId, setConnectedDeviceId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<BlastSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<BlastSession | null>(null);
  const [currentData, setCurrentData] = useState<BlastData | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthChange((authUser) => {
      if (!authUser) {
        router.push('/login');
      } else {
        setUser(authUser);
        setLoading(false);
        loadSessions();
      }
    });

    return () => unsubscribe();
  }, [router]);

  const loadSessions = async () => {
    try {
      const token = getAuthToken();
      if (!token) return;

      const response = await getBlastSessions(10, 0, token);
      if (response.success) {
        setSessions(response.sessions);
      }
    } catch (error) {
      console.error('Failed to load Blast sessions:', error);
    }
  };

  const handleConnected = (deviceId: string) => {
    setConnectedDeviceId(deviceId);
  };

  const handleData = (data: BlastData) => {
    setCurrentData(data);
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
        <Activity className="w-8 h-8 text-blue-600" />
        <h1 className="text-3xl font-bold text-gray-900">Blast Motion Integration</h1>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Connection */}
        <BlastConnection onConnected={handleConnected} onData={handleData} />

        {/* Current Metrics */}
        {currentData && (
          <BlastMetrics data={currentData} />
        )}
      </div>

      {/* Sessions */}
      {sessions.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Sessions</h2>
          <div className="space-y-4">
            {sessions.map((session) => (
              <div
                key={session._id}
                className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                onClick={() => setSelectedSession(session)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">Session {session.sessionId}</p>
                    <p className="text-sm text-gray-600">
                      {new Date(session.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  {session.latestData && (
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-700">
                        Bat Speed: {session.latestData.metrics.batSpeed?.toFixed(1) || 'N/A'} mph
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Session Detail Modal */}
      {selectedSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Session Details</h2>
              <button
                onClick={() => setSelectedSession(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ×
              </button>
            </div>
            {selectedSession.latestData && (
              <BlastMetrics data={selectedSession.latestData.metrics as BlastData} />
            )}
          </div>
        </div>
      )}
    </PageContainer>
  );
}

