import express from 'express'
import morgan from 'morgan'
import session from 'express-session'
import ConnectPgSimple from 'connect-pg-simple'
import pg from 'pg'
import { Kysely, PostgresDialect, sql, type Transaction } from 'kysely'
import type { DB } from 'kysely-codegen'
import Debug from 'debug'
import type { FormResult, Session, User } from '#app/types.js'
import { randomNumber } from '#lib/index.js'
import { setTimeout } from 'node:timers/promises'
import { env } from './assertEnv.js'
import { z } from 'zod'
import { GitHub, OAuth2RequestError, OAuth2Tokens, generateState } from 'arctic'
import { parseCookies, serializeCookie } from 'oslo/cookie'

declare module 'express-session' {
  interface SessionData {
    user?: null | {
      user_id: string
      session_id: string
    }
  }
}

const {
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  NODE_ENV,
  DATABASE_URL,
  AUTH_DATABASE_URL,
  DATABASE_VISITOR,
  PORT,
  SECRET,
  VITE_ROOT_URL,
} = env

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

const rootPool = new pg.Pool({ connectionString: DATABASE_URL })
const rootDb = new Kysely<DB>({
  dialect: new PostgresDialect({ pool: rootPool }),
  log(event) {
    log.db.query(event.query.sql)
    if (event.level === 'error') log.db.result(event.query.parameters)
  },
})

/** bigint */
const int8TypeId = 20
pg.types.setTypeParser(int8TypeId, val => {
  return BigInt(val)
})

const authPool = new pg.Pool({ connectionString: AUTH_DATABASE_URL })
const authDb = new Kysely<DB>({
  dialect: new PostgresDialect({ pool: authPool }),
  log(event) {
    log.db.query(event.query.sql)
  },
})

async function withAuthContext<R>(req: express.Request, cb: (sql: Transaction<DB>) => R) {
  const sid = req.session.user?.session_id ?? null
  return authDb.transaction().execute(async tx => {
    await sql`
      select
        set_config('role', ${DATABASE_VISITOR}, false),
        set_config('jwt.claims.session_id', ${sid}, true);
    `.execute(tx)
    return cb(tx)
  })
}

const usernameSpec = z
  .string()
  // this is also enforced in the database but this gives nicer error messages
  .refine(n => n.length >= 3 && n.length <= 64, 'username must be between 3 and 64 characters')
// .refine(n => /^\w+$/, 'username may only contain numbers, letters, and underscores')

const passwordSpec = z
  .string()
  .refine(pw => pw.length >= 6, 'password must be at least 6 characters')
// .refine(pw => /\W/.test(pw), 'password must contain a number or symbol')

const MILLISECONDS = 1000
const DAY = 86400
const cookieMaxAge = 7 * DAY

const PgStore = ConnectPgSimple(session)

