"use client";

import { useSession, signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session) {
      router.push("/select");
    }
  }, [session, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090b]">
        <div className="animate-pulse text-zinc-400 font-mono">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#09090b] p-4">
      {/* Gradient Background Effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      {/* Main Content */}
      <div className="relative z-10 max-w-2xl mx-auto text-center space-y-8">
        {/* Logo/Title */}
        <div className="space-y-4">
          <h1 className="text-6xl md:text-7xl font-bold font-heading tracking-tight">
            <span className="bg-gradient-to-r from-zinc-200 via-zinc-100 to-zinc-300 bg-clip-text text-transparent">
              Sangeet
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-zinc-400 font-light">
            AI-Powered Playlist Curation
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12">
          <Card className="p-6 bg-zinc-900/50 backdrop-blur-md border-zinc-800 hover:border-zinc-700 transition-all">
            <div className="text-3xl mb-2">🎵</div>
            <h3 className="font-heading text-zinc-100 mb-2">Smart Analysis</h3>
            <p className="text-sm text-zinc-400">
              AI understands the emotional context of your music
            </p>
          </Card>

          <Card className="p-6 bg-zinc-900/50 backdrop-blur-md border-zinc-800 hover:border-zinc-700 transition-all">
            <div className="text-3xl mb-2">⚡</div>
            <h3 className="font-heading text-zinc-100 mb-2">Lightning Fast</h3>
            <p className="text-sm text-zinc-400">
              Near-instant recommendations powered by Groq
            </p>
          </Card>

          <Card className="p-6 bg-zinc-900/50 backdrop-blur-md border-zinc-800 hover:border-zinc-700 transition-all">
            <div className="text-3xl mb-2">🎨</div>
            <h3 className="font-heading text-zinc-100 mb-2">Vibe-Focused</h3>
            <p className="text-sm text-zinc-400">
              Playlists that feel human-curated, not algorithmic
            </p>
          </Card>
        </div>

        {/* CTA */}
        <div className="pt-8">
          <Button
            size="lg"
            onClick={() => signIn("spotify", { callbackUrl: "/select" })}
            className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white font-semibold px-8 py-6 text-lg rounded-full shadow-lg shadow-green-500/20 transition-all hover:shadow-green-500/30 hover:scale-105"
          >
            <svg
              className="w-6 h-6 mr-2"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
            </svg>
            Continue with Spotify
          </Button>

          <p className="text-xs text-zinc-500 mt-4">
            Select 1-5 songs to get started. No sign-up required.
          </p>
        </div>
      </div>
    </div>
  );
}
