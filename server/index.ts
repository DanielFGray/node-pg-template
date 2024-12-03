import express from 'express'
import morgan from 'morgan'
import session from 'express-session'
import ConnectPgSimple from 'connect-pg-simple'
import pg from 'pg'
import * as db from 'zapatos/db'
import Debug from 'debug'
import type { FormResult, User } from '#app/types.js'
import { randomNumber } from '#lib/index.js'
import { setTimeout } from 'node:timers/promises'
import { env } from './assertEnv.js'
import { z } from 'zod'
import { GitHub, OAuth2RequestError, OAuth2Tokens, generateState } from 'arctic'
import { parseCookies, serializeCookie } from 'oslo/cookie'

declare module 'express-session' {
  interface SessionData {
    user_id?: string | null
    uuid?: string | null
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
    txn: dbDebug.extend('transaction'),
  },
}

const strFromTxnId = (txnId: number | undefined) => (txnId === undefined ? '-' : String(txnId))
db.setConfig({
  queryListener: (query, txnId) => {
    log.db.query('(%s) %s', strFromTxnId(txnId), query.text)
  },
  resultListener: (result, txnId, elapsedMs) =>
    log.db.result('(%s, %dms) %O', strFromTxnId(txnId), elapsedMs?.toFixed(1), result),
  transactionListener: (message, txnId) => log.db.txn('(%s) %s', strFromTxnId(txnId), message),
})

const rootPool = new pg.Pool({ connectionString: DATABASE_URL })
const authPool = new pg.Pool({ connectionString: AUTH_DATABASE_URL })

