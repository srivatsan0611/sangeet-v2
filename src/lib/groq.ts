import Groq from "groq-sdk";
import type {
  SeedTrack,
  AIAnalysisResult,
  TargetAudioParams,
} from "@/types/ai";

/**
 * System prompt for music analysis
 * Instructs the LLM to act as a master musicologist
 */
const MUSIC_ANALYSIS_SYSTEM_PROMPT = `You are a master musicologist and playlist curator with deep expertise in music theory, audio engineering, and cultural context. Your task is to analyze seed tracks and design a cohesive playlist recipe.

ANALYSIS FRAMEWORK:
1. **Emotional Arc**: Identify the underlying mood trajectory (is it consistent or does it build/descend?)
2. **Sonic Signature**: Determine the audio feature ranges that define this vibe
3. **Cultural Context**: Consider genre conventions, era influences, and lyrical themes
4. **Cohesion Strategy**: Decide whether to mirror the seeds exactly or create an evolving journey

AUDIO FEATURES GUIDE:
- **Valence** (0.0-1.0): Musical positivity. 0.0 = sad/angry, 1.0 = happy/euphoric
- **Energy** (0.0-1.0): Perceived intensity. 0.0 = calm, 1.0 = intense/loud
- **Danceability** (0.0-1.0): Rhythm suitability for dancing
- **Acousticness** (0.0-1.0): Acoustic vs electronic instrumentation
- **Instrumentalness** (0.0-1.0): Likelihood of no vocals

RULES:
- Target values should be weighted averages of seed tracks, NOT exact matches
- Allow ±0.15 variance for organic discovery
- min_popularity should be 40-70 (avoid obscure tracks unless seeds are indie)
- Playlist title must be evocative and creative (NOT generic like "Chill Vibes Playlist")
- Reasoning must explain the "why" behind parameter choices

OUTPUT FORMAT (JSON):
{
  "playlistTitle": "Neon Midnight Drive",
  "playlistDescription": "A sonic journey through synth-heavy, melancholic pop perfect for late-night drives. Blends 80s nostalgia with modern production.",
  "reasoning": "The seeds show high energy (0.75 avg) but low valence (0.35 avg), indicating an intense yet melancholic mood. The prevalence of synth-pop suggests targeting electronic-leaning tracks with strong beats but introspective lyrics.",
  "targetParams": {
    "target_valence": 0.35,
    "target_energy": 0.75,
    "target_danceability": 0.65,
    "min_popularity": 50,
    "target_acousticness": 0.2
  },
  "mood": "melancholic-energetic",
  "tags": ["synthwave", "nocturnal", "80s-inspired", "introspective"]
}`;

/**
 * Groq LLM client for AI-powered music analysis
 * Follows the SpotifyClient pattern for consistency
 */
export class GroqClient {
  private client: Groq;

  constructor() {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      throw new Error(
        "GROQ_API_KEY environment variable is required but not set"
      );
    }

