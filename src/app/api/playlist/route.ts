import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface CreatePlaylistRequest {
  title: string;
  description?: string;
  vibe: string; // AI reasoning
  seedTracks: Array<{
    id: string;
    name: string;
    artist: string;
    album?: string;
    imageUrl?: string;
  }>;
  tracks: Array<{
    id: string;
    name: string;
    artist: string;
    album?: string;
    imageUrl?: string;
  }>;
  targetParams?: Record<string, unknown>;
}

interface UpdatePlaylistRequest {
  playlistId: string;
  title?: string;
  description?: string;
}

/**
 * POST /api/playlist
 * Creates a new playlist in the database (not yet exported to Spotify).
 *
 * Body:
 * - title: Playlist name
 * - description: Playlist description (optional)
 * - vibe: AI-generated reasoning
 * - seedTracks: Original user-selected tracks
 * - tracks: Generated/recommended tracks
 * - targetParams: AI-determined audio feature targets (optional)
 *
 * Returns: Created playlist object with tracks
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: CreatePlaylistRequest = await request.json();

    if (!body.title || body.title.trim().length === 0) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    if (!body.vibe || body.vibe.trim().length === 0) {
      return NextResponse.json(
        { error: "Vibe/reasoning is required" },
        { status: 400 }
      );
    }

    if (!body.tracks || body.tracks.length === 0) {
      return NextResponse.json(
        { error: "At least one track is required" },
        { status: 400 }
      );
    }

    const MAX_TRACKS_PER_PLAYLIST = 1000;
    if (body.tracks.length > MAX_TRACKS_PER_PLAYLIST) {
      return NextResponse.json(
        { error: `Maximum ${MAX_TRACKS_PER_PLAYLIST} tracks allowed per playlist` },
        { status: 400 }
      );
    }

    const playlist = await prisma.generatedPlaylist.create({
      data: {
        userId: session.user.id,
        title: body.title,
        description: body.description,
        vibe: body.vibe,
        seedTracks: body.seedTracks,
        targetParams: body.targetParams,
        tracks: {
          create: body.tracks.map((track) => ({
            spotifyId: track.id,
            name: track.name,
            artist: track.artist,
            album: track.album,
            imageUrl: track.imageUrl,
          })),
        },
      },
      include: {
        tracks: true,
      },
    });

    return NextResponse.json({ playlist }, { status: 201 });
  } catch (error) {
    console.error("Playlist creation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create playlist" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/playlist
 * Gets all playlists for the current user.
 *
 * Query params:
 * - id: Optional playlist ID to get a single playlist
 *
 * Returns: Array of playlists or single playlist object
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const playlistId = searchParams.get("id");

    if (playlistId) {
      const playlist = await prisma.generatedPlaylist.findFirst({
        where: {
          id: playlistId,
          userId: session.user.id,
        },
        include: {
          tracks: {
            orderBy: {
              addedAt: "asc",
            },
          },
        },
      });

      if (!playlist) {
        return NextResponse.json(
          { error: "Playlist not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({ playlist });
    }

    const playlists = await prisma.generatedPlaylist.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        tracks: {
          orderBy: {
            addedAt: "asc",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ playlists });
  } catch (error) {
    console.error("Playlist fetch error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch playlists" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/playlist
 * Updates playlist metadata (title, description).
 *
 * Body:
 * - playlistId: Playlist ID to update
 * - title: New title (optional)
 * - description: New description (optional)
 *
 * Returns: Updated playlist object
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: UpdatePlaylistRequest = await request.json();

    if (!body.playlistId) {
      return NextResponse.json(
        { error: "Playlist ID is required" },
        { status: 400 }
      );
    }

    const existing = await prisma.generatedPlaylist.findFirst({
      where: {
        id: body.playlistId,
        userId: session.user.id,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Playlist not found" },
        { status: 404 }
      );
    }

    const updates: Record<string, string> = {};
    if (body.title) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;

    const playlist = await prisma.generatedPlaylist.update({
      where: { id: body.playlistId },
      data: updates,
      include: {
        tracks: true,
      },
    });

    return NextResponse.json({ playlist });
  } catch (error) {
    console.error("Playlist update error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update playlist" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/playlist
 * Deletes a playlist.
 *
 * Query params:
 * - id: Playlist ID to delete
 *
 * Returns: Success message
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const playlistId = searchParams.get("id");

    if (!playlistId) {
      return NextResponse.json(
        { error: "Playlist ID is required" },
        { status: 400 }
      );
    }

    const existing = await prisma.generatedPlaylist.findFirst({
      where: {
        id: playlistId,
        userId: session.user.id,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Playlist not found" },
        { status: 404 }
      );
    }

    await prisma.generatedPlaylist.delete({
      where: { id: playlistId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Playlist deletion error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete playlist" },
      { status: 500 }
    );
  }
}
