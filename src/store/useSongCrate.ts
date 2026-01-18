import { create } from 'zustand';

export interface SeedTrack {
  id: string;
  name: string;
  artist: string;
  album?: string;
  imageUrl?: string;
  audioFeatures?: {
    valence: number;
    energy: number;
    danceability: number;
    acousticness: number;
    instrumentalness: number;
    speechiness: number;
    tempo: number;
  };
}

interface SongCrateState {
  seedTracks: SeedTrack[];
  maxTracks: number;
  addTrack: (track: SeedTrack) => void;
  removeTrack: (trackId: string) => void;
  clearTracks: () => void;
  isMaxReached: () => boolean;
  hasMinimumTracks: () => boolean;
}

export const useSongCrate = create<SongCrateState>((set, get) => ({
  seedTracks: [],
  maxTracks: 5,

  addTrack: (track) => {
    const { seedTracks, maxTracks } = get();

    // Check if track already exists
    if (seedTracks.some(t => t.id === track.id)) {
      return;
    }

    // Check if we've reached the max
    if (seedTracks.length >= maxTracks) {
      return;
    }

    set({ seedTracks: [...seedTracks, track] });
  },

  removeTrack: (trackId) => {
    set((state) => ({
      seedTracks: state.seedTracks.filter(t => t.id !== trackId)
    }));
  },

  clearTracks: () => {
    set({ seedTracks: [] });
  },

  isMaxReached: () => {
    const { seedTracks, maxTracks } = get();
    return seedTracks.length >= maxTracks;
  },

  hasMinimumTracks: () => {
    const { seedTracks } = get();
    return seedTracks.length >= 1;
  },
}));
