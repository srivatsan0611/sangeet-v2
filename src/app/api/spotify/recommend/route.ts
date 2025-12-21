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
