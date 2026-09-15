importScripts('/controller/controller.sw.js')

self.addEventListener('fetch', (event) => {
  if (typeof $scramjetController !== 'undefined' && $scramjetController.shouldRoute(event)) {
    event.respondWith($scramjetController.route(event))
  }
})
