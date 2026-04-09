import net from 'node:net'

const listenHost = process.env.OPERATOR_HUB_DEBUG_PROXY_HOST ?? '0.0.0.0'
const listenPort = Number(process.env.OPERATOR_HUB_DEBUG_PROXY_PORT ?? 9223)
const targetHost = process.env.OPERATOR_HUB_DEBUG_TARGET_HOST ?? '127.0.0.1'
const targetPort = Number(process.env.OPERATOR_HUB_DEBUG_TARGET_PORT ?? 9222)

const server = net.createServer((clientSocket) => {
  const upstreamSocket = net.connect(targetPort, targetHost)

  clientSocket.on('error', () => {
    upstreamSocket.destroy()
  })
  upstreamSocket.on('error', () => {
    clientSocket.destroy()
  })

  clientSocket.pipe(upstreamSocket)
  upstreamSocket.pipe(clientSocket)
})

server.listen(listenPort, listenHost, () => {
  process.stdout.write(
    `chrome-remote-debug-proxy listening on ${listenHost}:${listenPort} -> ${targetHost}:${targetPort}\n`
  )
})
