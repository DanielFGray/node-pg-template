import type * as hono from 'hono'
import { Kysely, PostgresDialect, sql, type Transaction } from 'kysely'
import type { DB } from 'kysely-codegen'
import pg from 'pg'
import logger from './log.js'
import { env } from './assertEnv.js'

/** bigint */
const int8TypeId = 20
pg.types.setTypeParser(int8TypeId, val => {
  return BigInt(val)
})

export const rootPool = new pg.Pool({ connectionString: env.DATABASE_URL })
export const authPool = new pg.Pool({ connectionString: env.AUTH_DATABASE_URL })

export const rootDb = new Kysely<DB>({
  dialect: new PostgresDialect({ pool: rootPool }),
  log(event) {
    logger.db.query(event.query.sql)
    if (event.level === 'error') logger.db.result(event.query.parameters)
  },
})

export const authDb = new Kysely<DB>({
  dialect: new PostgresDialect({ pool: authPool }),
  log(event) {
    logger.db.query(event.query.sql)
  },
})

export function withAuthContext<R>(
  ctx: hono.Context,
  cb: (sql: Transaction<DB>) => Promise<R>,
): Promise<R> {
  const sid = ctx.get('session').get('uuid') ?? null
  return authDb.transaction().execute(async tx => {
    await sql`
      select
        set_config('role', ${env.DATABASE_VISITOR}, false),
        set_config('jwt.claims.session_id', ${sid}, true);
    `.execute(tx)
    return cb(tx)
  })
}
