import express from 'express'
import morgan from 'morgan'
import session from 'express-session'
import ConnectPgSimple from 'connect-pg-simple'
import pg from 'pg'
import argon from 'argon2'
import * as db from 'zapatos/db'
import _debug from 'debug'
import type { FormErrorResult } from '#app/types.js'
import { randomNumber } from '#lib/index.js'
import { setTimeout } from 'node:timers/promises'
import './assertEnv.js'
import { z } from 'zod'

declare module 'express-session' {
  interface SessionData {
    user?: { user_id: string; username: string }
  }
}

const MILLISECONDS = 1000
const DAY = 86400
const PORT = Number(process.env.PORT) || 3001
const secret = process.env.SECRET

if (!process.env.DATABASE_URL) throw new Error('Missing DATABASE_URL environment variable')
if (!secret) throw new Error('Missing SECRET environment variable')

const debug = _debug('app')
const queryDebug = debug.extend('db:query')
const resultDebug = debug.extend('db:result')
const txnDebug = debug.extend('db:transaction')
const strFromTxnId = (txnId: number | undefined) => (txnId === undefined ? '-' : String(txnId))

db.setConfig({
  queryListener: (query, txnId) =>
    queryDebug('(%s) %s\n%o', strFromTxnId(txnId), query.text, query.values),
  resultListener: (result, txnId, elapsedMs) =>
    resultDebug('(%s, %dms) %O', strFromTxnId(txnId), elapsedMs?.toFixed(1), result),
  transactionListener: (message, txnId) => txnDebug('(%s) %s', strFromTxnId(txnId), message),
})

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

const argonOpts = {
  type: argon.argon2id,
  hashLength: 40,
}

const PgStore = ConnectPgSimple(session)
const app = express()

app.use(morgan(process.env.NODE_ENV === 'production' ? 'common' : 'dev'))
app.use(express.urlencoded({ extended: false }))
app.use(
  session({
    rolling: true,
    saveUninitialized: false,
    resave: false,
    cookie: {
      maxAge: 7 * DAY * MILLISECONDS,
      httpOnly: true,
      sameSite: 'lax',
      secure: 'auto',
    },
    store: new PgStore({ pool, schemaName: 'hidden', tableName: 'sessions' }),
    secret,
  }),
)

const isAuthenticated: express.RequestHandler = (req, res, next) => {
  if (req.session.user) return next()
  res.status(403).end('you must be logged in to do that!')
}

const usernameSpec = z
  .string()
  // .refine(n => /^\w+$/, 'username may only contain numbers, letters, and underscores')
  // this is also enforced in the database but this gives nicer error messages
  .refine(n => n.length >= 3 && n.length <= 64, 'username must be between 3 and 64 characters')

const passwordSpec = z
  .string()
  // .refine(pw => /\W/.test(pw), 'password must contain a number or symbol')
  .refine(pw => pw.length >= 8, 'password must be at least 6 characters')

app.post('/register', (req, res) => {
  if (req.session.user) return res.redirect('/')
  const result = z
    .object({
      username: usernameSpec,
      password: passwordSpec,
      confirmPassword: z.string(),
    })
    .refine(data => data.password === data.confirmPassword, 'passwords must match')
    .safeParse(req.body)
  if (result.success === false) return res.status(400).json(result.error.flatten(i => i.message))
  const { username, password } = result.data
  req.session.regenerate(async () => {
    try {
      const password_hash = await argon.hash(password, argonOpts)
      const user = await db
        .insert('users', { username, password_hash }, { returning: ['user_id'] })
        .run(pool)
      req.session.user = { user_id: user.user_id, username }
      debug('new user:', username)
      res.json(req.session.user)
    } catch (err: any) {
      if (db.isDatabaseError(err, 'IntegrityConstraintViolation_UniqueViolation')) {
        return res.status(403).json({
          fieldErrors: { username: ['username already exists'] },
        } satisfies FormErrorResult)
      }
      console.error(err)
      res.status(500).json({
        formErrors: ['there was an error processing your request'],
      } satisfies FormErrorResult)
    }
  })
})

