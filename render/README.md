# Mex Wisp server

Deploy this folder as a Render Node web service.

- Build command: `npm install`
- Start command: `npm start`
- Health check path: `/healthz`

After deployment, set the frontend environment variable to the service WebSocket URL:

```text
NEXT_PUBLIC_WISP_URL=wss://your-wisp-service.onrender.com/wisp/
```

The Wisp server keeps its default protections, including blocking private and loopback destination IPs.
