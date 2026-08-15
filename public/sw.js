/*global UVServiceWorker,__uv$config*/
importScripts('/uv/uv.bundle.js');
importScripts('/uv/uv.config.js');
importScripts(__uv$config.sw || '/uv/uv.sw.js');

const uv = new UVServiceWorker();

async function handleRequest(event) {
  try {
    if (uv.route(event)) return await uv.fetch(event);
    return await fetch(event.request);
  } catch (error) {
    console.warn('mex service worker request failed', event.request.url, error);
    return new Response(null, { status: 503, statusText: 'Proxy request failed' });
  }
}

self.addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event));
});
