import type * as hono from 'hono'
import { rootPool } from './db.js'
import log from './log.js'

export function installCypressCommands(app: hono.Hono) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('cypress helpers must not run in production mode')
  }

  /*
   * This function is invoked for the /cypressServerCommand route and is
   * responsible for parsing the request and handing it off to the relevant
   * function.
   */
  app.get('/cypressServerCommand', async (ctx) => {
    try {
      // Try to read and parse the commands from the request.
      const query = ctx.req.query()
      if (!query) {
        throw new Error('Query not specified')
      }

      const { command: rawCommand, payload: rawPayload } = query
      if (!rawCommand) {
        throw new Error('Command not specified')
      }

      const command = String(rawCommand)
      const payload = rawPayload ? JSON.parse(String(rawPayload)) : {}

      // Now run the actual command:
      const result = await runCommand(ctx, command, payload)

      if (result === null) {
        /*
         * When a command returns null, we assume they've handled sending the
         * response. This allows commands to do things like redirect to new
         * pages when they're done.
         */
        throw new Error('Command handled response')
      } else {
        /*
         * The command returned a result, send it back to the test suite.
         */
        return result
      }
    } catch (e: any) {
      /*
       * If anything goes wrong, let the test runner know so that it can fail
       * the test.
       */
      log.error('cypressServerCommand failed! %O', e)
      return ctx.json({
        error: {
          message: e.message,
          stack: e.stack,
        },
      }, 500)
    }
  })
}

async function runCommand(
  ctx: hono.Context,
  command: string,
  payload: { [key: string]: any },
): Promise<object | null> {
  log.debug('running cypress command: %s', command)
  if (command === 'clearTestUsers') {
    await rootPool.query("delete from app_public.users where username like 'testuser%'")
    return ctx.json({ success: true })
  } else if (command === 'clearTestOrganizations') {
    await rootPool.query("delete from app_public.organizations where slug like 'test%'")
    return ctx.json({ success: true })
  } else if (command === 'createUser') {
    if (!payload) {
      throw new Error('Payload required')
    }
    const {
      username = 'testuser',
      email = `${username}@example.com`,
      verified = false,
      name = username,
      avatarUrl = null,
      password = 'TestUserPassword',
    } = payload
    if (!username.startsWith('testuser')) {
      throw new Error("Test user usernames may only start with 'testuser'")
    }
    const user = await reallyCreateUser({
      username,
      email,
      verified,
      name,
      avatarUrl,
      password,
    })

    let verificationToken: string | null = null
    const userEmailSecrets = await getUserEmailSecrets(email)
    const userEmailId: string = userEmailSecrets.user_email_id
    if (!verified) {
      verificationToken = userEmailSecrets.verification_token
    }

    return ctx.json({ user, userEmailId, verificationToken })
  } else if (command === 'login') {
    const {
      username = 'testuser',
      email = `${username}@example.com`,
      verified = false,
      name = username,
      avatarUrl = null,
      password = 'TestUserPassword',
      redirectTo = '/',
      orgs = [],
    } = payload
    const user = await reallyCreateUser({
      username,
      email,
      verified,
      name,
      avatarUrl,
      password,
    })
    const otherUser = await reallyCreateUser({
      username: 'testuser_other',
      email: 'testuser_other@example.com',
      name: 'testuser_other',
      verified: true,
      password: 'DOESNT MATTER',
    })
    const session = await createSession(user.id)
    const otherSession = await createSession(otherUser.id)

    const client = await rootPool.connect()
    try {
      await client.query('begin')
      // eslint-disable-next-line no-inner-declarations
      async function setSession(sess: any) {
        await client.query("select set_config('jwt.claims.session_id', $1, true)", [sess.uuid])
      }
      try {
        await setSession(session)
        await Promise.all(
          orgs.map(async ([name, slug, owner = true]: [string, string, boolean?]) => {
            if (!owner) {
              await setSession(otherSession)
            }
            const {
              rows: [organization],
            } = await client.query('select * from app_public.create_organization($1, $2)', [
              slug,
              name,
            ])
            if (!owner) {
              await client.query(
                'select app_public.invite_to_organization($1::uuid, $2::citext, null::citext)',
                [organization.id, user.username],
              )
              await setSession(session)
              await client.query(
                `select app_public.accept_invitation_to_organization(organization_invitations.id)
                   from app_public.organization_invitations
                   where user_id = $1`,
                [user.id],
              )
            }
          }),
        )
      } finally {
        await client.query('commit')
      }
    } finally {
      client.release()
    }

    const s = ctx.get('session')
    s.set('user_id', user.id)
    s.set('uuid', session.uuid)
    return ctx.redirect(redirectTo || '/')
  } else if (command === 'getUserSecrets') {
    const { username = 'testuser' } = payload
    const userSecrets = await getUserSecrets(username)
    return ctx.json(userSecrets)
  } else if (command === 'getEmailSecrets') {
    const { email = 'testuser@example.com' } = payload
    const userEmailSecrets = await getUserEmailSecrets(email)
    return ctx.json(userEmailSecrets)
  } else if (command === 'verifyUser') {
    const { username = 'testuser' } = payload
    await rootPool.query('update app_public.users SET is_verified = TRUE where username = $1', [
      username,
    ])
    return ctx.json({ success: true })
  } else {
    throw new Error(`Command '${command}' not understood.`)
  }
}

async function reallyCreateUser({
  username,
  email,
  verified,
  name,
  avatarUrl,
  password,
}: {
  username?: string
  email?: string
  verified?: boolean
  name?: string
  avatarUrl?: string
  password?: string
}) {
  const {
    rows: [user],
  } = await rootPool.query(
    `SELECT * FROM app_private.really_create_user(
        username := $1,
        email := $2,
        email_is_verified := $3,
        name := $4,
        avatar_url := $5,
        password := $6
      )`,
    [username, email, verified, name, avatarUrl, password],
  )
  return user
}

async function createSession(userId: string) {
  const {
    rows: [session],
  } = await rootPool.query('insert into app_private.sessions (user_id) values ($1) returning *', [
    userId,
  ])
  return session
}

async function getUserSecrets(username: string) {
  const {
    rows: [userEmailSecrets],
  } = await rootPool.query(
    `
      select *
      from app_private.user_secrets
        join app_public.users on user_id = users.id
      where username = $1
    `,
    [username],
  )
  return userEmailSecrets
}

async function getUserEmailSecrets(email: string) {
  const {
    rows: [userEmailSecrets],
  } = await rootPool.query(
    `
      select *
      from app_private.user_email_secrets
      where user_email_id = (
        select id
        from app_public.user_emails
        where email = $1
        order by id desc
        limit 1
      )
    `,
    [email],
  )
  return userEmailSecrets
}
