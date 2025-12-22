# Sangeet V2

An AI-powered Spotify playlist curator that transforms how you discover music. This is a complete rewrite of the original [Sangeet](https://github.com/shreyasev/Sangeet-Song-Recommendation-System) TF-IDF Streamlit recommender (v1 branch), now built as a modern web application.

## What's New in V2

- **LLM-Powered Vibe Analysis**: Uses Groq (Llama-3) to understand the emotional context and genre fluidity of your song selections, generating intelligent playlist parameters instead of simple mathematical averages
- Complete rebuild with Next.js 14, TypeScript, and Prisma, replacing the Streamlit/Python stack
- **Spotify Integration**: Full OAuth authentication with direct playlist creation to your Spotify account
- Should be hosted in Vercel as a full stack NextJS app (hopefully)
- **AI-First UX**: Real-time streaming of LLM reasoning with glassmorphic "Deep Space Glass" design system

## Quick Setup

Since Spotify OAuth works on HTTPS Redirect URIs alone, head over to this section:  [How to run this Project on a HTTPS Local Server](docs/HTTPS_SETUP.md)

Once this is done, the TLDR is:
```bash
npm install
npm run dev
npm run dev:http # If for some reason you wanna run the HTTP Version
```

