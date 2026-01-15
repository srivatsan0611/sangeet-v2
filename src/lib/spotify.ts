import { prisma } from "@/lib/prisma";

interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

/**
 * Gets a valid Spotify access token for a user, refreshing if needed.
 * Follows Single Responsibility Principle - only handles token management.
 */
export async function getSpotifyAccessToken(userId: string): Promise<string> {
  const account = await prisma.account.findFirst({
    where: {
      userId,
      provider: "spotify",
    },
  });

  if (!account) {
    throw new Error("No Spotify account connected");
  }

  if (!account.access_token || !account.refresh_token) {
    throw new Error("Invalid Spotify tokens");
  }

  const now = Math.floor(Date.now() / 1000);
  const isExpired = account.expires_at && account.expires_at <= now;

  if (!isExpired) {
    return account.access_token;
  }

  return await refreshSpotifyToken(userId, account.refresh_token);
}

/**
 * Refreshes the Spotify access token and updates the database.
 * Separated from getSpotifyAccessToken for testability (SOLID).
 */
async function refreshSpotifyToken(
  userId: string,
  refreshToken: string
): Promise<string> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Spotify client ID and secret must be configured");
  }

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(
        `${clientId}:${clientSecret}`
      ).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to refresh Spotify token");
  }

  const data: SpotifyTokenResponse = await response.json();

  await prisma.account.updateMany({
    where: {
      userId,
      provider: "spotify",
    },
    data: {
      access_token: data.access_token,
      expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
      refresh_token: data.refresh_token ?? refreshToken,
    },
  });

  return data.access_token;
}

/**
 * Type-safe Spotify API client.
 * Abstracts authentication and provides clean interface (Interface Segregation Principle).
 */
export class SpotifyClient {
  constructor(private accessToken: string) {}

