import http from 'node:http'
import { app } from './app.js'
import log from './log.js'
import { env } from './assertEnv.js'

if (process.env.NODE_ENV !== 'production') {
  import('./cypress.js').then(m => m.installCypressCommands(app))
}

// @ts-expect-error .handle is undocumented but works great
const server = http.createServer(app.handle.bind(app))

server.listen(env.PORT, () => {
  const address = server.address()
  return log.info(
    'server listening on port %d',
    typeof address === 'string' ? address : address?.port,
  )
})