async function withAuthContext<R>(
  req: express.Request,
  cb: (sql: db.TxnClientForSerializable) => R,
) {
  return db.serializable(authPool, async tx => {
    await db.sql`
      select
        set_config('role', ${db.param(DATABASE_VISITOR)}, false),
        set_config('jwt.claims.session_id', ${db.param(req.session.uuid ?? '')}, true);
    `.run(tx)
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
        const [user] = await db.sql<db.SQL, User[]>`
        select u.* from app_private.really_create_user(
          username => ${db.param(username)}::citext,
          email => ${db.param(email)}::citext,
          email_is_verified => false,
          name => null,
          avatar_url => null,
          password => ${db.param(password)}::text
        ) u
        where not (u is null);
      `.run(rootPool)
        if (!user?.id) {
          log.error('%O', user)
          throw new Error('failed to create/return user')
        }
        const session = await db.insert('app_private.sessions', { user_id: user.id }).run(rootPool)
        req.session.uuid = session.uuid
        req.session.user_id = user.id
        log.info('new user:', user.username)
        res.format({
          json: () => res.json({ payload: user } satisfies FormResult),
          html: () => res.redirect(VITE_ROOT_URL + decodeURIComponent(req.query.redirectTo ?? '/')),
        })
      } catch (err: any) {
        if (db.isDatabaseError(err, 'IntegrityConstraintViolation_UniqueViolation')) {
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
        const [session] = await db.sql`
        select u.*
        from app_private.login(
          ${db.param(id)}::citext,
          ${db.param(password)}
        ) u
        where not (u is null)
      `.run(rootPool)
        if (!session) {
          await setTimeout(randomNumber(100, 400))
          return res.status(401).json({
            formErrors: ['invalid username or password'],
          } satisfies FormResult)
        }

        req.session.uuid = session.uuid
        req.session.user_id = session.user_id
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
    if (!req.session.user_id) return res.status(401).end('you must be logged in to do that!')
    withAuthContext(req, async tx => {
      const [settings] = await db.sql`
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
    `.run(tx)
      res.format({
        json: () => res.json({ payload: settings } satisfies FormResult),
      })
    })
  })

  .post('/me', async (req, res) => {
    if (!req.session?.user_id)
      return res
        .status(401)
        .json({ formErrors: ['you must be logged in to do that!'] } satisfies FormResult)
    const user_id = req.session.user_id
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
        const [user] = await db
          .update('app_public.users', { username, name, bio, avatar_url: avatar }, { id: user_id })
          .run(tx)
        if (!user) throw new Error('invariant: undefined user in POST /settings/profile')
        res.format({
          json: () =>
            res.json({
              formMessages: ['profile updated'],
              payload: user,
            } satisfies FormResult),
          html: () => res.redirect('/settings'),
        })
      } catch (err: any) {
        if (db.isDatabaseError(err, 'IntegrityConstraintViolation_UniqueViolation')) {
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
    if (!req.session?.user_id)
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
        const [result] = await db.sql<db.SQL, { change_password: boolean | null }[]>`
          select * from app_public.change_password(
            ${db.param(body.data.oldPassword)},
            ${db.param(body.data.newPassword)}
          );
        `.run(tx)
        if (!result) throw new Error('invariant: no password change result')
        res.format({
          json: () => res.json({ formMessages: ['password updated'] } satisfies FormResult),
          html: () => res.redirect('/settings'),
        })
      } catch (err) {
        log.error('%O', err)
        res.status(500).json({
          formErrors: ['there was an error processing your request'],
        } satisfies FormResult)
      }
    })
  })

  .get('/me', (req, res) => {
    if (!req.session.user_id) return res.json({ payload: null } satisfies FormResult)
    withAuthContext(req, async tx => {
      const [user] = await db.select('app_public.users', { id: req.session.user_id }).run(tx)
      res.format({
        json: () => res.json({ payload: user } satisfies FormResult),
      })
    })
  })

  .delete('/me', (req, res, next) => {
    if (!req.session?.user_id) return res.status(401).end('you must be logged in to do that!')
    const { data: body } = z.object({ token: z.string().optional() }).safeParse(req.body)
    withAuthContext(req, async tx => {
      try {
        if (body?.token) {
          const [result] = await db.sql<db.SQL, { confirm_account_deletion: boolean | null }[]>`
            select * from app_public.confirm_account_deletion(${db.param(body.token)});
          `.run(tx)
          if (!result?.confirm_account_deletion)
            throw new Error('invariant: error deleting account')
          delete req.session.uuid
          delete req.session.user_id
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
                html: () => res.redirect('/'),
              })
            })
          })
        } else {
          const [result] = await db.sql<db.SQL, { request_account_deletion: unknown | null }[]>`
            select * from app_public.request_account_deletion();
          `.run(tx)
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
    await db.sql`
      select app_public.forgot_password(${db.param(body.data.email)}::citext);
    `.run(rootPool)
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
      const [result] = await db.sql<db.SQL, { reset_password: boolean | null }[]>`
          select * from app_private.reset_password(
            ${db.param(body.data.user_id)}::uuid,
            ${db.param(body.data.token)}::text,
            ${db.param(body.data.password)}::text
          );
        `.run(tx)
      res.json(result)
    } catch (err) {
      log.error(err)
      res.status(500).json({ formErrors: ['Failed to reset password'] } satisfies FormResult)
    }
  })

  .post('/verify-email', async (req, res) => {
    const body = z
      .object({
        id: z.string().uuid(),
        token: z.string(),
      })
      .safeParse(req.body)
    if (!body.success) return res.status(400).json(body.error.flatten() satisfies FormResult)
    withAuthContext(req, async tx => {
      const [result] = await db.sql<db.SQL, { verify_email: boolean | null }[]>`
        select * from app_public.verify_email(
          ${db.param(body.data.id)}::uuid,
          ${db.param(body.data.token)}
        );
      `.run(tx)
      res.json({ payload: result } satisfies FormResult)
    })
  })

  .post('/make-email-primary', async (req, res) => {
    if (!req.session?.user_id) return res.status(401).json({ payload: null } satisfies FormResult)
    const body = z.object({ emailId: z.string().uuid() }).safeParse(req.body)
    if (!body.success) return res.status(400).json(body.error.flatten() satisfies FormResult)
    withAuthContext(req, async tx => {
      const [result] = await db.sql<db.SQL, User[]>`
        select * from app_public.make_email_primary(${db.param(body.data.emailId)}::uuid)
        where not (id is null);
      `.run(tx)
      res.json({ payload: result } satisfies FormResult)
    })
  })

  .post('/resend-email-verification-code', async (req, res) => {
    if (!req.session?.user_id) return res.status(401).json({ payload: null } satisfies FormResult)
    const body = z.object({ emailId: z.string().uuid() }).safeParse(req.body)
    if (!body.success) return res.status(400).json(body.error.flatten() satisfies FormResult)
    withAuthContext(req, async tx => {
      const [result] = await db.sql<db.SQL, { resend_email_verification_code: boolean | null }[]>`
        select * from app_public.resend_email_verification_code(${body.data.emailId}::uuid);
      `.run(tx)
      res.json({ payload: result } satisfies FormResult)
    })
  })

  .post('/unlink-auth', (req, res) => {
    if (!req.session?.user_id) return res.status(401).json({ payload: null } satisfies FormResult)
    const body = z.object({ id: z.string().uuid() }).safeParse(req.body)
    if (!body.success) return res.status(400).json(body.error.flatten() satisfies FormResult)
    withAuthContext(req, async tx => {
      const [result] = await db
        .deletes('app_public.user_authentications', { id: body.data.id })
        .run(tx)
      res.json({ payload: result })
    })
  })

  .post('/logout', (req, res, next) => {
    // clear the user from the session object and save.
    // this will ensure that re-using the old session id does not have a logged in user
    delete req.session.uuid
    delete req.session.user_id
    req.session.save(err => {
      if (err) next(err)
      // regenerate the session, which is good practice to help
      // guard against forms of session fixation
      req.session.regenerate(err => {
        if (err) next(err)
        res.format({
          json: () => res.json(null),
          html: () => res.redirect('/'),
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

  app.get('/auth/:provider', async (req, res) => {
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
    const redir = req.query.redirectTo?.toString()
    console.log({ redir })
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
      const [user] = await db.sql<db.SQL, User[]>`
        select * from app_private.link_or_register_user(
          f_user_id => ${db.param(req.session.user_id ?? null)},
          f_service => ${db.param(req.params.provider)},
          f_identifier => ${db.param(githubUser.username)},
          f_profile => ${db.param(JSON.stringify(githubUser))},
          f_auth_details => ${db.param(JSON.stringify(tokens))}
        );
      `.run(rootPool)
      if (!user?.id) {
        throw new Error('failed to create/return user')
      }
      if (!req.session.user_id) {
        const session = await db.insert('app_private.sessions', { user_id: user.id }).run(rootPool)
        req.session.uuid = session.uuid
        req.session.user_id = session.user_id
      }

      log.debug('new user %O', githubUser.username)
      res.format({
        json: () => res.json({ payload: user } satisfies FormResult),
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