const app = express()
  .use(morgan(NODE_ENV === 'production' ? 'common' : 'dev'))
  .use(express.urlencoded({ extended: false }))

  .use(
    session({
      rolling: true,
      saveUninitialized: false,
      resave: false,
      cookie: {
        maxAge: cookieMaxAge * MILLISECONDS,
        httpOnly: true,
        sameSite: 'lax',
        secure: 'auto',
      },
      store: new PgStore({
        pool: rootPool,
        schemaName: 'app_private',
        tableName: 'connect_pg_simple_sessions',
      }),
      secret: SECRET,
    }),
  )

  .post('/register', (req, res) => {
    const body = z
      .object({
        username: usernameSpec,
        password: passwordSpec,
        email: z.string().email(),
        confirmPassword: z.string(),
      })
      .strict()
      .refine(data => data.password === data.confirmPassword, 'passwords must match')
      .safeParse(req.body)
    if (!body.success) return res.status(400).json(body.error.flatten() satisfies FormResult)
    const { username, password, email } = body.data
    req.session.regenerate(async () => {
      try {
        const user = await rootDb
          .selectFrom(
            sql<User>`
              app_private.really_create_user(
                username => ${username}::citext,
                email => ${email}::citext,
                email_is_verified => false,
                name => null,
                avatar_url => null,
                password => ${password}::text
              )`.as('u'),
          )
          .selectAll()
          .executeTakeFirstOrThrow()
        const session = await rootDb
          .insertInto('app_private.sessions')
          .values({ user_id: user.id })
          .returningAll()
          .executeTakeFirstOrThrow()
        req.session.user = { session_id: session.uuid, user_id: user.id }
        log.info('new user:', user.username)
        res.format({
          json: () => res.json({ payload: user } satisfies FormResult),
          html: () => res.redirect(VITE_ROOT_URL + decodeURIComponent(req.query.redirectTo ?? '/')),
        })
      } catch (err: any) {
        if (err.code === '23505') {
          return res.status(401).json({
            fieldErrors: { username: ['username already exists'] },
          } satisfies FormResult)
        }
        log.error('%O', err)
        res.status(500).json({
          formErrors: ['there was an error processing your request'],
        } satisfies FormResult)
      }
    })
  })

  .post('/login', (req, res) => {
    const body = z.object({ id: z.string(), password: z.string() }).strict().safeParse(req.body)
    if (!body.success) return res.status(400).json(body.error.flatten() satisfies FormResult)
    const { id, password } = body.data
    req.session.regenerate(async () => {
      try {
        const {
          rows: [session],
        } = await sql<Session>`
          select u.* from app_private.login(
            ${id}::citext,
            ${password}
          ) u
          where not (u is null)
        `.execute(rootDb)
        if (!session) {
          await setTimeout(randomNumber(100, 400))
          return res.status(401).json({
            formErrors: ['invalid username or password'],
          } satisfies FormResult)
        }
        req.session.user = {
          session_id: session.uuid,
          user_id: session.user_id,
        }
        res.json({ payload: session.user_id } satisfies FormResult)
      } catch (err) {
        log.error('%O', err)
        res.status(500).json({
          formErrors: ['there was an error processing your request'],
        } satisfies FormResult)
      }
    })
  })

  .get('/settings', async (req, res) => {
    if (!req.session.user?.user_id) return res.status(401).end('you must be logged in to do that!')
    withAuthContext(req, async tx => {
      const {
        rows: [settings],
      } = await sql`
      select
        emails,
        authentications,
        app_public.users_has_password(u) has_password
      from
        app_public.users u,
        lateral (
          select
            coalesce(json_agg(a.*), '[]') as authentications
          from
            app_public.user_authentications a
          where
            user_id = u.id
        ) _a,
        lateral (
          select
            json_agg(e.*) as emails
          from
            app_public.user_emails e
          where
            user_id = u.id
        ) _e
      where
        u.id = app_public.current_user_id()
    `.execute(tx)
      res.format({
        json: () => res.json({ payload: settings } satisfies FormResult),
      })
    })
  })

  .post('/me', async (req, res) => {
    if (!req.session.user?.user_id)
      return res
        .status(401)
        .json({ formErrors: ['you must be logged in to do that!'] } satisfies FormResult)
    const userId = req.session.user.user_id
    const body = z
      .object({
        username: usernameSpec,
        name: z.string(),
        bio: z.string(),
        avatar: z.string().url(),
      })
      .partial()
      .safeParse(req.body)
    if (!body.success) return res.status(400).json(body.error.flatten() satisfies FormResult)
    const { username, name, bio, avatar } = body.data
    withAuthContext(req, async tx => {
      try {
        const [user] = await tx
          .updateTable('app_public.users')
          .set({ username, name, bio, avatar_url: avatar })
          .where('id', '=', userId)
          .execute()
        if (!user) throw new Error('invariant: undefined user in POST /settings/profile')
        res.format({
          json: () =>
            res.json({
              formMessages: ['profile updated'],
              payload: user,
            } satisfies FormResult),
          html: () => res.redirect(VITE_ROOT_URL + '/settings'),
        })
      } catch (err: any) {
        if (err.code === '23505') {
          return res.status(403).json({
            fieldErrors: { username: ['username already exists'] },
          } satisfies FormResult)
        }
        log.error('%O', err)
        res.status(500).json({
          formErrors: ['there was an error processing your request'],
        } satisfies FormResult)
      }
    })
  })

  .post('/change-password', async (req, res) => {
    if (!req.session.user?.user_id)
      return res
        .status(401)
        .json({ formErrors: ['you must be logged in to do that!'] } satisfies FormResult)
    const body = z
      .object({
        oldPassword: z.string().optional(),
        newPassword: passwordSpec,
        confirmPassword: z.string(),
      })
      .strict()
      // .refine(
      //   data => !data.newPassword || (data.newPassword && data.oldPassword),
      //   'old and new passwords are required',
      // )
      .refine(data => data.newPassword === data.confirmPassword, 'passwords must match')
      .safeParse(req.body)
    if (!body.success) return res.status(400).json(body.error.flatten() satisfies FormResult)
    withAuthContext(req, async tx => {
      try {
        await tx
          .selectFrom(eb =>
            tx
              .fn('app_public.change_password', [eb.val(body.data.oldPassword), eb.val(body.data.newPassword)])
              .as('change_password'),
          )
          .selectAll(['change_password'])
          .execute()
        res.format({
          json: () => res.json({ formMessages: ['password updated'] } satisfies FormResult),
          html: () => res.redirect(VITE_ROOT_URL + '/settings'),
        })
      } catch (err) {
        log.error('%O', err)
        if (err.errcode === 'CREDS')
          return res.status(500).json({
            formErrors: ['there was an error processing your request'],
          } satisfies FormResult)
        res.status(500).json({
          formErrors: ['there was an error processing your request'],
        } satisfies FormResult)
      }
    })
  })

  .get('/me', (req, res) => {
    withAuthContext(req, async tx => {
      const user = await tx
        .selectFrom('app_public.users')
        .where('id', '=', eb => eb.fn('app_public.current_user_id', []))
        .selectAll()
        .executeTakeFirst()
      res.format({
        json: () => res.json({ payload: user ?? null } satisfies FormResult),
      })
    })
  })

  .delete('/me', (req, res, next) => {
    if (!req.session.user?.user_id) return res.status(401).end('you must be logged in to do that!')
    const { data: body } = z.object({ token: z.string().optional() }).safeParse(req.body)
    withAuthContext(req, async tx => {
      try {
        if (body?.token) {
          const result = await tx
            .selectFrom(eb =>
              tx
                .fn<{
                  confirm_account_deletion: boolean | null
                }>('app_public.confirm_account_deletion', [eb.val(body.token)])
                .as('confirm_account_deletion'),
            )
            .selectAll()
            .executeTakeFirstOrThrow()
          req.session.user = null
          req.session.save(err => {
            if (err) {
              log.error('%O', err)
              next()
            }
            req.session.regenerate(err => {
              if (err) {
                log.error('%O', err)
                next()
              }
              res.format({
                json: () => res.json({ payload: result }),
                html: () => res.redirect(VITE_ROOT_URL),
              })
            })
          })
        } else {
          const result = await tx
            .selectFrom(
              tx
                .fn<{ request_account_deletion: unknown | null }>('app_public.request_account_deletion')
                .as('request_account_deletion'),
            )
            .selectAll()
            .executeTakeFirst()
          res.json(result)
        }
      } catch (err) {
        log.error(err)
        res.status(500).json({ formErrors: ['Account deletion failed'] } satisfies FormResult)
      }
    })
  })

  .post('/forgot-password', async (req, res) => {
    const body = z.object({ email: z.string().email() }).safeParse(req.body)
    if (!body.success) return res.status(400).json(body.error.flatten() satisfies FormResult)
    await rootDb
      .selectFrom(eb => rootDb.fn('app_public.forgot_password', [eb.val(body.data.email)]).as('forgot_password'))
      .selectAll()
      .execute()
    res.json({ formMessages: ['Password reset email sent'] } satisfies FormResult)
  })

  .post('/reset-password', async (req, res) => {
    const body = z
      .object({
        user_id: z.string().uuid(),
        token: z.string(),
        password: z.string(),
      })
      .safeParse(req.body)
    if (!body.success) return res.status(400).json(body.error.flatten() satisfies FormResult)
    try {
      const result = await rootDb
        .selectFrom(eb =>
          rootDb
            .fn<{
              reset_password: boolean | null
            }>('app_private.reset_password', [
              eb.val(body.data.user_id),
              eb.val(body.data.token),
              eb.val(body.data.password),
            ])
            .as('reset_password'),
        )
        .selectAll()
        .executeTakeFirst()
      res.json(result)
    } catch (err) {
      log.error(err)
      res.status(500).json({ formErrors: ['Failed to reset password'] } satisfies FormResult)
    }
  })

  .post('/verify-email', (req, res) => {
    const body = z
      .object({
        id: z.string().uuid(),
        token: z.string(),
      })
      .safeParse(req.body)
    if (!body.success) return res.status(400).json(body.error.flatten() satisfies FormResult)
    return withAuthContext(req, async tx => {
      const result = await tx
        .selectFrom(eb =>
          tx
            .fn<{ verify_email: boolean | null }>('app_public.verify_email', [
              eb.val(body.data.token)
            ])
            .as('verify_email'),
        )
        .selectAll()
        .execute()
      res.json({ payload: result } satisfies FormResult)
    })
  })

  .post('/make-email-primary', (req, res) => {
    if (!req.session.user?.user_id)
      return res.status(401).json({ payload: null } satisfies FormResult)
    const body = z.object({ emailId: z.string().uuid() }).safeParse(req.body)
    if (!body.success) return res.status(400).json(body.error.flatten() satisfies FormResult)
    withAuthContext(req, async tx => {
      const result = await tx
        .selectFrom(eb => tx.fn<User>('app_public.make_email_primary', [eb.val(body.data.emailId)]).as('u'))
        .selectAll()
        .where(eb => eb.not(eb('id', 'is', null)))
        .executeTakeFirst()
      res.json({ payload: result } satisfies FormResult)
    })
  })

  .post('/resend-email-verification-code', (req, res) => {
    if (!req.session.user?.user_id)
      return res.status(401).json({ payload: null } satisfies FormResult)
    const body = z.object({ emailId: z.string().uuid() }).safeParse(req.body)
    if (!body.success) return res.status(400).json(body.error.flatten() satisfies FormResult)
    return withAuthContext(req, async tx => {
      const result = await tx
        .selectFrom(eb =>
          tx
            .fn<{
              resend_email_verification_code: boolean | null
            }>('app_public.resend_email_verification_code', [eb.val(body.data.emailId)])
            .as('resend_email_verification_code'),
        )
        .selectAll()
        .executeTakeFirst()
      res.json({ payload: result } satisfies FormResult)
    })
  })

  .post('/unlink-auth', (req, res) => {
    if (!req.session.user?.user_id)
      return res.status(401).json({ payload: null } satisfies FormResult)
    const body = z.object({ id: z.string().uuid() }).safeParse(req.body)
    if (!body.success) return res.status(400).json(body.error.flatten() satisfies FormResult)
    withAuthContext(req, async tx => {
      const { numDeletedRows } = await tx
        .deleteFrom('app_public.user_authentications')
        .where('id', '=', body.data.id)
        .executeTakeFirst()
      res.json({ payload: numDeletedRows > 0 } satisfies FormResult)
    })
  })

  .post('/logout', (req, res, next) => {
    // clear the user from the session object and save.
    // this will ensure that re-using the old session id does not have a logged in user
    req.session.user = null
    req.session.save(err => {
      if (err) next(err)
      // regenerate the session, which is good practice to help
      // guard against forms of session fixation
      req.session.regenerate(err => {
        if (err) next(err)
        res.format({
          json: () => res.json(null),
          html: () => res.redirect(VITE_ROOT_URL),
        })
      })
    })
  })

