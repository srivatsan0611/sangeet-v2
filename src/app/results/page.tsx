"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, Sparkles, Music, Check } from "lucide-react";

interface Track {
  id: string;
  name: string;
  artists: { name: string }[];
  album: {
    name: string;
    images: { url: string }[];
  };
  external_urls: {
    spotify: string;
  };
  preview_url: string | null;
}

interface AIAnalysis {
  playlistTitle: string;
  playlistDescription: string;
  mood: string;
  tags: string[];
}

export default function ResultsPage() {
  const { status } = useSession();
  const router = useRouter();

  const [recommendations, setRecommendations] = useState<Track[]>([]);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [seedTracks, setSeedTracks] = useState<{ id: string; name: string; artist: string; album?: string; imageUrl?: string }[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [exported, setExported] = useState(false);
  const [playlistUrl, setPlaylistUrl] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
      return;
    }

    // Load data from sessionStorage
    const storedRecs = sessionStorage.getItem("recommendations");
    const storedAnalysis = sessionStorage.getItem("analysis");
    const storedSeeds = sessionStorage.getItem("seedTracks");

    if (!storedRecs || !storedAnalysis || !storedSeeds) {
      toast.error("No recommendations found. Please start over.");
      router.push("/select");
      return;
    }

    setRecommendations(JSON.parse(storedRecs));
    setAnalysis(JSON.parse(storedAnalysis));
    setSeedTracks(JSON.parse(storedSeeds));
  }, [status, router]);

  const handleExportToSpotify = async () => {
    if (!analysis || recommendations.length === 0) return;

    setIsExporting(true);
    try {
      const res = await fetch("/api/playlist/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: analysis.playlistTitle,
          description: analysis.playlistDescription,
          tracks: recommendations.map(t => t.id),
          seedTracks: seedTracks,
          targetParams: analysis,
        }),
      });

      if (!res.ok) {
        throw new Error("Export failed");
      }

      const data = await res.json();
      setPlaylistUrl(data.playlistUrl);
      setExported(true);
      toast.success("Playlist exported to Spotify!");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export playlist. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleStartOver = () => {
    sessionStorage.clear();
    router.push("/select");
  };

  if (status === "loading" || !analysis) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090b]">
        <div className="animate-pulse text-zinc-400 font-mono">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => router.push("/analyze")}
            className="mb-4 -ml-3 text-zinc-400 hover:text-zinc-100"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Analysis
          </Button>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold font-heading text-zinc-100 mb-2">
                {analysis.playlistTitle}
              </h1>
              <p className="text-zinc-400 max-w-2xl">
                {analysis.playlistDescription}
              </p>

              <div className="flex flex-wrap gap-2 mt-4">
                <Badge variant="secondary" className="bg-purple-900/30 text-purple-200 border-purple-700/50">
                  {analysis.mood}
                </Badge>
                {analysis.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="border-zinc-700 text-zinc-300">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleStartOver}
                className="border-zinc-700 hover:bg-zinc-800"
              >
                Start Over
              </Button>

              {!exported ? (
                <Button
                  onClick={handleExportToSpotify}
                  disabled={isExporting}
                  className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white font-semibold shadow-lg"
                >
                  {isExporting ? (
                    <>
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Export to Spotify
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={() => playlistUrl && window.open(playlistUrl, "_blank")}
                  className="bg-green-600 hover:bg-green-500 text-white font-semibold"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Open in Spotify
                  <ExternalLink className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Recommendations Grid */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Music className="w-5 h-5 text-zinc-400" />
            <h2 className="text-xl font-heading text-zinc-100">
              {recommendations.length} Recommended Tracks
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recommendations.map((track) => (
              <Card
                key={track.id}
                className="p-4 bg-zinc-900/50 backdrop-blur-md border-zinc-800 hover:border-zinc-700 transition-all group"
              >
                <div className="flex gap-3">
                  <img
                    src={track.album.images[1]?.url || track.album.images[0]?.url}
                    alt={track.name}
                    className="w-16 h-16 rounded flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-zinc-100 truncate group-hover:text-zinc-50 transition-colors">
                      {track.name}
                    </h3>
                    <p className="text-sm text-zinc-400 truncate">
                      {track.artists.map(a => a.name).join(", ")}
                    </p>
                    <p className="text-xs text-zinc-500 truncate mt-1">
                      {track.album.name}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(track.external_urls.spotify, "_blank")}
                    className="flex-1 text-xs border-zinc-700 hover:bg-zinc-800"
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Open
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Seed Tracks Reference */}
        <Card className="p-6 bg-zinc-900/30 backdrop-blur-md border-zinc-800/50 mt-8">
          <h3 className="text-sm font-heading text-zinc-400 mb-3">
            Based on your seed tracks:
          </h3>
          <div className="flex flex-wrap gap-3">
            {seedTracks.map((track) => (
              <div
                key={track.id}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700"
              >
                <img
                  src={track.imageUrl}
                  alt={track.name}
                  className="w-8 h-8 rounded"
                />
                <div className="text-sm">
                  <span className="text-zinc-300 font-medium">{track.name}</span>
                  <span className="text-zinc-500 ml-1">by {track.artist}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
