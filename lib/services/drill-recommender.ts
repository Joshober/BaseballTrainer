/**
 * Drill recommender service client
 * Provides functions to interact with the drill recommender API
 * Routes through the main backend gateway
 */
import { getBackendUrl } from '@/lib/utils/backend-url';

export interface Drill {
  _id: string;
  name: string;
  description: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  equipment: string[];
  corrections: string[];
  instructions: string[];
  duration: number;
  reps: number;
  tags: string[];
  videoUrl?: string;
  imageUrl?: string;
}

export interface RecommendationRequest {
  corrections?: string[];
  metrics?: {
    launchAngle?: number;
    shoulderAngle?: number;
    hipAngle?: number;
    handAngle?: number;
    confidence?: number;
  };
  limit?: number;
}

export interface RecommendationResponse {
  success: boolean;
  recommendations: Drill[];
  count: number;
}

/**
 * Get drill recommendations based on swing analysis
 */
export async function getDrillRecommendations(
  request: RecommendationRequest,
  authToken?: string
): Promise<RecommendationResponse> {
  const url = `${getBackendUrl()}/api/drills/recommend`;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get recommendations: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Search drills by query
 */
export async function searchDrills(
  query: string,
  corrections?: string[],
  authToken?: string
): Promise<{ success: boolean; results: Drill[]; count: number }> {
  const url = `${getBackendUrl()}/api/drills/search`;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      query,
      corrections,
    }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to search drills: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Get all drills with optional filters
 */
export async function getDrills(
  filters?: {
    category?: string;
    difficulty?: string;
    equipment?: string;
  },
  authToken?: string
): Promise<{ success: boolean; drills: Drill[]; count: number }> {
  const params = new URLSearchParams();
  if (filters?.category) params.append('category', filters.category);
  if (filters?.difficulty) params.append('difficulty', filters.difficulty);
  if (filters?.equipment) params.append('equipment', filters.equipment);
  
  const url = `${getBackendUrl()}/api/drills?${params.toString()}`;
  
  const headers: HeadersInit = {};
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  const response = await fetch(url, {
    method: 'GET',
    headers,
  });
  
  if (!response.ok) {
    let errorMessage = `Failed to get drills: ${response.statusText}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorData.error || errorMessage;
    } catch {
      // If response is not JSON, use status text
    }
    throw new Error(errorMessage);
  }
  
  return response.json();
}

/**
 * Get a specific drill by ID
 */
export async function getDrillById(
  drillId: string,
  authToken?: string
): Promise<{ success: boolean; drill: Drill }> {
  const url = `${getBackendUrl()}/api/drills/${drillId}`;
  
  const headers: HeadersInit = {};
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  const response = await fetch(url, {
    method: 'GET',
    headers,
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get drill: ${response.statusText}`);
  }
  
  return response.json();
}

