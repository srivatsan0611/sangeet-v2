import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SpotifyClient } from "@/lib/spotify";

/**
 * GET /api/spotify/search
 * Searches Spotify for tracks based on a query string.
 *
 * Query params:
 * - q: Search query (required)
 * - limit: Number of results (default: 20, max: 50)
 *
 * Returns: Array of track objects with id, name, artist, album, image
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q");
    const rawLimit = searchParams.get("limit");
    let parsedLimit = rawLimit !== null ? parseInt(rawLimit, 10) : 20;
    if (Number.isNaN(parsedLimit) || parsedLimit <= 0) {
      parsedLimit = 20;
    }
    const limit = Math.min(parsedLimit, 50);

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: "Query parameter 'q' is required" },
        { status: 400 }
      );
    }

    const spotify = await SpotifyClient.forUser(session.user.id);
    const results = await spotify.search(query, "track", limit);

    const tracks = results.tracks?.items.map((track) => ({
      id: track.id,
      name: track.name,
      artist: track.artists.map((a) => a.name).join(", "),
      album: track.album.name,
      imageUrl: track.album.images?.[0]?.url || null,
      uri: track.uri,
      externalUrl: track.external_urls.spotify,
    })) || [];

    return NextResponse.json({ tracks });
  } catch (error) {
    console.error("Spotify search error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Search failed" },
      { status: 500 }
    );
  }
}
