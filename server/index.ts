import express from 'express'
import morgan from 'morgan'
import session from 'express-session'
import ConnectPgSimple from 'connect-pg-simple'
import pg from 'pg'
import argon from 'argon2'
import * as db from 'zapatos/db'

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

app.post('/register', (req, res) => {
  if (req.session.user) return res.redirect('/')
  const { username, password, confirmPassword } = req.body
  if (!username) return res.status(400).json({ fieldError: { username: 'missing username' } })
  if (!password) return res.status(400).json({ fieldError: { password: 'missing password' } })
  if (password !== confirmPassword)
    return res.status(400).json({ fieldError: { confirmPassword: 'passwords dont match' } })
  req.session.regenerate(async () => {
    try {
      const password_hash = await argon.hash(password, argonOpts)
      const user = await db
        .insert('users', { username, password_hash }, { returning: ['user_id'] })
        .run(pool)
      req.session.user = { user_id: user.user_id, username }
      res.json(req.session.user)
    } catch (e) {
      res.status(403).send({ fieldError: { username: 'username already exists' } })
    }
  })
})

app.post('/login', (req, res) => {
  if (req.session.user) return res.redirect('/')
  const { username, password } = req.body
  if (!username) return res.status(400).json({ fieldError: { username: 'missing username' } })
  if (!password) return res.status(400).json({ fieldError: { password: 'missing password' } })
  req.session.regenerate(async () => {
    try {
      const user = await db.selectExactlyOne('users', { username }).run(pool)
      const matches = await argon.verify(user.password_hash, password, argonOpts)
      if (!matches) throw new Error()

      req.session.user = { user_id: user.user_id, username: user.username }
      res.json(req.session.user)
    } catch (e) {
      res.status(403).json({ formError: 'invalid username or password' })
    }
  })
})

app.get('/currentUser', (req, res) => {
  if (!req.session.user) return res.status(403).json(null)
  res.json(req.session.user)
})

app.post('/settings', isAuthenticated, async (req, res) => {
  const { username } = req.body
  if (!username) return res.status(400).json({ fieldError: { username: 'username cannot be empty' } })
  try {
    const [user] = await db
      .update(
        'users',
        { username },
        { user_id: req.session.user!.user_id },
        { returning: ['user_id', 'username'] },
      )
      .run(pool)
    console.log('updated user:', user)
    req.session.user = user
    res.json(req.session.user)
  } catch(e) {
    res.status(500).json({ formError: 'there was an error processing your request' })
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
