/**
 * Type definitions for AI-powered music analysis and recommendations
 */

/**
 * Spotify audio features for a track
 * All normalized values are between 0.0 and 1.0
 */
export interface AudioFeatures {
  id: string;
  danceability: number; // 0.0 - 1.0
  energy: number; // 0.0 - 1.0
  key: number; // 0-11 (C, C#, D, ...)
  loudness: number; // Typically -60 to 0 dB
  mode: number; // 0 (minor) or 1 (major)
  speechiness: number; // 0.0 - 1.0
  acousticness: number; // 0.0 - 1.0
  instrumentalness: number; // 0.0 - 1.0
  liveness: number; // 0.0 - 1.0
  valence: number; // 0.0 - 1.0 (musical positivity)
  tempo: number; // BPM (typically 40-220)
  duration_ms: number;
  time_signature: number; // 3-7 (beats per bar)
}

/**
 * Seed track with metadata and audio features for AI analysis
 */
export interface SeedTrack {
  id: string;
  name: string;
  artist: string;
  album?: string;
  genre?: string[];
  year?: number;
  audioFeatures: AudioFeatures;
}

/**
 * Target audio parameters for Spotify recommendations
 */
export interface TargetAudioParams {
  target_valence: number; // 0.0 - 1.0
  target_energy: number; // 0.0 - 1.0
  target_danceability: number; // 0.0 - 1.0
  min_popularity?: number; // 0-100
  target_acousticness?: number; // 0.0 - 1.0
  target_instrumentalness?: number; // 0.0 - 1.0
}

/**
 * AI analysis result from Groq LLM
 */
export interface AIAnalysisResult {
  playlistTitle: string;
  playlistDescription: string;
  reasoning: string;
  targetParams: TargetAudioParams;
  mood: string;
  tags: string[];
}

/**
 * Request body for POST /api/ai/analyze
 */
export interface AIAnalysisRequest {
  seedTracks: Array<{
    id: string;
    name: string;
    artist: string;
    album?: string;
    audioFeatures?: Partial<AudioFeatures>;
  }>;
}

/**
 * Response from POST /api/ai/analyze
 */
export interface AIAnalysisResponse {
  analysis: AIAnalysisResult;
  seedTracks: SeedTrack[];
  cached: boolean;
}

/**
 * User music preferences for AI analysis
 */
export interface UserMusicPreferences {
  explicitAllowed?: boolean;
  preferredGenres?: string[];
  avoidGenres?: string[];
}
