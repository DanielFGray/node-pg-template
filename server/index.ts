import { app } from './app.js'
import log from './log.js'
import { env } from './assertEnv.js'

if (process.env.NODE_ENV !== 'production') {
  import('./cypress.js').then(m => m.installCypressCommands(app))
}

app.listen(env.PORT, () => log.info(`server listening on port ${env.PORT}`))
