import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SpotifyClient } from "@/lib/spotify";
import { prisma } from "@/lib/prisma";

interface ExportPlaylistRequest {
  playlistId: string;
  syncTracks?: boolean; // If true, also sync tracks to Spotify
}

/**
 * POST /api/playlist/export
 * Exports a playlist to Spotify.
 *
 * Body:
 * - playlistId: Local playlist ID to export
 * - syncTracks: Whether to immediately add tracks (default: true)
 *
 * Returns: Updated playlist with Spotify playlist ID and URL
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: ExportPlaylistRequest = await request.json();

    if (!body.playlistId) {
      return NextResponse.json(
        { error: "Playlist ID is required" },
        { status: 400 }
      );
    }

    const playlist = await prisma.generatedPlaylist.findFirst({
      where: {
        id: body.playlistId,
        userId: session.user.id,
      },
      include: {
        tracks: true,
      },
    });

    if (!playlist) {
      return NextResponse.json(
        { error: "Playlist not found" },
        { status: 404 }
      );
    }

    const spotify = await SpotifyClient.forUser(session.user.id);
    const currentUser = await spotify.getCurrentUser();

    // Create playlist on Spotify if not already exported
    let spotifyPlaylistId = playlist.spotifyPlaylistId;
    let spotifyUrl = "";

    if (!spotifyPlaylistId) {
      const spotifyPlaylist = await spotify.createPlaylist(
        currentUser.id,
        playlist.title,
        playlist.description || playlist.vibe
      );

      spotifyPlaylistId = spotifyPlaylist.id;
      spotifyUrl = spotifyPlaylist.external_urls.spotify;

      await prisma.generatedPlaylist.update({
        where: { id: playlist.id },
        data: { spotifyPlaylistId },
      });
    }

    // Sync tracks if requested
    if (body.syncTracks !== false && playlist.tracks.length > 0) {
      const trackUris = Array.from(
        new Set(playlist.tracks.map((track) => `spotify:track:${track.spotifyId}`))
      );

      await spotify.addTracksToPlaylist(spotifyPlaylistId, trackUris);
    }

    const updatedPlaylist = await prisma.generatedPlaylist.findUnique({
      where: { id: playlist.id },
      include: {
        tracks: true,
      },
    });

    return NextResponse.json({
      playlist: updatedPlaylist,
      spotifyUrl: spotifyUrl || `https://open.spotify.com/playlist/${spotifyPlaylistId}`,
    });
  } catch (error) {
    console.error("Playlist export error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to export playlist" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/playlist/export
 * Syncs local playlist changes to existing Spotify playlist.
 *
 * Body:
 * - playlistId: Local playlist ID
 *
 * Returns: Success message
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: { playlistId: string } = await request.json();

    if (!body.playlistId) {
      return NextResponse.json(
        { error: "Playlist ID is required" },
        { status: 400 }
      );
    }

    const playlist = await prisma.generatedPlaylist.findFirst({
      where: {
        id: body.playlistId,
        userId: session.user.id,
      },
      include: {
        tracks: true,
      },
    });

    if (!playlist) {
      return NextResponse.json(
        { error: "Playlist not found" },
        { status: 404 }
      );
    }

    if (!playlist.spotifyPlaylistId) {
      return NextResponse.json(
        { error: "Playlist not exported to Spotify yet" },
        { status: 400 }
      );
    }

    const spotify = await SpotifyClient.forUser(session.user.id);
    const trackUris = Array.from(
      new Set(playlist.tracks.map((track) => `spotify:track:${track.spotifyId}`))
    );

    // For sync, add all unique tracks from the local playlist
    if (trackUris.length > 0) {
      await spotify.addTracksToPlaylist(playlist.spotifyPlaylistId, trackUris);
    }

    return NextResponse.json({
      success: true,
      spotifyUrl: `https://open.spotify.com/playlist/${playlist.spotifyPlaylistId}`,
    });
  } catch (error) {
    console.error("Playlist sync error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sync playlist" },
      { status: 500 }
    );
  }
}