  static async forUser(userId: string): Promise<SpotifyClient> {
    const token = await getSpotifyAccessToken(userId);
    return new SpotifyClient(token);
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`https://api.spotify.com/v1${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      let errorMessage = "";
      try {
        // Try to parse a JSON error response first
        const errorBody = await response.json();
        if (errorBody !== null && errorBody !== undefined) {
          if (typeof errorBody === "string") {
            errorMessage = errorBody;
          } else {
            errorMessage = JSON.stringify(errorBody);
          }
        }
      } catch {
        // Fallback to plain text if JSON parsing fails
        try {
          const text = await response.text();
          errorMessage = text || "";
        } catch {
          // Ignore secondary errors while reading the body
        }
      }
      if (!errorMessage) {
        errorMessage = response.statusText || "Unknown error";
      }
      throw new Error(
        `Spotify API error: ${response.status} ${response.statusText || ""} - ${errorMessage}`
      );
    }

    return response.json();
  }

  async search(query: string, type: string = "track", limit: number = 20) {
    const MAX_QUERY_LENGTH = 200;
    if (query.length > MAX_QUERY_LENGTH) {
      throw new Error(`Search query exceeds maximum length of ${MAX_QUERY_LENGTH} characters`);
    }

    return this.request<SpotifyApi.SearchResponse>(
      `/search?q=${encodeURIComponent(query)}&type=${type}&limit=${limit}`
    );
  }

  async getTrack(trackId: string) {
    return this.request<SpotifyApi.SingleTrackResponse>(`/tracks/${trackId}`);
  }

  async getRecommendations(params: {
    seed_tracks?: string[];
    seed_artists?: string[];
    seed_genres?: string[];
    limit?: number;
    target_valence?: number;
    target_energy?: number;
    target_danceability?: number;
    min_popularity?: number;
  }) {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        queryParams.append(
          key,
          Array.isArray(value) ? value.join(",") : String(value)
        );
      }
    });

    return this.request<SpotifyApi.RecommendationsFromSeedsResponse>(
      `/recommendations?${queryParams.toString()}`
    );
  }

  async createPlaylist(userId: string, name: string, description?: string) {
    // Ensure the provided userId matches the authenticated Spotify user's ID
    const currentUser = await this.getCurrentUser();
    if (currentUser.id !== userId) {
      throw new Error(
        "Spotify userId mismatch: cannot create a playlist for a different user"
      );
    }

    return this.request<SpotifyApi.CreatePlaylistResponse>(
      `/users/${currentUser.id}/playlists`,
      {
        method: "POST",
        body: JSON.stringify({
          name,
          description,
          public: false,
        }),
      }
    );
  }

  async addTracksToPlaylist(playlistId: string, trackUris: string[]) {
    const MAX_TRACKS_PER_REQUEST = 100;

    // If within limit, use a single request
    if (trackUris.length <= MAX_TRACKS_PER_REQUEST) {
      return this.request<{ snapshot_id: string }>(
        `/playlists/${playlistId}/tracks`,
        {
          method: "POST",
          body: JSON.stringify({ uris: trackUris }),
        }
      );
    }

    // For larger batches, chunk into multiple requests
    let lastResponse: { snapshot_id: string } | null = null;
    for (let i = 0; i < trackUris.length; i += MAX_TRACKS_PER_REQUEST) {
      const chunk = trackUris.slice(i, i + MAX_TRACKS_PER_REQUEST);
      lastResponse = await this.request<{ snapshot_id: string }>(
        `/playlists/${playlistId}/tracks`,
        {
          method: "POST",
          body: JSON.stringify({ uris: chunk }),
        }
      );
    }

    // lastResponse is non-null because trackUris.length > 0 if we reach here
    return lastResponse as { snapshot_id: string };
  }

  async removeTracksFromPlaylist(playlistId: string, trackUris: string[]) {
    const MAX_TRACKS_PER_REQUEST = 100;

    // If within limit, use a single request
    if (trackUris.length <= MAX_TRACKS_PER_REQUEST) {
      return this.request<{ snapshot_id: string }>(
        `/playlists/${playlistId}/tracks`,
        {
          method: "DELETE",
          body: JSON.stringify({
            tracks: trackUris.map((uri) => ({ uri })),
          }),
        }
      );
    }

    // For larger batches, chunk into multiple requests
    let lastResponse: { snapshot_id: string } | null = null;
    for (let i = 0; i < trackUris.length; i += MAX_TRACKS_PER_REQUEST) {
      const chunk = trackUris.slice(i, i + MAX_TRACKS_PER_REQUEST);
      lastResponse = await this.request<{ snapshot_id: string }>(
        `/playlists/${playlistId}/tracks`,
        {
          method: "DELETE",
          body: JSON.stringify({
            tracks: chunk.map((uri) => ({ uri })),
          }),
        }
      );
    }

    // lastResponse is non-null because trackUris.length > 0 if we reach here
    return lastResponse as { snapshot_id: string };
  }

  async getCurrentUser() {
    return this.request<SpotifyApi.CurrentUsersProfileResponse>("/me");
  }

  /**
   * Gets audio features for a single track
   * @param trackId Spotify track ID
   * @returns Audio features including valence, energy, danceability, etc.
   */
  async getAudioFeatures(trackId: string): Promise<SpotifyApi.AudioFeatures> {
    return this.request<SpotifyApi.AudioFeatures>(`/audio-features/${trackId}`);
  }

  /**
   * Gets audio features for multiple tracks in a single request
   * @param trackIds Array of Spotify track IDs (max 100)
   * @returns Array of audio features objects
   */
  async getMultipleAudioFeatures(trackIds: string[]): Promise<SpotifyApi.AudioFeatures[]> {
    const MAX_TRACKS = 100;
    if (trackIds.length > MAX_TRACKS) {
      throw new Error(`Maximum ${MAX_TRACKS} tracks allowed per request`);
    }

    const response = await this.request<{ audio_features: SpotifyApi.AudioFeatures[] }>(
      `/audio-features?ids=${trackIds.join(",")}`
    );

    return response.audio_features;
  }
}

// Type definitions for Spotify API responses
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace SpotifyApi {
  export interface SearchResponse {
    tracks?: {
      items: Track[];
      total: number;
    };
  }

  export interface Track {
    id: string;
    name: string;
    artists: Array<{ id: string; name: string }>;
    album: {
      id: string;
      name: string;
      images: Array<{ url: string; height: number; width: number }>;
    };
    duration_ms: number;
    uri: string;
    external_urls: { spotify: string };
  }

  export type SingleTrackResponse = Track;

  export interface RecommendationsFromSeedsResponse {
    tracks: Track[];
    seeds: Array<{
      initialPoolSize: number;
      afterFilteringSize: number;
      afterRelinkingSize: number;
      id: string;
      type: string;
      href: string;
    }>;
  }

  export interface CreatePlaylistResponse {
    id: string;
    name: string;
    description: string;
    external_urls: { spotify: string };
    uri: string;
  }

  export interface CurrentUsersProfileResponse {
    id: string;
    display_name: string;
    email: string;
    images: Array<{ url: string }>;
  }

  export interface AudioFeatures {
    id: string;
    danceability: number;
    energy: number;
    key: number;
    loudness: number;
    mode: number;
    speechiness: number;
    acousticness: number;
    instrumentalness: number;
    liveness: number;
    valence: number;
    tempo: number;
    duration_ms: number;
    time_signature: number;
  }
}