if (!(GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET)) {
  log.info('GitHub OAuth is not configured')
} else {
  const oauthProviders = {
    github: new GitHub(
      GITHUB_CLIENT_ID,
      GITHUB_CLIENT_SECRET,
      `${VITE_ROOT_URL}/auth/github/callback`,
    ),
  } as const

  const providerSpec = z.literal('github')

  app.get('/auth/:provider', (req, res) => {
    const params = z.object({ params: providerSpec }).safeParse({ params: req.params.provider })
    if (!params.success) return res.status(400).json(params.error.flatten() satisfies FormResult)
    const provider = oauthProviders.github
    const state = generateState()
    const url = provider.createAuthorizationURL(state, ['user:email'])
    res
      .appendHeader(
        'Set-Cookie',
        serializeCookie('github_oauth_state', state, {
          path: '/',
          secure: NODE_ENV === 'production',
          httpOnly: true,
          maxAge: 60 * 10,
          sameSite: 'lax',
        }),
      )
      .redirect(url.toString())
  })

  app.get('/auth/:provider/callback', async (req, res) => {
    const params = z.object({ params: providerSpec }).safeParse({ params: req.params.provider })
    if (!params.success) return res.status(400).json(params.error.flatten() satisfies FormResult)
    const code = req.query.code?.toString() ?? null
    const state = req.query.state?.toString() ?? null
    const storedState = parseCookies(req.headers.cookie ?? '').get('github_oauth_state') ?? null
    if (!code || !state || !storedState || state !== storedState) return res.status(400).end()
    const redir = req.query.redirectTo?.toString() ?? '/'
    try {
      const tokens: { data: OAuth2Tokens } =
        await oauthProviders.github.validateAuthorizationCode(code)
      const {
        data: { viewer: githubUser },
      } = (await (
        await fetch('https://api.github.com/graphql', {
          method: 'POST',
          headers: {
            // @ts-expect-error type mismatch? docs say tokens.access_token,
            Authorization: `Bearer ${tokens.data.access_token}`,
          },
          body: JSON.stringify({
            query: `
              query {
                viewer {
                  email
                  username: login
                  name
                  avatar_url: avatarUrl
                }
              }
            `,
          }),
        })
      ).json()) as {
        data: {
          viewer: {
            email: string
            username: string
            name: string
            avatar_url: string
          }
        }
      }
      const session = await rootDb
        .with('create_user', db =>
          db
            .selectFrom(
              rootDb
                .fn<User>('app_private.link_or_register_user', [
                  sql`f_user_id => ${req.session.user?.user_id ?? null}`,
                  sql`f_service => ${req.params.provider}`,
                  sql`f_identifier => ${githubUser.username}`,
                  sql`f_profile => ${JSON.stringify(githubUser)}`,
                  sql`f_auth_details => ${JSON.stringify(tokens)}`,
                ])
                .as('u'),
            )
            .selectAll(),
        )
        .insertInto('app_private.sessions')
        .values(db => ({ user_id: db.selectFrom('create_user').select(['id']) }))
        .returning(['uuid', 'user_id'])
        .executeTakeFirstOrThrow()
      log.debug(session)
      req.session.user = {
        session_id: session.uuid,
        user_id: session.user_id,
      }

      log.debug('new user %O', githubUser.username)
      res.format({
        json: () => res.json({ payload: { user_id: session.user_id } } satisfies FormResult),
        html: () => res.redirect(VITE_ROOT_URL + redir ? decodeURIComponent(redir!) : ''),
      })
    } catch (err) {
      if (err instanceof OAuth2RequestError && err.message === 'bad_verification_code') {
        return res.status(400).end()
      }
      log.error('%O', err)
      return res.status(500).end()
    }
  })
}

app.listen(PORT, () => console.log(`server listening on port ${PORT}`))
