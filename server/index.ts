import { Hono } from 'hono'
import type * as hono from 'hono'
import { serve } from '@hono/node-server'
import { logger } from 'hono/logger'
import {
  sessionMiddleware as session,
  type Store,
  type SessionData,
  type Session as HonoSession,
} from 'hono-sessions'
import { rootDb, withAuthContext } from './db.js'
import { sql } from 'kysely'
import type { FormResult, Session, User, UserEmail } from '#app/types.js'
import { randomNumber } from '#lib/index.js'
import { setTimeout } from 'node:timers/promises'
import { env } from './assertEnv.js'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { GitHub, OAuth2RequestError, generateState } from 'arctic'
import { parseCookies, serializeCookie } from 'oslo/cookie'
import log from './log.js'
import { createMiddleware } from 'hono/factory'
import * as schemas from '#app/schemas.js'

const rootUrl = env.VITE_ROOT_URL

const MILLISECONDS = 1000
const DAY = 86400
const cookieMaxAge = 7 * DAY

class PgStore implements Store {
  async getSessionById(sessionId: string) {
    const session = await rootDb
      .selectFrom('app_private.cookie_sessions')
      .select(eb => [
        eb.ref('id').as('_id'),
        eb.ref('data').as('_data'),
        eb.ref('expire').as('_expire'),
      ])
      .where('id', '=', sessionId)
      .executeTakeFirst()
    return session ?? null
  }

  async upsert(sessionId: string, data: SessionData) {
    if (!data._expire) return
    log.debug('upserting session %s: %O', sessionId, data)
    await rootDb
      .insertInto('app_private.cookie_sessions')
      .values({
        id: sessionId,
        data: JSON.stringify(data._data),
        expire: eb => eb.fn('to_timestamp', [eb.val(data._expire)]),
      })
      .onConflict(oc =>
        oc.column('id').doUpdateSet({
          data: JSON.stringify(data._data),
          expire: eb => eb.fn('to_timestamp', [eb.val(data._expire)]),
        }),
      )
      .execute()
  }

  createSession(sessionId: string, data: SessionData) {
    void this.upsert(sessionId, data)
  }

  persistSessionData(sessionId: string, data: SessionData) {
    void this.upsert(sessionId, data)
  }

  async deleteSession(sessionId: string) {
    await rootDb.deleteFrom('app_private.cookie_sessions').where('id', '=', sessionId).execute()
  }
}

function validatorCb<I, O>(result: z.SafeParseReturnType<I, O>, c: hono.Context) {
  if (!result.success) return c.json(result.error.flatten(), 400)
}

type Variables = {
  session: HonoSession<Session>
  session_key_rotation: boolean
}

const ensureLoggedIn = createMiddleware<{ Variables: Variables }>(async (ctx, next) => {
  const userId = ctx.get('session').get('user_id')
  if (!userId)
    return ctx.json({ formErrors: ['you must be logged in to do that!'] } satisfies FormResult, 401)
  await next()
})

