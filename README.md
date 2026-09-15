# mex

A green little corner of the internet for games, apps, music, movies, and chatting. Built with React + Vite, proxied browsing through Scramjet, and Convex handling auth + chat.

## What's inside

- **Home** — landing view with the orbit art.
- **Games** — Lumin catalog with search. Click a game to play it in Lumin's player.
- **Apps** — quick launchers (ChatGPT, Discord, GeForce Now, Newgrounds, Snapchat, TikTok, Twitch, VS Code, YouTube, SoundCloud) opened through the proxy embed.
- **AI / Music / Movie** — Duck.ai, ListenFree, and CinemaOS embedded through the proxy.
- **Chat** — global chat room. Sign in with a username + password (no email, no verification). Delete, edit, reply, and emoji reactions included.
- **Proxy** — full Scramjet browser tab with address bar, back/forward/reload. Type a bare word to search with your chosen engine.
- **Settings** — account stuff (change username/password, delete account), appearance (accent, theme, font, density, grid, orbs, cursor, motion), chat prefs, games per page, proxy homepage/search engine/Wisp override. Saved on-device.

## Stack

- React 19 + Vite + TypeScript
- Tailwind-free hand CSS (`src/index.css`)
- Scramjet + Epoxy + Wisp for proxying (`public/`, `render/` has a standalone Wisp server)
- Convex for auth + chat backend (`convex/`)
- Lucide icons, emoji-mart picker

## Getting started

```bash
npm install
```

You'll need two things running in dev:

```bash
npm run dev            # the site (http://localhost:5173)
npx convex dev         # backend — pushes functions, syncs types
```

On first `convex dev` run it asks you to log in and provisions a dev deployment, then writes the URL to `.env.local` as `VITE_CONVEX_URL`. That's the only env var the client needs:

```
VITE_CONVEX_URL="https://<yours>.convex.cloud"
```

The proxy side uses a Wisp server. Default is the hosted one in `.env` (`NEXT_PUBLIC_WISP_URL`), or point it at your own — there's a ready-to-deploy one in `render/` (see `render/render.yaml`), and you can override it per-device in Settings → Proxy.

Other commands:

```bash
npm run build          # typecheck-free production build into dist/
npx tsc --noEmit       # typecheck
npx convex deploy      # push backend to production
```

## Project layout

```
src/            App, views, styles
public/         proxy runtime (scramjet/epoxy/wisp), sw.js, embed.html,
                app icons, cursors, favicons, orbit art
convex/         schema + queries/mutations (auth, messages)
render/         standalone Wisp server for hosting
```

## Notes

- Game URLs from Lumin are single-use — if one fails to load, just click it again.
- Some sites refuse to be iframed or proxied no matter what; that's on them, not us.
- Passwords are salted SHA-256. Fine for a side project, swap in something slower (scrypt/bcrypt) if this ever matters.
- `EST. 2026` and proud of it.
