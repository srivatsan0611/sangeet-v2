"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useSongCrate } from "@/store/useSongCrate";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Sparkles, ArrowLeft, Music2, TrendingUp } from "lucide-react";

interface AIAnalysis {
  playlistTitle: string;
  playlistDescription: string;
  reasoning: string;
  targetParams: {
    target_valence: number;
    target_energy: number;
    target_danceability: number;
    min_popularity: number;
  };
  mood: string;
  tags: string[];
}

export default function AnalyzePage() {
  const { status } = useSession();
  const router = useRouter();
  const { seedTracks, hasMinimumTracks } = useSongCrate();

  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isFetchingRecommendations, setIsFetchingRecommendations] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
      return;
    }

    if (!hasMinimumTracks()) {
      router.push("/select");
      return;
    }

    performAnalysis();
  }, [status, hasMinimumTracks]);

  const performAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seedTracks }),
      });

      if (!res.ok) {
        throw new Error("Analysis failed");
      }

      const data = await res.json();
      setAnalysis(data.analysis);
      toast.success("Analysis complete!");
    } catch (error) {
      console.error("Analysis error:", error);
      toast.error("Failed to analyze tracks. Please try again.");
      setTimeout(() => router.push("/select"), 2000);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGetRecommendations = async () => {
    if (!analysis) return;

    setIsFetchingRecommendations(true);
    try {
      const res = await fetch("/api/spotify/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seedTracks: seedTracks.map(t => t.id),
          targetParams: analysis.targetParams,
          limit: 30,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to get recommendations");
      }

      const data = await res.json();

      // Store recommendations and analysis in sessionStorage for results page
      sessionStorage.setItem("recommendations", JSON.stringify(data.tracks || []));
      sessionStorage.setItem("analysis", JSON.stringify(analysis));
      sessionStorage.setItem("seedTracks", JSON.stringify(seedTracks));

      router.push("/results");
    } catch (error) {
      console.error("Recommendation error:", error);
      toast.error("Failed to get recommendations. Please try again.");
    } finally {
      setIsFetchingRecommendations(false);
    }
  };

  if (status === "loading" || isAnalyzing) {
    return (
      <div className="min-h-screen bg-[#09090b] p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <Sparkles className="w-8 h-8 text-purple-500 animate-pulse" />
            <div>
              <h1 className="text-3xl font-bold font-heading text-zinc-100">
                Analyzing Your Vibe...
              </h1>
              <p className="text-zinc-400 mt-1">
                AI is understanding your musical taste
              </p>
            </div>
          </div>

          <Card className="p-8 bg-zinc-900/50 backdrop-blur-md border-zinc-800">
            <div className="space-y-6">
              <div>
                <Skeleton className="h-8 w-3/4 mb-3" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-5/6" />
              </div>

              <div>
                <Skeleton className="h-6 w-1/4 mb-3" />
                <Skeleton className="h-20 w-full" />
              </div>

              <div>
                <Skeleton className="h-6 w-1/3 mb-3" />
                <div className="grid grid-cols-2 gap-4">
                  <Skeleton className="h-16" />
                  <Skeleton className="h-16" />
                  <Skeleton className="h-16" />
                  <Skeleton className="h-16" />
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#09090b] p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Button
              variant="ghost"
              onClick={() => router.push("/select")}
              className="mb-4 -ml-3 text-zinc-400 hover:text-zinc-100"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Selection
            </Button>
            <h1 className="text-3xl font-bold font-heading text-zinc-100">
              AI Analysis Complete
            </h1>
            <p className="text-zinc-400 mt-1">
              Here&apos;s what we discovered about your vibe
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Playlist Title & Description */}
          <Card className="p-8 bg-gradient-to-br from-purple-900/20 to-blue-900/20 backdrop-blur-md border-purple-800/30">
            <div className="flex items-start gap-3 mb-4">
              <Music2 className="w-6 h-6 text-purple-400 mt-1" />
              <div className="flex-1">
                <h2 className="text-2xl font-bold font-heading text-zinc-100 mb-2">
                  {analysis.playlistTitle}
                </h2>
                <p className="text-zinc-300 text-lg">
                  {analysis.playlistDescription}
                </p>
              </div>
            </div>

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
          </Card>

          {/* AI Reasoning */}
          <Card className="p-6 bg-zinc-900/50 backdrop-blur-md border-zinc-800">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-yellow-500" />
              <h3 className="text-xl font-heading text-zinc-100">AI Reasoning</h3>
            </div>
            <p className="text-zinc-300 leading-relaxed">{analysis.reasoning}</p>
          </Card>

          {/* Target Parameters */}
          <Card className="p-6 bg-zinc-900/50 backdrop-blur-md border-zinc-800">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              <h3 className="text-xl font-heading text-zinc-100">Target Audio Features</h3>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700">
                <div className="text-sm text-zinc-400 mb-1">Valence</div>
                <div className="text-2xl font-bold font-mono text-zinc-100">
                  {(analysis.targetParams.target_valence * 100).toFixed(0)}%
                </div>
                <div className="text-xs text-zinc-500 mt-1">Positivity</div>
              </div>

              <div className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700">
                <div className="text-sm text-zinc-400 mb-1">Energy</div>
                <div className="text-2xl font-bold font-mono text-zinc-100">
                  {(analysis.targetParams.target_energy * 100).toFixed(0)}%
                </div>
                <div className="text-xs text-zinc-500 mt-1">Intensity</div>
              </div>

              <div className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700">
                <div className="text-sm text-zinc-400 mb-1">Danceability</div>
                <div className="text-2xl font-bold font-mono text-zinc-100">
                  {(analysis.targetParams.target_danceability * 100).toFixed(0)}%
                </div>
                <div className="text-xs text-zinc-500 mt-1">Groove</div>
              </div>

              <div className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700">
                <div className="text-sm text-zinc-400 mb-1">Popularity</div>
                <div className="text-2xl font-bold font-mono text-zinc-100">
                  {analysis.targetParams.min_popularity}+
                </div>
                <div className="text-xs text-zinc-500 mt-1">Minimum</div>
              </div>
            </div>
          </Card>

          {/* CTA */}
          <div className="flex gap-4">
            <Button
              onClick={handleGetRecommendations}
              disabled={isFetchingRecommendations}
              className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-semibold py-6 text-lg shadow-lg"
            >
              {isFetchingRecommendations ? (
                <>
                  <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-2" />
                  Finding Perfect Tracks...
                </>
              ) : (
                <>
                  <Music2 className="w-5 h-5 mr-2" />
                  Get Recommendations
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
