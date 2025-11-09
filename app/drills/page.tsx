'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Target, Loader2, Search, Filter } from 'lucide-react';
import { onAuthChange } from '@/lib/hooks/useAuth';
import { getDrills, searchDrills, getDrillRecommendations, type Drill } from '@/lib/services/drill-recommender';
import { getAuthToken, getAuthUser } from '@/lib/auth0/client';
import DrillCard from '@/components/Drills/DrillCard';
import PageContainer from '@/components/Layout/PageContainer';

export default function DrillsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [drills, setDrills] = useState<Drill[]>([]);
  const [filteredDrills, setFilteredDrills] = useState<Drill[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  const [selectedDrill, setSelectedDrill] = useState<Drill | null>(null);

  // Session-scoped recommendations
  const [recommendedDrills, setRecommendedDrills] = useState<Drill[] | null>(null);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [recommendationsError, setRecommendationsError] = useState<string | null>(null);

  // Gemini-generated drills from OpenRouter feedback
  const [geminiDrills, setGeminiDrills] = useState<any[]>([]);
  const [loadingGeminiDrills, setLoadingGeminiDrills] = useState(false);
  const [geminiDrillsError, setGeminiDrillsError] = useState<string | null>(null);
  const [openRouterFeedback, setOpenRouterFeedback] = useState<string | null>(null);


  useEffect(() => {
    let hasLoadedDrills = false;
    
    const unsubscribe = onAuthChange((authUser) => {
      if (!authUser) {
        router.push('/login');
      } else {
        setUser(authUser);
        // Only load drills once when user is first authenticated
        if (!hasLoadedDrills) {
          hasLoadedDrills = true;
          loadDrills();
        }
      }
    });

    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    filterDrills();
  }, [drills, searchQuery, categoryFilter, difficultyFilter]);

  const loadDrills = async () => {
    try {
      setLoading(true);
      const token = getAuthToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await getDrills({}, token);
      if (response.success) {
        setDrills(response.drills);
      }
    } catch (error) {
      console.error('Failed to load drills:', error);
    } finally {
      setLoading(false);
    }
  };

  // If feedback is provided, generate drills using Gemini
  useEffect(() => {
    const feedback = searchParams?.get('feedback');
    if (!feedback) return;

    let cancelled = false;
    (async () => {
      try {
        setLoadingGeminiDrills(true);
        setGeminiDrillsError(null);
        setOpenRouterFeedback(feedback);

        const response = await fetch('/api/gemini/generate-drills', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ feedback }),
        });

        if (!response.ok) {
          throw new Error('Failed to generate drills');
        }

        const data = await response.json();
        if (!cancelled) {
          if (data.success && data.drills) {
            setGeminiDrills(data.drills);
          } else {
            setGeminiDrillsError(data.error || 'Failed to generate drills');
          }
        }
      } catch (e: any) {
        if (!cancelled) {
          setGeminiDrillsError(e.message || 'Failed to generate drills');
        }
      } finally {
        if (!cancelled) {
          setLoadingGeminiDrills(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);


  // If a sessionId is provided, surface session-specific recommendations
  useEffect(() => {
    const sessionId = searchParams?.get('sessionId');
    if (!sessionId) return;

    let cancelled = false;
    (async () => {
      try {
        setLoadingRecommendations(true);
        setRecommendationsError(null);
        const token = getAuthToken();
        if (!token) return;

        // Load session to check for persisted recommendations and analysis
        const resp = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!resp.ok) throw new Error('Failed to load session');
        const session = await resp.json();

        // Use stored recommendations if present
        const stored = session?.recommendations;
        if (stored) {
          const recs: Drill[] | null =
            Array.isArray(stored) ? stored :
            (stored?.recommendations && Array.isArray(stored.recommendations)) ? stored.recommendations :
            null;
          if (!cancelled && recs) {
            setRecommendedDrills(recs);
            return;
          }
        }

        // Otherwise compute on the fly using metrics we can derive
        const analysis = session?.videoAnalysis?.ok ? session.videoAnalysis : null;
        const metrics = analysis?.metrics || {};
        const biomech = analysis?.biomechanics || {};
        const rotation = biomech?.rotation_angles || {};
        const request = {
          metrics: {
            launchAngle: typeof metrics.launchAngle === 'number' ? metrics.launchAngle : undefined,
            shoulderAngle: typeof rotation.shoulder_rotation === 'number' ? rotation.shoulder_rotation : undefined,
            hipAngle: typeof rotation.hip_rotation === 'number' ? rotation.hip_rotation : undefined,
            confidence: typeof metrics.confidence === 'number' ? metrics.confidence : undefined,
          },
          limit: 5,
        };
        const recResp = await getDrillRecommendations(request, token);
        if (!cancelled && recResp?.success && Array.isArray(recResp.recommendations)) {
          setRecommendedDrills(recResp.recommendations);
        }
      } catch (e: any) {
        if (!cancelled) setRecommendationsError(e.message || 'Failed to load recommendations');
      } finally {
        if (!cancelled) setLoadingRecommendations(false);
      }
    })();

    return () => { cancelled = true; };
  }, [searchParams]);

  const filterDrills = () => {
    let filtered = [...drills];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (drill) =>
          drill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          drill.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          drill.tags?.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter((drill) => drill.category === categoryFilter);
    }

    // Difficulty filter
    if (difficultyFilter !== 'all') {
      filtered = filtered.filter((drill) => drill.difficulty === difficultyFilter);
    }

    setFilteredDrills(filtered);
  };

  const handleDrillSelect = (drill: Drill) => {
    setSelectedDrill(drill);
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
      {/* Gemini-generated Drills from OpenRouter Feedback */}
      {openRouterFeedback && (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Target className="w-6 h-6 text-orange-600" />
            <h2 className="text-2xl font-bold text-gray-900">Recommended Hitting Drills</h2>
          </div>
          {loadingGeminiDrills ? (
            <div className="flex items-center justify-center min-h-[120px] bg-white rounded-lg shadow-md">
              <Loader2 className="w-6 h-6 animate-spin text-orange-600" />
              <span className="ml-3 text-gray-600">Generating personalized drills...</span>
            </div>
          ) : geminiDrillsError ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
              <p className="font-semibold mb-2">Error generating drills</p>
              <p className="text-sm">{geminiDrillsError}</p>
            </div>
          ) : geminiDrills.length > 0 ? (
            <div className="mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-800">
                  <strong>Coaching Feedback:</strong> {openRouterFeedback}
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {geminiDrills.map((drill, index) => (
                  <div key={index} className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden">
                    <div className="p-4">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">{drill.name}</h3>
                      <p className="text-sm text-gray-600 mb-3">{drill.description}</p>
                      {drill.rationale && (
                        <div className="mt-3 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
                          <strong className="block mb-1">Why this drill helps:</strong>
                          {drill.rationale}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-md p-4 text-gray-600">
              No drills generated. Please try again.
            </div>
          )}
        </div>
      )}

      {/* Session-specific Recommendations */}
      {searchParams?.get('sessionId') && !openRouterFeedback && (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Target className="w-6 h-6 text-emerald-600" />
            <h2 className="text-2xl font-bold text-gray-900">Recommended for your session</h2>
          </div>
          {loadingRecommendations ? (
            <div className="flex items-center justify-center min-h-[120px] bg-white rounded-lg shadow-md">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
            </div>
          ) : recommendationsError ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800">
              {recommendationsError}
            </div>
          ) : recommendedDrills && recommendedDrills.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
              {recommendedDrills.map((drill) => (
                <DrillCard key={drill._id} drill={drill} onSelect={setSelectedDrill} />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-md p-4 text-gray-600">
              No recommendations yet. Complete a video analysis to get personalized drills.
            </div>
          )}
        </div>
      )}

      {/* Drill Library (only show if no OpenRouter feedback) */}
      {!openRouterFeedback && (
        <>
          <div className="flex items-center gap-3 mb-8">
            <Target className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Drill Library</h1>
          </div>

          {/* Search and Filters */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search drills..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Categories</option>
                  <option value="hitting">Hitting</option>
                  <option value="pitching">Pitching</option>
                  <option value="fielding">Fielding</option>
                  <option value="conditioning">Conditioning</option>
                </select>
                <select
                  value={difficultyFilter}
                  onChange={(e) => setDifficultyFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Levels</option>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
            </div>
          </div>

          {/* Drill Grid */}
          {filteredDrills.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <Target className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <p className="text-lg text-gray-600">No drills found matching your criteria.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDrills.map((drill) => (
                <DrillCard key={drill._id} drill={drill} onSelect={handleDrillSelect} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Drill Detail Modal */}
      {selectedDrill && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-900">{selectedDrill.name}</h2>
              <button
                onClick={() => setSelectedDrill(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ×
              </button>
            </div>
            <p className="text-gray-600 mb-4">{selectedDrill.description}</p>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Instructions</h3>
                <ol className="list-decimal list-inside space-y-2 text-gray-700">
                  {selectedDrill.instructions?.map((instruction, idx) => (
                    <li key={idx}>{instruction}</li>
                  ))}
                </ol>
              </div>
              {selectedDrill.equipment && selectedDrill.equipment.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Equipment Needed</h3>
                  <ul className="list-disc list-inside text-gray-700">
                    {selectedDrill.equipment.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}

