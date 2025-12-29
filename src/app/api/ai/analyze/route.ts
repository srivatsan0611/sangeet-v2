import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createHash } from "crypto";
import { authOptions } from "@/lib/auth";
import { SpotifyClient } from "@/lib/spotify";
import { GroqClient } from "@/lib/groq";
import { prisma } from "@/lib/prisma";
import type {
  AIAnalysisRequest,
  AIAnalysisResponse,
  SeedTrack,
} from "@/types/ai";

/**
 * POST /api/ai/analyze
 * Analyzes seed tracks using Groq LLM and returns playlist recommendations.
 *
 * Request Body:
 * - seedTracks: Array of track objects (1-5 tracks)
 *   - id: Spotify track ID (required)
 *   - name: Track name (required)
 *   - artist: Artist name (required)
 *   - audioFeatures: Optional, will auto-fetch if missing
 *
 * Response:
 * - analysis: AI-generated playlist parameters
 * - seedTracks: Seed tracks with audio features
 * - cached: Whether result was from cache
 *
 * Caching: Results cached for 7 days based on seed track IDs
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authentication check
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse and validate request body
    const body: AIAnalysisRequest = await request.json();

    if (!body.seedTracks || !Array.isArray(body.seedTracks)) {
      return NextResponse.json(
        { error: "seedTracks array is required" },
        { status: 400 }
      );
    }

    if (body.seedTracks.length === 0) {
      return NextResponse.json(
        { error: "At least one seed track is required" },
        { status: 400 }
      );
    }

    if (body.seedTracks.length > 5) {
      return NextResponse.json(
        { error: "Maximum 5 seed tracks allowed" },
        { status: 400 }
      );
    }

    // Validate each seed track has required fields
    for (const track of body.seedTracks) {
      if (!track.id || typeof track.id !== "string") {
        return NextResponse.json(
          { error: "Each seed track must have a valid 'id'" },
          { status: 400 }
        );
      }

      if (!track.name || typeof track.name !== "string") {
        return NextResponse.json(
          { error: "Each seed track must have a valid 'name'" },
          { status: 400 }
        );
      }

      if (!track.artist || typeof track.artist !== "string") {
        return NextResponse.json(
          { error: "Each seed track must have a valid 'artist'" },
          { status: 400 }
        );
      }
    }

    // 3. Generate cache key from sorted seed track IDs
    const seedTrackIds = body.seedTracks.map((t) => t.id).sort();
    const cacheKey = createHash("sha256")
      .update(JSON.stringify(seedTrackIds))
      .digest("hex");

    // 4. Check cache for existing analysis
    const now = new Date();
    const cachedAnalysis = await prisma.aIAnalysisCache.findUnique({
      where: { cacheKey },
    });

    if (cachedAnalysis && cachedAnalysis.expiresAt > now) {
      // Cache hit - increment hit count and return cached result
      await prisma.aIAnalysisCache.update({
        where: { cacheKey },
        data: { hitCount: cachedAnalysis.hitCount + 1 },
      });

      return NextResponse.json({
        analysis: cachedAnalysis.analysis,
        seedTracks: cachedAnalysis.seedTracks,
        cached: true,
      } as AIAnalysisResponse);
    }

    // 5. Cache miss - fetch audio features from Spotify if not provided
    const spotify = await SpotifyClient.forUser(session.user.id);

    const seedTracksWithFeatures: SeedTrack[] = await Promise.all(
      body.seedTracks.map(async (track) => {
        // If audio features are provided, use them
        if (track.audioFeatures) {
          return {
            id: track.id,
            name: track.name,
            artist: track.artist,
            album: track.album,
            audioFeatures: track.audioFeatures,
          } as SeedTrack;
        }

        // Otherwise, fetch from Spotify
        try {
          const audioFeatures = await spotify.getAudioFeatures(track.id);

          return {
            id: track.id,
            name: track.name,
            artist: track.artist,
            album: track.album,
            audioFeatures,
          } as SeedTrack;
        } catch (error) {
          throw new Error(
            `Failed to fetch audio features for track "${track.name}": ${
              error instanceof Error ? error.message : "Unknown error"
            }`
          );
        }
      })
    );

    // Validate that we have audio features for all tracks
    const tracksWithoutFeatures = seedTracksWithFeatures.filter(
      (t) => !t.audioFeatures
    );

    if (tracksWithoutFeatures.length > 0) {
      return NextResponse.json(
        {
          error: `Missing audio features for tracks: ${tracksWithoutFeatures
            .map((t) => t.name)
            .join(", ")}`,
        },
        { status: 400 }
      );
    }

    // 6. Call Groq AI for analysis
    const groq = new GroqClient();
    const analysis = await groq.analyzeMusicVibes(seedTracksWithFeatures);

    // 7. Store result in cache with 7-day expiry
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await prisma.aIAnalysisCache.upsert({
      where: { cacheKey },
      create: {
        cacheKey,
        seedTracks: seedTracksWithFeatures,
        analysis,
        expiresAt,
        hitCount: 0,
      },
      update: {
        seedTracks: seedTracksWithFeatures,
        analysis,
        expiresAt,
        // Don't reset hitCount on update
      },
    });

    // 8. Return analysis result
    return NextResponse.json({
      analysis,
      seedTracks: seedTracksWithFeatures,
      cached: false,
    } as AIAnalysisResponse);
  } catch (error) {
    console.error("AI analysis error:", error);

    // Check for rate limit errors
    if (
      error instanceof Error &&
      error.message.includes("Rate limit exceeded")
    ) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a few moments." },
        { status: 429 }
      );
    }

    // Return generic error
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "AI analysis failed",
      },
      { status: 500 }
    );
  }
}
