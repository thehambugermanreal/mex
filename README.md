# mex

A small green glassmorphism browser shell powered by Ultraviolet, bare-mux, Epoxy transport, and a Wisp websocket service.

## Run locally

```bash
npm install
npm run dev
```

The Vite UI falls back to a same-origin Wisp endpoint. For a separate Wisp service, set `VITE_WISP_URL` to a `ws://` or `wss://` URL ending in `/` before building.

## Render

The single Node service in `render/render.yaml` serves the built Vite app and handles Wisp upgrades from the same origin. Render's `PORT` is used automatically, so the browser can connect to its own `wss://` endpoint in production.

The pinned browser assets are kept in `public/uv`, `public/epoxy`, `public/baremux`, and `public/wisp` so the proxy does not depend on a third-party CDN at runtime.