    this.client = new Groq({
      apiKey,
      timeout: 30 * 1000, // 30 seconds
      maxRetries: 2,
    });
  }

  /**
   * Analyzes seed tracks to generate playlist recommendations
   * Uses Groq's llama-3.3-70b-versatile model for music analysis
   *
   * @param seedTracks Array of tracks with audio features to analyze
   * @returns AI-generated playlist parameters and reasoning
   */
  async analyzeMusicVibes(seedTracks: SeedTrack[]): Promise<AIAnalysisResult> {
    if (seedTracks.length === 0) {
      throw new Error("At least one seed track is required for analysis");
    }

    // Validate audio features
    this.validateAudioFeatures(seedTracks);

    // Prepare seed tracks for analysis
    const tracksForAnalysis = seedTracks.map((track) => ({
      name: track.name,
      artist: track.artist,
      album: track.album,
      audioFeatures: {
        valence: track.audioFeatures.valence,
        energy: track.audioFeatures.energy,
        danceability: track.audioFeatures.danceability,
        acousticness: track.audioFeatures.acousticness,
        instrumentalness: track.audioFeatures.instrumentalness,
        tempo: track.audioFeatures.tempo,
        key: track.audioFeatures.key,
        mode: track.audioFeatures.mode,
      },
    }));

    const userMessage = `Analyze these ${seedTracks.length} seed tracks and create a playlist recipe:

${JSON.stringify(tracksForAnalysis, null, 2)}

Return ONLY a JSON object matching the format specified in your instructions. Do not include any additional text or explanation.`;

    try {
      const chatCompletion = await this.client.chat.completions.create({
        messages: [
          {
            role: "system",
            content: MUSIC_ANALYSIS_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: userMessage,
          },
        ],
        model: "llama-3.3-70b-versatile",
        temperature: 0.7, // Balanced creativity and consistency
        max_tokens: 1000,
        response_format: { type: "json_object" }, // Force JSON output
      });

      const content = chatCompletion.choices[0]?.message?.content;

      if (!content) {
        throw new Error("Groq API returned empty response");
      }

      // Parse and validate the response
      const analysis = JSON.parse(content);
      return this.validateAnalysisResult(analysis);
    } catch (error) {
      if (error instanceof Groq.APIError) {
        // Handle Groq-specific errors
        if (error.status === 429) {
          throw new Error(
            "Rate limit exceeded. Please try again in a few moments."
          );
        }
        throw new Error(`Groq API error: ${error.message}`);
      }

      if (error instanceof SyntaxError) {
        throw new Error("Failed to parse AI response as JSON");
      }

      throw error;
    }
  }

  /**
   * Validates audio features are within acceptable ranges
   */
  private validateAudioFeatures(seedTracks: SeedTrack[]): void {
    for (const track of seedTracks) {
      const features = track.audioFeatures;

      // Validate normalized features (0.0 - 1.0)
      const normalizedFeatures = [
        "valence",
        "energy",
        "danceability",
        "acousticness",
        "instrumentalness",
        "liveness",
        "speechiness",
      ] as const;

      for (const feature of normalizedFeatures) {
        const value = features[feature];
        if (value !== undefined && (value < 0 || value > 1)) {
          throw new Error(
            `Audio feature '${feature}' for track "${track.name}" must be between 0.0 and 1.0 (got ${value})`
          );
        }
      }

      // Validate tempo (reasonable BPM range)
      if (
        features.tempo !== undefined &&
        (features.tempo < 40 || features.tempo > 220)
      ) {
        throw new Error(
          `Tempo for track "${track.name}" must be between 40 and 220 BPM (got ${features.tempo})`
        );
      }
    }
  }

  /**
   * Validates the AI analysis result structure and values
   */
  private validateAnalysisResult(result: unknown): AIAnalysisResult {
    if (!result || typeof result !== "object") {
      throw new Error("AI analysis result must be an object");
    }

    const analysis = result as Partial<AIAnalysisResult>;

    // Validate required fields
    if (!analysis.playlistTitle || typeof analysis.playlistTitle !== "string") {
      throw new Error("AI analysis missing valid 'playlistTitle'");
    }

    if (
      !analysis.playlistDescription ||
      typeof analysis.playlistDescription !== "string"
    ) {
      throw new Error("AI analysis missing valid 'playlistDescription'");
    }

    if (!analysis.reasoning || typeof analysis.reasoning !== "string") {
      throw new Error("AI analysis missing valid 'reasoning'");
    }

    if (analysis.reasoning.length < 50) {
      throw new Error("AI reasoning must be at least 50 characters");
    }

    if (!analysis.targetParams || typeof analysis.targetParams !== "object") {
      throw new Error("AI analysis missing valid 'targetParams'");
    }

    if (!analysis.mood || typeof analysis.mood !== "string") {
      throw new Error("AI analysis missing valid 'mood'");
    }

    if (!Array.isArray(analysis.tags)) {
      throw new Error("AI analysis missing valid 'tags' array");
    }

    // Validate target parameters
    const params = analysis.targetParams as Partial<TargetAudioParams>;

    if (
      typeof params.target_valence !== "number" ||
      params.target_valence < 0 ||
      params.target_valence > 1
    ) {
      throw new Error("target_valence must be a number between 0.0 and 1.0");
    }

    if (
      typeof params.target_energy !== "number" ||
      params.target_energy < 0 ||
      params.target_energy > 1
    ) {
      throw new Error("target_energy must be a number between 0.0 and 1.0");
    }

    if (
      typeof params.target_danceability !== "number" ||
      params.target_danceability < 0 ||
      params.target_danceability > 1
    ) {
      throw new Error(
        "target_danceability must be a number between 0.0 and 1.0"
      );
    }

    if (
      params.min_popularity !== undefined &&
      (typeof params.min_popularity !== "number" ||
        params.min_popularity < 0 ||
        params.min_popularity > 100)
    ) {
      throw new Error("min_popularity must be a number between 0 and 100");
    }

    // Return the validated result
    return analysis as AIAnalysisResult;
  }
}
