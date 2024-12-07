import Debug from 'debug'

const appDebug = Debug('app')
const dbDebug = Debug('db')
const log = {
  info: appDebug.extend('info'),
  debug: appDebug.extend('debug'),
  error: appDebug.extend('error'),
  db: {
    query: dbDebug.extend('query'),
    result: dbDebug.extend('result'),
  },
}

export default log
