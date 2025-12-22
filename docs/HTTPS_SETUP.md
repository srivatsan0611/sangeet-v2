# HTTPS Setup for Local Development

Spotify now requires HTTPS redirect URIs, even for localhost. Here's how to set it up:

## Quick Setup (5 minutes)

### Step 1: Install mkcert

**Mac (using Homebrew):**
```bash
brew install mkcert
mkcert -install
```

**Linux:**
```bash
sudo apt install mkcert
mkcert -install
```

**Windows (using Chocolatey):**
```bash
choco install mkcert
mkcert -install
```

### Step 2: Generate SSL Certificates

From your project root:
```bash
mkdir -p .certificates
cd .certificates
mkcert localhost
cd ..
```

This creates:
- `.certificates/localhost.pem` (certificate)
- `.certificates/localhost-key.pem` (private key)

### Step 3: Update .env

```env
NEXTAUTH_URL="https://localhost:3000"
```

**Important:** Change from `http://` to `https://`

### Step 4: Update Spotify Redirect URI

Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard):

1. Click your app
2. Click "Settings"
3. Under "Redirect URIs", add:
   ```
   https://localhost:3000/api/auth/callback/spotify
   ```
4. Click "Save"

**No more security warning!** ✅

### Step 5: Run the Dev Server

```bash
npm run dev
```

Now visit: **https://localhost:3000**

Your browser will show it's secure (🔒 in address bar).

---

## What We Set Up

1. **`server.js`** - Custom HTTPS server for Next.js
2. **`.certificates/`** - Local SSL certificates (gitignored)
3. **`npm run dev`** - Now uses HTTPS automatically

## Troubleshooting

### "Certificate not trusted" warning in browser

Click "Advanced" → "Proceed to localhost" (it's safe, it's your own certificate)

Or, make sure you ran:
```bash
mkcert -install
```

### Port 3000 already in use

Kill the existing process:
```bash
lsof -ti:3000 | xargs kill -9
```

### Certificates not found

Make sure they're in `.certificates/` with these exact names:
- `localhost.pem`
- `localhost-key.pem`

Regenerate if needed:
```bash
cd .certificates
mkcert localhost
```

---

## Alternative: Use ngrok (No Setup Required)

If you don't want to mess with certificates:

```bash
# Terminal 1: Run your app normally
npm run dev:http

# Terminal 2: Create HTTPS tunnel
npx ngrok http 3000
```

ngrok will give you an HTTPS URL like: `https://abc123.ngrok.io`

**Use that URL in Spotify:**
```
https://abc123.ngrok.io/api/auth/callback/spotify
```

**And in .env:**
```env
NEXTAUTH_URL="https://abc123.ngrok.io"
```

⚠️ **Downside:** URL changes every time you restart ngrok (free tier).

---

## Production

For production, you don't need any of this! Your hosting provider (Vercel, Netlify, etc.) automatically provides HTTPS.

Just set your production redirect URI:
```
https://yourdomain.com/api/auth/callback/spotify
```

---

**Recommended:** Use the mkcert approach. It's a one-time setup and works perfectly for local dev.