const app = new Hono<{ Variables: Variables }>()
  .use(logger())
  .use(
    session({
      expireAfterSeconds: cookieMaxAge,
      cookieOptions: {
        sameSite: 'Lax',
        path: '/',
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
      },
      store: new PgStore(),
      encryptionKey: env.SECRET,
    }),
  )

  .get('/posts', async ctx => {
    return await withAuthContext(ctx, async tx => {
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
      return ctx.json(posts)
    })
  })

  .post('/posts', zValidator('form', schemas.createPost, validatorCb), async ctx => {
    const body = ctx.req.valid('form')
    return withAuthContext(ctx, async tx => {
      try {
        const post = await tx
          .insertInto('app_public.posts')
          .values(body)
          .returningAll()
          .executeTakeFirstOrThrow()
        return ctx.json({ payload: post } satisfies FormResult)
      } catch (err) {
        log.error('%O', err)
        return ctx.json(
          { formErrors: ['there was an error processing your request'] } satisfies FormResult,
          500,
        )
      }
    })
  })

  .post('/register', zValidator('form', schemas.register, validatorCb), async ctx => {
    const { username, password, email } = ctx.req.valid('form')
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
      const s = ctx.get('session')
      s.set('user_id', user.id)
      s.set('uuid', session.uuid)
      log.info('new user:', user.username)
      return ctx.json({ payload: user } satisfies FormResult)
    } catch (err: any) {
      if (err.code === '23505') {
        return ctx.json(
          {
            fieldErrors: { username: ['username already exists'] },
          } satisfies FormResult,
          401,
        )
      }
      log.error('%O', err)
      return ctx.json(
        {
          formErrors: ['there was an error processing your request'],
        } satisfies FormResult,
        500,
      )
    }
  })

  .post('/login', zValidator('form', schemas.login, validatorCb), async ctx => {
    const { id, password } = ctx.req.valid('form')
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
        return ctx.json(
          {
            formErrors: ['invalid username or password'],
          } satisfies FormResult,
          401,
        )
      }
      const s = ctx.get('session')
      s.set('user_id', session.id)
      s.set('uuid', session.uuid)
      return withAuthContext(ctx, async tx => {
        const user = await tx
          .selectFrom('app_public.users')
          .where('id', '=', eb => eb.fn('app_public.current_user_id', []))
          .selectAll()
          .executeTakeFirst()
        return ctx.json({ payload: user ?? null } satisfies FormResult)
      })
    } catch (err) {
      log.error('%O', err)
      return ctx.json(
        {
          formErrors: ['there was an error processing your request'],
        } satisfies FormResult,
        500,
      )
    }
  })

  .get('/settings', ensureLoggedIn, ctx => {
    return withAuthContext(ctx, async tx => {
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
              coalesce(json_agg(e.* order by created_at), '[]') as emails
            from
              app_public.user_emails e
            where
              user_id = u.id
          ) _e
        where
          u.id = app_public.current_user_id()
      `.execute(tx)
      return ctx.json({ payload: settings } satisfies FormResult)
    })
  })

  .delete(
    '/settings/email',
    ensureLoggedIn,
    zValidator('form', schemas.deleteEmail, validatorCb),
    async ctx => {
      if (!ctx.get('session').get('user_id'))
        return ctx.json(
          { formErrors: ['you must be logged in to do that!'] } satisfies FormResult,
          401,
        )
      const body = ctx.req.valid('form')
      return withAuthContext(ctx, async tx => {
        try {
          const result = await tx
            .deleteFrom('app_public.user_emails')
            .where('id', '=', body.emailId)
            .returningAll()
            .execute()
          return ctx.json({ payload: result } satisfies FormResult)
        } catch (err) {
          log.error('%O', err)
          return ctx.json(
            {
              formErrors: ['there was an error processing your request'],
            } satisfies FormResult,
            500,
          )
        }
      })
    },
  )

  .post(
    '/settings/email',
    ensureLoggedIn,
    zValidator('form', schemas.addEmail, validatorCb),
    ctx => {
      const body = ctx.req.valid('form')
      return withAuthContext(ctx, async tx => {
        try {
          const result = await tx
            .insertInto('app_public.user_emails')
            .values({ email: body.email })
            .returningAll()
            .execute()
          return ctx.json({ payload: result } satisfies FormResult)
        } catch (err) {
          if (err.code == 'EMTKN') {
            return ctx.json(
              {
                formErrors: [err.message],
              } satisfies FormResult,
              400,
            )
          }
          log.error('%O', err)
          return ctx.json(
            {
              formErrors: ['there was an error processing your request'],
            } satisfies FormResult,
            500,
          )
        }
      })
    },
  )

  .post(
    '/me',
    ensureLoggedIn,
    zValidator('form', schemas.updateProfile, validatorCb),
    async ctx => {
      const userId = ctx.get('session').get('user_id')
      const { username, name, bio, avatar_url } = ctx.req.valid('form')
      return withAuthContext(ctx, async tx => {
        try {
          const user = await tx
            .updateTable('app_public.users')
            .set({ username, name, bio, avatar_url })
            .where('id', '=', userId)
            .returningAll()
            .executeTakeFirstOrThrow()
          return ctx.json({
            formMessages: ['profile updated'],
            payload: user,
          } satisfies FormResult)
        } catch (err: any) {
          if (err.code === '23505') {
            return ctx.json(
              {
                fieldErrors: { username: ['username already exists'] },
              } satisfies FormResult,
              403,
            )
          }
          log.error('%O', err)
          return ctx.json(
            {
              formErrors: ['there was an error processing your request'],
            } satisfies FormResult,
            500,
          )
        }
      })
    },
  )

  .post('/change-password', zValidator('form', schemas.changePassword, validatorCb), async ctx => {
    if (!ctx.get('session').get('user_id'))
      return ctx.json(
        { formErrors: ['you must be logged in to do that!'] } satisfies FormResult,
        401,
      )
    const body = ctx.req.valid('form')
    return withAuthContext(ctx, async tx => {
      try {
        await tx
          .selectFrom(
            sql`app_public.change_password(${body.oldPassword}, ${body.password})`.as(
              'change_password',
            ),
          )
          .selectAll(['change_password'])
          .execute()
        return ctx.json({ formMessages: ['password updated'] } satisfies FormResult)
      } catch (err: any) {
        if (err.code === 'CREDS')
          return ctx.json(
            {
              formErrors: ['your previous password was incorrect'],
            } satisfies FormResult,
            400,
          )
        log.error('%O', err)
        return ctx.json(
          {
            formErrors: ['there was an error processing your request'],
          } satisfies FormResult,
          500,
        )
      }
    })
  })

  .get('/me', ctx => {
    return withAuthContext(ctx, async tx => {
      const user = await tx
        .selectFrom('app_public.users')
        .where('id', '=', eb => eb.fn('app_public.current_user_id', []))
        .selectAll()
        .executeTakeFirst()
      return ctx.json({ payload: user ?? null } satisfies FormResult)
    })
  })

  .delete('/me', ensureLoggedIn, zValidator('form', schemas.deleteUser, validatorCb), ctx => {
    const body = ctx.req.valid('form')
    return withAuthContext(ctx, async tx => {
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
          ctx.get('session').deleteSession()
          return ctx.json({ payload: result } satisfies FormResult)
        } else {
          const result = await tx
            .selectFrom(
              sql<{
                request_account_deletion: unknown | null
              }>`app_public.request_account_deletion()`.as('request_account_deletion'),
            )
            .selectAll()
            .executeTakeFirst()
          return ctx.json(result)
        }
      } catch (err) {
        log.error(err)
        return ctx.json({ formErrors: ['Account deletion failed'] } satisfies FormResult, 500)
      }
    })
  })

  .post('/forgot-password', zValidator('form', schemas.forgotPassword, validatorCb), async ctx => {
    const body = ctx.req.valid('form')
    await rootDb
      .selectFrom(sql`app_public.forgot_password(${body.email})`.as('forgot_password'))
      .selectAll()
      .execute()
    return ctx.json({ formMessages: ['Password reset email sent'] } satisfies FormResult)
  })

  .post('/reset-password', zValidator('form', schemas.resetPassword, validatorCb), async ctx => {
    const body = ctx.req.valid('form')
    try {
      const session = await rootDb
        .selectFrom(eb =>
          rootDb
            .fn<Session>('app_private.reset_password', [
              eb.val(body.userId),
              eb.val(body.token),
              eb.val(body.password),
            ])
            .as('reset_password'),
        )
        .selectAll()
        .where(eb => eb.not(eb('reset_password.uuid', 'is', null)))
        .executeTakeFirst()
      if (!session)
        return ctx.json({ fieldErrors: { token: ['invalid token'] } } satisfies FormResult)
      ctx.get('session').deleteSession()
      const user = await rootDb
        .selectFrom('app_public.users')
        .where('id', '=', session.user_id)
        .selectAll()
        .executeTakeFirstOrThrow()
      return ctx.json({ payload: { user } } satisfies FormResult)
    } catch (err) {
      log.error('%O', err)
      return ctx.json({ formErrors: ['Failed to reset password'] } satisfies FormResult, 500)
    }
  })

  .post('/verify-email', zValidator('form', schemas.verifyEmail, validatorCb), ctx => {
    const body = ctx.req.valid('form')
    return withAuthContext(ctx, async tx => {
      try {
        const result = await tx
          .selectFrom(eb =>
            tx
              .fn<{
                verify_email: boolean | null
              }>('app_public.verify_email', [eb.val(body.id), eb.val(body.token)])
              .as('verify_email'),
          )
          .selectAll()
          .executeTakeFirstOrThrow()
        return ctx.json({ payload: result } satisfies FormResult)
      } catch (e) {
        return ctx.json({
          formErrors: ['failed to verify email'],
        } satisfies FormResult)
      }
    })
  })

  .post('/make-email-primary', zValidator('form', schemas.makeEmailPrimary, validatorCb), ctx => {
    if (!ctx.get('session').get('user_id'))
      return ctx.json({ payload: null } satisfies FormResult, 401)
    const body = ctx.req.valid('form')
    return withAuthContext(ctx, async tx => {
      const result = await tx
        .selectFrom(eb =>
          tx.fn<UserEmail>('app_public.make_email_primary', [eb.val(body.emailId)]).as('u'),
        )
        .selectAll()
        .where(eb => eb.not(eb('id', 'is', null)))
        .executeTakeFirstOrThrow()
      return ctx.json({ payload: result } satisfies FormResult)
    })
  })

  .post(
    '/resend-email-verification-code',
    zValidator('form', schemas.resendEmailVerification, validatorCb),
    ctx => {
      if (!ctx.get('session').get('user_id'))
        return ctx.json({ payload: null } satisfies FormResult, 401)
      const body = ctx.req.valid('form')
      return withAuthContext(ctx, async tx => {
        const result = await tx
          .selectFrom(eb =>
            tx
              .fn<{
                verify_email: boolean | null
              }>('app_public.verify_email', [eb.val(body.data.emailId), eb.val(body.data.token)])
              .as('verify_email'),
          )
          .selectAll()
          .executeTakeFirst()
        return ctx.json({ payload: result } satisfies FormResult)
      })
    },
  )

  .post('/unlink-auth', zValidator('form', schemas.unlinkAuth, validatorCb), ctx => {
    if (!ctx.get('session').get('user_id'))
      return ctx.json({ payload: null } satisfies FormResult, 401)
    const body = ctx.req.valid('form')
    return withAuthContext(ctx, async tx => {
      const { numDeletedRows } = await tx
        .deleteFrom('app_public.user_authentications')
        .where('id', '=', body.id)
        .executeTakeFirst()
      if (numDeletedRows < 1)
        return ctx.json({ formErrors: ['failed to unlink account'] } satisfies FormResult, 400)
      return ctx.json({ payload: { success: true } } satisfies FormResult)
    })
  })

  .post('/logout', ctx => {
    // clear the user from the session object and save.
    // this will ensure that re-using the old session id does not have a logged in user
    ctx.get('session').deleteSession()
    return ctx.json(null)
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

  app.get('/auth/:provider', ctx => {
    const params = providerSpec.safeParse(ctx.req.param('provider'))
    if (!params.success) return ctx.json(params.error.flatten() satisfies FormResult, 400)
    const provider = oauthProviders[params.data]
    const state = generateState()
    const url = provider.createAuthorizationURL(state, ['user:email'])
    ctx.header(
      'Set-Cookie',
      serializeCookie('github_oauth_state', state, {
        path: '/',
        secure: env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 60 * 10,
        sameSite: 'lax',
      }),
    )
    return ctx.redirect(url.toString())
  })

  app.get('/auth/:provider/callback', async ctx => {
    const params = providerSpec.safeParse(ctx.req.param('provider'))
    if (!params.success) return ctx.json(params.error.flatten() satisfies FormResult, 400)
    const query = ctx.req.query()
    const code = query.code ?? null
    const state = query.state ?? null
    const storedState = parseCookies(ctx.header('cookie') ?? '').get('github_oauth_state') ?? null
    if (!code || !state || !storedState || state !== storedState) return ctx.text('', 400)
    const redir = query.redirectTo?.startsWith('/') ? decodeURIComponent(query.redirectTo) : '/'
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
                  sql`f_user_id => ${ctx.get('session').get('user_id') ?? null}`,
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
      const s = ctx.get('session')
      if (!s.get('uuid')) {
        s.set('user_id', session.user_id)
        s.set('uuid', session.uuid)
      }
      return ctx.json({ payload: { user_id: session.user_id } } satisfies FormResult)
    } catch (err) {
      if (err instanceof OAuth2RequestError && err.message === 'bad_verification_code') {
        return ctx.text('', 400)
      }
      log.error('%O', err)
      return ctx.text('', 500)
    }
  })
}

export type app = typeof app

if (process.env.NODE_ENV !== 'production') {
  import('./cypress.js').then(m => m.installCypressCommands(app))
}

serve(app, info => log.info(`server listening at http://localhost:${info.port}`))
