'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Target, Loader2, Search, Filter } from 'lucide-react';
import { onAuthChange, getFirebaseAuth } from '@/lib/firebase/auth';
import { getDrills, searchDrills, type Drill } from '@/lib/services/drill-recommender';
import { getAuthToken } from '@/lib/auth0/client';
import DrillCard from '@/components/Drills/DrillCard';
import PageContainer from '@/components/Layout/PageContainer';

export default function DrillsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [drills, setDrills] = useState<Drill[]>([]);
  const [filteredDrills, setFilteredDrills] = useState<Drill[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  const [selectedDrill, setSelectedDrill] = useState<Drill | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthChange((authUser) => {
      if (!authUser) {
        router.push('/login');
      } else {
        setUser(authUser);
        loadDrills();
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