app.post('/login', (req, res) => {
  if (req.session.user) return res.redirect('/')
  const result = z
    .object({
      username: z.string(),
      password: z.string(),
    })
    .safeParse(req.body)
  if (result.success === false) return res.status(400).json(result.error.flatten())
  const { username, password } = result.data
  req.session.regenerate(async () => {
    try {
      const [user] = await db.select('users', { username }).run(pool)
      if (!user) {
        await setTimeout(randomNumber(100, 400))
        return res.status(403).json({
          formErrors: ['invalid username or password'],
        } satisfies FormErrorResult)
      }
      const matches = await argon.verify(user?.password_hash, password, argonOpts)
      if (!matches) {
        await setTimeout(randomNumber(100, 400))
        return res.status(403).json({
          formErrors: ['invalid username or password'],
        } satisfies FormErrorResult)
      }

      req.session.user = { user_id: user.user_id, username: user.username }
      res.json(req.session.user)
    } catch (e) {
      console.error(e)
      res.status(500).json({
        formErrors: ['there was an error processing your request'],
      } satisfies FormErrorResult)
    }
  })
})

app.get('/currentUser', (req, res) => {
  if (!req.session.user) return res.status(403).json(null)
  res.json(req.session.user)
})

app.post('/settings/profile', isAuthenticated, async (req, res) => {
  const result = z
    .object({
      username: usernameSpec,
      avatar: z.string(),
    })
    .partial()
    .safeParse(req.body)
  if (result.success === false) return res.status(400).json(result.error.flatten())
  const { username, avatar } = result.data
  try {
    const [user] = await db
      .update(
        'users',
        { username },
        { user_id: req.session.user!.user_id },
        { returning: ['user_id', 'username'] },
      )
      .run(pool)
    debug('updated user:', user)
    req.session.user = user
    res.json(req.session.user)
  } catch (err: any) {
    if (db.isDatabaseError(err, 'IntegrityConstraintViolation_UniqueViolation')) {
      return res.status(403).json({
        fieldErrors: { username: ['username already exists'] },
      } satisfies FormErrorResult)
    }
    console.error(err)
    res.status(500).json({
      formErrors: ['there was an error processing your request'],
    } satisfies FormErrorResult)
  }
})

app.post('/settings/password', isAuthenticated, async (req, res) => {
  const result = z
    .object({
      oldPassword: z.string(),
      newPassword: passwordSpec,
      confirmPassword: z.string(),
    })
    .refine(
      data => !data.newPassword || (data.newPassword && data.oldPassword),
      'old and new passwords are required',
    )
    .refine(data => data.newPassword === data.confirmPassword, 'passwords must match')
    .safeParse(req.body)
  if (result.success === false) return res.status(400).json(result.error.flatten())
  const { oldPassword, newPassword } = result.data
  try {
    const user = await db
      .selectExactlyOne('users', { user_id: req.session.user!.user_id })
      .run(pool)
    if ((await argon.verify(user.password_hash, oldPassword, argonOpts)) === false) {
      return res.status(403).json({
        formErrors: ['invalid old password'],
      } satisfies FormErrorResult)
    }
    await db
      .update(
        'users',
        { password_hash: await argon.hash(newPassword, argonOpts) },
        { user_id: req.session.user!.user_id },
      )
      .run(pool)
    debug('updated user:', req.session.user?.user_id)
    res.json({ formMessages: ['password updated'] } satisfies FormErrorResult)
  } catch (e) {
    console.error(e)
    res.status(500).json({
      formErrors: ['there was an error processing your request'],
    } satisfies FormErrorResult)
  }
})

app.post('/logout', (req, res, next) => {
  // clear the user from the session object and save.
  // this will ensure that re-using the old session id does not have a logged in user
  req.session.user = null
  req.session.save(function (err) {
    if (err) next(err)

    // regenerate the session, which is good practice to help
    // guard against forms of session fixation
    req.session.regenerate(function (err) {
      if (err) next(err)
      res.redirect('/')
    })
  })
})

app.listen(PORT, () => console.log(`server listening on port ${PORT}`))
