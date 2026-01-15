import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SpotifyClient } from "@/lib/spotify";

interface RecommendationRequest {
  seedTracks: string[]; // Spotify track IDs
  targetParams?: {
    target_valence?: number;
    target_energy?: number;
    target_danceability?: number;
    min_popularity?: number;
  };
  limit?: number;
}

/**
 * POST /api/spotify/recommend
 * Gets Spotify recommendations based on seed tracks and optional AI-generated params.
 *
 * Body:
 * - seedTracks: Array of Spotify track IDs (1-5 tracks)
 * - targetParams: Optional audio feature targets from AI analysis
 * - limit: Number of recommendations (default: 20, max: 50)
 *
 * Returns: Array of recommended tracks
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: RecommendationRequest = await request.json();

    if (!body.seedTracks || body.seedTracks.length === 0) {
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

    // Validate audio feature parameters are within acceptable range (0.0 to 1.0)
    if (body.targetParams) {
      const audioFeatures = ["target_valence", "target_energy", "target_danceability"] as const;
      for (const feature of audioFeatures) {
        const value = body.targetParams[feature as keyof typeof body.targetParams];
        if (value !== undefined && (value < 0 || value > 1)) {
          return NextResponse.json(
            { error: `${feature} must be between 0.0 and 1.0` },
            { status: 400 }
          );
        }
      }

      // min_popularity should be 0-100
      if (
        body.targetParams.min_popularity !== undefined &&
        (body.targetParams.min_popularity < 0 || body.targetParams.min_popularity > 100)
      ) {
        return NextResponse.json(
          { error: "min_popularity must be between 0 and 100" },
          { status: 400 }
        );
      }
    }

    const spotify = await SpotifyClient.forUser(session.user.id);

    const params = {
      seed_tracks: body.seedTracks,
      limit: Math.min(body.limit || 20, 50),
      ...body.targetParams,
    };

    const recommendations = await spotify.getRecommendations(params);

    const tracks = recommendations.tracks.map((track) => ({
      id: track.id,
      name: track.name,
      artist: track.artists.map((a) => a.name).join(", "),
      album: track.album.name,
      imageUrl: track.album.images?.[0]?.url || null,
      uri: track.uri,
      externalUrl: track.external_urls.spotify,
      durationMs: track.duration_ms,
    }));

    return NextResponse.json({
      tracks,
      seeds: recommendations.seeds,
    });
  } catch (error) {
    console.error("Spotify recommendation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Recommendation failed" },
      { status: 500 }
    );
  }
}
