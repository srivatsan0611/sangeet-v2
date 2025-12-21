import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface AddTracksRequest {
  playlistId: string;
  tracks: Array<{
    id: string;
    name: string;
    artist: string;
    album?: string;
    imageUrl?: string;
  }>;
}

interface RemoveTracksRequest {
  playlistId: string;
  trackIds: string[]; // Spotify track IDs
}

/**
 * POST /api/playlist/tracks
 * Adds tracks to an existing playlist.
 *
 * Body:
 * - playlistId: Playlist ID
 * - tracks: Array of track objects to add
 *
 * Returns: Updated playlist with tracks
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: AddTracksRequest = await request.json();

    if (!body.playlistId) {
      return NextResponse.json(
        { error: "Playlist ID is required" },
        { status: 400 }
      );
    }

    if (!body.tracks || body.tracks.length === 0) {
      return NextResponse.json(
        { error: "At least one track is required" },
        { status: 400 }
      );
    }

    const playlist = await prisma.generatedPlaylist.findFirst({
      where: {
        id: body.playlistId,
        userId: session.user.id,
      },
    });

    if (!playlist) {
      return NextResponse.json(
        { error: "Playlist not found" },
        { status: 404 }
      );
    }

    // Use upsert to avoid duplicates (unique constraint on playlistId + spotifyId)
    const trackOperations = body.tracks.map((track) =>
      prisma.playlistTrack.upsert({
        where: {
          playlistId_spotifyId: {
            playlistId: body.playlistId,
            spotifyId: track.id,
          },
        },
        create: {
          playlistId: body.playlistId,
          spotifyId: track.id,
          name: track.name,
          artist: track.artist,
          album: track.album,
          imageUrl: track.imageUrl,
        },
        update: {
          name: track.name,
          artist: track.artist,
          album: track.album,
          imageUrl: track.imageUrl,
        },
      })
    );

    await prisma.$transaction(trackOperations);

    const updatedPlaylist = await prisma.generatedPlaylist.findUnique({
      where: { id: body.playlistId },
      include: {
        tracks: {
          orderBy: {
            addedAt: "asc",
          },
        },
      },
    });

    return NextResponse.json({ playlist: updatedPlaylist });
  } catch (error) {
    console.error("Add tracks error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to add tracks" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/playlist/tracks
 * Removes tracks from a playlist.
 *
 * Body:
 * - playlistId: Playlist ID
 * - trackIds: Array of Spotify track IDs to remove
 *
 * Returns: Updated playlist with tracks
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: RemoveTracksRequest = await request.json();

    if (!body.playlistId) {
      return NextResponse.json(
        { error: "Playlist ID is required" },
        { status: 400 }
      );
    }

    if (!body.trackIds || body.trackIds.length === 0) {
      return NextResponse.json(
        { error: "At least one track ID is required" },
        { status: 400 }
      );
    }

    const playlist = await prisma.generatedPlaylist.findFirst({
      where: {
        id: body.playlistId,
        userId: session.user.id,
      },
    });

    if (!playlist) {
      return NextResponse.json(
        { error: "Playlist not found" },
        { status: 404 }
      );
    }

    await prisma.playlistTrack.deleteMany({
      where: {
        playlistId: body.playlistId,
        spotifyId: {
          in: body.trackIds,
        },
      },
    });

    const updatedPlaylist = await prisma.generatedPlaylist.findUnique({
      where: { id: body.playlistId },
      include: {
        tracks: {
          orderBy: {
            addedAt: "asc",
          },
        },
      },
    });

    return NextResponse.json({ playlist: updatedPlaylist });
  } catch (error) {
    console.error("Remove tracks error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to remove tracks" },
      { status: 500 }
    );
  }
}
