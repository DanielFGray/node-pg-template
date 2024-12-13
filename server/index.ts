import express from 'express'
import morgan from 'morgan'
import session from 'express-session'
import ConnectPgSimple from 'connect-pg-simple'
import { rootDb, rootPool, withAuthContext } from './db.js'
import { sql } from 'kysely'
import type { FormResult, Session, User, UserEmail } from '#app/types.js'
import { randomNumber } from '#lib/index.js'
import { setTimeout } from 'node:timers/promises'
import { env } from './assertEnv.js'
import { z } from 'zod'
import { GitHub, OAuth2RequestError, OAuth2Tokens, generateState } from 'arctic'
import { parseCookies, serializeCookie } from 'oslo/cookie'
import log from './log.js'
import * as schemas from '#app/schemas.js'

declare module 'express-session' {
  interface SessionData {
    user?: null | {
      user_id: string
      session_id: string
    }
  }
}

const rootUrl = env.VITE_ROOT_URL

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
  .use(morgan(env.NODE_ENV === 'production' ? 'common' : 'dev'))
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
      secret: env.SECRET,
    }),
  )

  .get('/posts', async (req, res) => {
    withAuthContext(req, async tx => {
      const posts = await tx
        .selectFrom('app_public.posts')
        .innerJoin('app_public.users', 'app_public.posts.user_id', 'app_public.users.id')
        .select([
          'app_public.posts.id',
          'app_public.posts.body',
          'app_public.posts.privacy',
          'app_public.posts.created_at',
          'app_public.posts.updated_at',
          sql<User[]>`to_json(app_public.users.*)`.as('user'),
        ])
        .execute()
      res.json({ ok: true, payload: posts } satisfies FormResult)
    })
  })

  .post('/posts', async (req, res) => {
    withAuthContext(req, async tx => {
      const { data: body } = schemas.createPost.safeParse(req.body)
      if (!body) return res.status(400).json({ ok: false } satisfies FormResult)
      try {
        const post = await tx
          .insertInto('app_public.posts')
          .values(body)
          .returningAll()
          .executeTakeFirstOrThrow()
        res.json({ ok: true, payload: post } satisfies FormResult)
      } catch (err) {
        log.error('%O', err)
        res.json({ ok: false } satisfies FormResult)
      }
    })
  })

  .post('/register', (req, res) => {
    const body = schemas.register.safeParse(req.body)
    if (!body.success) return res.status(400).json(body.error.flatten() satisfies FormResult)
    const { username, password, email } = body.data
    req.session.regenerate(async () => {
      try {
        const user = await rootDb
          .selectFrom(
            sql<User>`
              app_private.really_create_user(
                username => ${username}::citext,
                email => ${email || null},
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
          html: () =>
            res.redirect(rootUrl + decodeURIComponent(String(req.query.redirectTo) ?? '/')),
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
    const body = schemas.login.safeParse(req.body)
    if (!body.success) return res.status(400).json(body.error.flatten() satisfies FormResult)
    const { id, password } = body.data
    req.session.regenerate(async () => {
      try {
        const {
          rows: [session],
        } = await sql`
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

        return withAuthContext(req, async tx => {
          const user = await tx
            .selectFrom('app_public.users')
            .where('id', '=', eb => eb.fn('app_public.current_user_id', []))
            .selectAll()
            .executeTakeFirst()
          const redir = req.query.redirectTo?.toString().startsWith('/')
            ? decodeURIComponent(req.query.redirectTo?.toString())
            : '/'
          res.format({
            json: () => res.json({ payload: user ?? null } satisfies FormResult),
            html: () => res.redirect(rootUrl + redir),
          })
        })
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
    return withAuthContext(req, async tx => {
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
              json_agg(e.* order by created_at) as emails
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

  .delete('/settings/email', (req, res) => {
    if (!req.session.user?.user_id)
      return res
        .status(401)
        .json({ formErrors: ['you must be logged in to do that!'] } satisfies FormResult)
    log.debug(req.body)
    const body = schemas.deleteEmail.safeParse(req.body)
    if (!body.success) return res.status(400).json(body.error.flatten() satisfies FormResult)
    return withAuthContext(req, async tx => {
      try {
        const result = await tx
          .deleteFrom('app_public.user_emails')
          .where('id', '=', body.data.emailId)
          .returningAll()
          .execute()
        res.json({ payload: result } satisfies FormResult)
      } catch (err) {
        log.error('%O', err)
        res.status(500).json({
          formErrors: ['there was an error processing your request'],
        } satisfies FormResult)
      }
    })
  })

  .post('/settings/email', (req, res) => {
    if (!req.session.user?.user_id)
      return res
        .status(401)
        .json({ formErrors: ['you must be logged in to do that!'] } satisfies FormResult)
    const body = schemas.addEmail.safeParse(req.body)
    if (!body.success) return res.status(400).json(body.error.flatten() satisfies FormResult)
    return withAuthContext(req, async tx => {
      try {
        const result = await tx
          .insertInto('app_public.user_emails')
          .values({ email: body.data.email })
          .returningAll()
          .execute()
        res.json({ payload: result } satisfies FormResult)
      } catch (err) {
        if (err.code == 'EMTKN') {
          return res.status(400).json({
            formErrors: [err.message],
          } satisfies FormResult)
        }
        log.error('%O', err)
        res.status(500).json({
          formErrors: ['there was an error processing your request'],
        } satisfies FormResult)
      }
    })
  })

  .post('/me', async (req, res) => {
    if (!req.session.user?.user_id)
      return res
        .status(401)
        .json({ formErrors: ['you must be logged in to do that!'] } satisfies FormResult)
    const userId = req.session.user.user_id
    const body = schemas.updateProfile.safeParse(req.body)
    if (!body.success) return res.status(400).json(body.error.flatten() satisfies FormResult)
    const { username, name, bio, avatar_url } = body.data
    return withAuthContext(req, async tx => {
      try {
        const user = await tx
          .updateTable('app_public.users')
          .set({ username, name, bio, avatar_url })
          .where('id', '=', userId)
          .returningAll()
          .executeTakeFirstOrThrow()
        res.format({
          json: () =>
            res.json({
              formMessages: ['profile updated'],
              payload: user,
            } satisfies FormResult),
          html: () => res.redirect(rootUrl + '/settings'),
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
    const body = schemas.changePassword.safeParse(req.body)
    if (!body.success) return res.status(400).json(body.error.flatten() satisfies FormResult)
    return withAuthContext(req, async tx => {
      try {
        await tx
          .selectFrom(
            sql`app_public.change_password(${body.data.oldPassword}, ${body.data.newPassword})`.as(
              'change_password',
            ),
          )
          .selectAll(['change_password'])
          .execute()
        res.format({
          json: () => res.json({ formMessages: ['password updated'] } satisfies FormResult),
          html: () => res.redirect(rootUrl + '/settings'),
        })
      } catch (err: any) {
        if (err.code === 'CREDS')
          return res.status(400).json({
            formErrors: ['your previous password was incorrect'],
          } satisfies FormResult)
        log.error('%O', err)
        res.status(500).json({
          formErrors: ['there was an error processing your request'],
        } satisfies FormResult)
      }
    })
  })

  .get('/me', (req, res) => {
    return withAuthContext(req, async tx => {
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
    if (!req.session.user?.user_id)
      return res
        .status(401)
        .json({ formErrors: ['you must be logged in to do that!'] } satisfies formresult)
    const { data: body } = schemas.deleteUser.safeParse(req.body)
    return withAuthContext(req, async tx => {
      try {
        if (body?.token) {
          const result = await tx
            .selectFrom(
              sql<{
                confirm_account_deletion: boolean | null
              }>`app_public.confirm_account_deletion(${body.token})`.as('confirm_account_deletion'),
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
                html: () => res.redirect(rootUrl),
              })
            })
          })
        } else {
          const result = await tx
            .selectFrom(
              sql<{
                request_account_deletion: unknown | null
              }>`app_public.request_account_deletion()`.as('request_account_deletion'),
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
    const body = schemas.forgotPassword.safeParse(req.body)
    if (!body.success) return res.status(400).json(body.error.flatten() satisfies FormResult)
    await rootDb
      .selectFrom(sql`app_public.forgot_password(${body.data.email})`.as('forgot_password'))
      .selectAll()
      .execute()
    res.json({ formMessages: ['Password reset email sent'] } satisfies FormResult)
  })

  .post('/reset-password', async (req, res) => {
    const body = schemas.resetPassword.safeParse(req.body)
    if (!body.success) return res.status(400).json(body.error.flatten() satisfies FormResult)
    try {
      const session = await rootDb
        .selectFrom(eb =>
          rootDb
            .fn<Session>('app_private.reset_password', [
              eb.val(body.data.userId),
              eb.val(body.data.token),
              eb.val(body.data.password),
            ])
            .as('reset_password'),
        )
        .selectAll()
        .where(eb => eb.not(eb('reset_password.uuid', 'is', null)))
        .executeTakeFirst()
      if (!session)
        return res.json({ fieldErrors: { token: ['invalid token'] } } satisfies FormResult)
      req.session.user = {
        session_id: session.uuid,
        user_id: session.user_id,
      }
      const user = await rootDb
        .selectFrom('app_public.users')
        .where('id', '=', session.user_id)
        .selectAll()
        .executeTakeFirstOrThrow()
      res.format({
        json: () => res.json({ payload: { user } } satisfies FormResult),
        html: () => res.redirect(rootUrl + '/'),
      })
    } catch (err) {
      log.error('%O', err)
      res.status(500).json({ formErrors: ['Failed to reset password'] } satisfies FormResult)
    }
  })

  .post('/verify-email', (req, res) => {
    const body = schemas.verifyEmail.safeParse(req.body)
    if (!body.success) return res.status(400).json(body.error.flatten() satisfies FormResult)
    return withAuthContext(req, async tx => {
      try {
        const result = await tx
          .selectFrom(eb =>
            tx
              .fn<{
                verify_email: boolean | null
              }>('app_public.verify_email', [eb.val(body.data.id), eb.val(body.data.token)])
              .as('verify_email'),
          )
          .selectAll()
          .executeTakeFirstOrThrow()
        res.json({ payload: result } satisfies FormResult)
      } catch (e) {
        res.json({ formErrors: ['failed to verify email'] } satisfies FormResult)
      }
    })
  })

  .post('/make-email-primary', (req, res) => {
    if (!req.session.user?.user_id)
      return res
        .status(401)
        .json({ formErrors: ['you must be logged in to do that!'] } satisfies FormResult)
    const body = schemas.makeEmailPrimary.safeParse(req.body)
    if (!body.success) return res.status(400).json(body.error.flatten() satisfies FormResult)
    return withAuthContext(req, async tx => {
      const result = await tx
        .selectFrom(eb =>
          tx.fn<UserEmail>('app_public.make_email_primary', [eb.val(body.data.emailId)]).as('u'),
        )
        .selectAll()
        .where(eb => eb.not(eb('id', 'is', null)))
        .executeTakeFirstOrThrow()
      res.json({ payload: result } satisfies FormResult)
    })
  })

  .post('/resend-email-verification-code', (req, res) => {
    if (!req.session.user?.user_id)
      return res
        .status(401)
        .json({ formErrors: ['you must be logged in to do that!'] } satisfies FormResult)
    const body = schemas.resendEmailVerification.safeParse(req.body)
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
      return res
        .status(401)
        .json({ formErrors: ['you must be logged in to do that!'] } satisfies FormResult)
    const body = schemas.unlinkAuth.safeParse(req.body)
    if (!body.success) return res.status(400).json(body.error.flatten() satisfies FormResult)
    return withAuthContext(req, async tx => {
      const { numDeletedRows } = await tx
        .deleteFrom('app_public.user_authentications')
        .where('id', '=', body.data.id)
        .executeTakeFirst()
      if (numDeletedRows < 1)
        return res
          .status(400)
          .json({ formErrors: ['failed to unlink account'] } satisfies FormResult)
      res.json({ payload: { success: true } } satisfies FormResult)
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
          html: () => res.redirect(rootUrl),
        })
      })
    })
  })

if (!(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET)) {
  log.info('GitHub OAuth is not configured')
} else {
  const providerSpec = z.enum(['github'])

  const oauthProviders = {
    github: new GitHub(
      env.GITHUB_CLIENT_ID,
      env.GITHUB_CLIENT_SECRET,
      `${rootUrl}/auth/github/callback`,
    ),
  } satisfies Record<z.infer<typeof providerSpec>, unknown>

  app.get('/auth/:provider', (req, res) => {
    const params = providerSpec.safeParse(req.params.provider)
    if (!params.success) return res.status(400).json(params.error.flatten() satisfies FormResult)
    const provider = oauthProviders[params.data]
    const state = generateState()
    const url = provider.createAuthorizationURL(state, ['user:email'])
    res
      .appendHeader(
        'Set-Cookie',
        serializeCookie('github_oauth_state', state, {
          path: '/',
          secure: env.NODE_ENV === 'production',
          httpOnly: true,
          maxAge: 60 * 10,
          sameSite: 'lax',
        }),
      )
      .redirect(url.toString())
  })

  app.get('/auth/:provider/callback', async (req, res) => {
    const params = providerSpec.safeParse(req.params.provider)
    if (!params.success) return res.status(400).json(params.error.flatten() satisfies FormResult)
    const code = req.query.code?.toString() ?? null
    const state = req.query.state?.toString() ?? null
    const storedState = parseCookies(req.headers.cookie ?? '').get('github_oauth_state') ?? null
    if (!code || !state || !storedState || state !== storedState) return res.status(400).end()
    const redir = req.query.redirectTo?.toString().startsWith('/')
      ? decodeURIComponent(req.query.redirectTo?.toString())
      : '/'
    log.debug('oauth redirect to %s', redir)
    try {
      const tokens = await oauthProviders.github.validateAuthorizationCode(code)
      const {
        data: { viewer: githubUser },
      } = z
        .object({
          data: z.object({
            viewer: z.object({
              email: z.string(),
              username: z.string(),
              name: z.string(),
              avatar_url: z.string(),
            }),
          }),
        })
        .parse(
          await (
            await fetch('https://api.github.com/graphql', {
              method: 'POST',
              headers: {
                // @ts-expect-error docs say tokens.access_token but only this works instead
                Authorization: `Bearer ${tokens.data.access_token}`,
              },
              body: JSON.stringify({
                query: 'query { viewer { email username: login name avatar_url: avatarUrl } }',
              }),
            })
          ).json(),
        )
      const session = await rootDb
        .with('create_user', db =>
          db
            .selectFrom(
              rootDb
                .fn<User>('app_private.link_or_register_user', [
                  sql`f_user_id => ${req.session.user?.user_id ?? null}`,
                  sql`f_service => ${params.data}`,
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
      if (!req.session.user) {
        req.session.user = {
          session_id: session.uuid,
          user_id: session.user_id,
        }
      }
      res.format({
        json: () => res.json({ payload: { user_id: session.user_id } } satisfies FormResult),
        html: () => res.redirect(rootUrl + redir ? decodeURIComponent(redir!) : ''),
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

if (process.env.NODE_ENV !== 'production') {
  import('./cypress.js').then(m => m.installCypressCommands(app))
}

app.listen(env.PORT, () => log.info(`server listening on port ${env.PORT}`))
