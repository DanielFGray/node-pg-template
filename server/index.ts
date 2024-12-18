import http from 'node:http'
import { app } from './app.js'
import log from './log.js'
import { env } from './assertEnv.js'

if (process.env.NODE_ENV !== 'production') {
  import('./cypress.js').then(m => m.installCypressCommands(app))
}

const server = http.createServer(app.handle.bind(app))

app.listen(env.PORT, () => log.info('server listening on %O', server.address()))
