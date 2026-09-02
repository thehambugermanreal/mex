import http from 'node:http'
import { server as wisp } from '@mercuryworkshop/wisp-js/server'

const port = Number(process.env.PORT || 5001)
const host = process.env.HOST || '0.0.0.0'

const httpServer = http.createServer((request, response) => {
  if (request.url === '/healthz') {
    response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' })
    response.end('ok')
    return
  }

  response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
  response.end('Mex Wisp endpoint')
})

httpServer.on('upgrade', (request, socket, head) => {
  if (!request.url?.startsWith('/wisp/')) {
    socket.destroy()
    return
  }
  wisp.routeRequest(request, socket, head)
})

httpServer.listen(port, host, () => {
  console.log(`Mex Wisp server listening on ${host}:${port}`)
})
