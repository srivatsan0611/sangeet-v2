"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useSongCrate } from "@/store/useSongCrate";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { X, Music, Sparkles, LogOut } from "lucide-react";

interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album: {
    name: string;
    images: { url: string }[];
  };
}

export default function SelectPage() {
  const { status } = useSession();
  const router = useRouter();
  const { seedTracks, addTrack, removeTrack, isMaxReached, hasMinimumTracks } = useSongCrate();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SpotifyTrack[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  useEffect(() => {
    const searchTracks = async () => {
      if (searchQuery.length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(searchQuery)}&limit=10`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.tracks || []);
        }
      } catch (error) {
        console.error("Search error:", error);
        toast.error("Failed to search tracks");
      } finally {
        setIsSearching(false);
      }
    };

    const debounce = setTimeout(searchTracks, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const handleAddTrack = (track: SpotifyTrack) => {
    if (isMaxReached()) {
      toast.error("Maximum 5 tracks allowed");
      return;
    }

    addTrack({
      id: track.id,
      name: track.name,
      artist: track.artists.map(a => a.name).join(", "),
      album: track.album.name,
      imageUrl: track.album.images[0]?.url,
    });

    toast.success(`Added ${track.name}`);
    setSearchQuery("");
  };

  const handleAnalyze = () => {
    if (!hasMinimumTracks()) {
      toast.error("Please select at least 1 track");
      return;
    }
    router.push("/analyze");
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090b]">
        <div className="animate-pulse text-zinc-400 font-mono">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] p-4 md:p-8">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-heading text-zinc-100">
              Select Your Seeds
            </h1>
            <p className="text-zinc-400 mt-1">
              Choose 1-5 songs that represent the vibe you want
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="border-zinc-800 hover:bg-zinc-800"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Search Section */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-6 bg-zinc-900/50 backdrop-blur-md border-zinc-800">
            <div className="flex items-center gap-2 mb-4">
              <Music className="w-5 h-5 text-zinc-400" />
              <h2 className="text-xl font-heading text-zinc-100">
                Search Spotify
              </h2>
            </div>

            <Command className="rounded-lg border border-zinc-800 bg-zinc-900">
              <CommandInput
                placeholder="Search for songs, artists, albums..."
                value={searchQuery}
                onValueChange={setSearchQuery}
              />
              <CommandList className="max-h-[400px]">
                {isSearching && (
                  <div className="py-6 text-center text-sm text-zinc-400">
                    Searching...
                  </div>
                )}
                {!isSearching && searchQuery.length < 2 && (
                  <CommandEmpty>Start typing to search tracks...</CommandEmpty>
                )}
                {!isSearching && searchQuery.length >= 2 && searchResults.length === 0 && (
                  <CommandEmpty>No tracks found.</CommandEmpty>
                )}
                {searchResults.length > 0 && (
                  <CommandGroup>
                    {searchResults.map((track) => {
                      const isAdded = seedTracks.some(t => t.id === track.id);
                      return (
                        <CommandItem
                          key={track.id}
                          onSelect={() => !isAdded && handleAddTrack(track)}
                          disabled={isAdded}
                          className="flex items-center gap-3 p-3 cursor-pointer"
                        >
                          <img
                            src={track.album.images[2]?.url || track.album.images[0]?.url}
                            alt={track.name}
                            className="w-12 h-12 rounded"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-zinc-100 truncate">
                              {track.name}
                            </div>
                            <div className="text-sm text-zinc-400 truncate">
                              {track.artists.map(a => a.name).join(", ")}
                            </div>
                          </div>
                          {isAdded && (
                            <Badge variant="secondary" className="ml-2">Added</Badge>
                          )}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </Card>
        </div>

        {/* Selected Tracks Section */}
        <div className="space-y-4">
          <Card className="p-6 bg-zinc-900/50 backdrop-blur-md border-zinc-800 sticky top-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-heading text-zinc-100">
                Your Crate
              </h2>
              <Badge variant="outline" className="font-mono">
                {seedTracks.length}/5
              </Badge>
            </div>

            {seedTracks.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">
                <Music className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No songs selected yet</p>
                <p className="text-xs mt-1">Search and add tracks to get started</p>
              </div>
            ) : (
              <div className="space-y-3 mb-6">
                {seedTracks.map((track) => (
                  <div
                    key={track.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50 border border-zinc-700 group hover:border-zinc-600 transition-all"
                  >
                    <img
                      src={track.imageUrl}
                      alt={track.name}
                      className="w-12 h-12 rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-zinc-100 text-sm truncate">
                        {track.name}
                      </div>
                      <div className="text-xs text-zinc-400 truncate">
                        {track.artist}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeTrack(track.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <Button
              onClick={handleAnalyze}
              disabled={!hasMinimumTracks()}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-semibold shadow-lg"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Playlist with AI
            </Button>

            {!hasMinimumTracks() && (
              <p className="text-xs text-zinc-500 text-center mt-2">
                Select at least 1 track to continue
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
