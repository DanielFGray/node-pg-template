import { describe, it, expect, afterAll } from 'vitest'
import pg from 'pg'
import { randomBytes } from 'node:crypto'
import './assertEnv'
import { api } from '#app/api.js'
import type { FormResult, User } from '#app/types.js'

const user = (() => {
  const password = randomBytes(8).toString('hex')
  return {
    username: `testuser_${randomBytes(4).toString('hex')}`,
    email: `testuser_${randomBytes(4).toString('hex')}@test.com`,
    password,
    confirmPassword: password,
  }
})()

describe('auth:user', () => {
  let userId: string
  let Cookie: string

  it('can register', async () => {
    const { headers, data } = await api<FormResult>('/register', {
      method: 'post',
      body: new URLSearchParams(user),
    })
    expect(data).toBeTypeOf('object')
    expect(data.payload).toHaveProperty('id')
    expect(data.payload).toHaveProperty('username', user.username)
    userId = data.payload?.id
    Cookie = headers.get('set-cookie')
  })

  it('can not register with an existing username', async () => {
    const { data } = await api<FormResult>('/register', {
      method: 'post',
      body: new URLSearchParams(user),
    })
    expect(data).toEqual({ fieldErrors: { username: ['username already exists'] } })
  })

  it('can login with correct password', async () => {
    const { data } = await api<FormResult<User>>('/login', {
      method: 'post',
      body: new URLSearchParams({ id: user.email, password: user.password }),
    })
    expect(data.payload).toHaveProperty('id', userId)
    expect(data.payload).toHaveProperty('username', user.username)
  })

  it('can not login with wrong password', async () => {
    const { data } = await api<FormResult>('/login', {
      method: 'post',
      body: new URLSearchParams({ id: user.username, password: 'wrong123' }),
    })
    expect(data).toEqual({ formErrors: ['invalid username or password'] })
  })

  it('can request /me from cookie', async () => {
    const { data } = await api<FormResult>('/me', {
      headers: { Cookie, Accept: 'application/json' },
    })
    expect(data).not.toBeNull()
    expect(data.payload).toHaveProperty('id', userId)
    expect(data.payload).toHaveProperty('username', user.username)
  })
})

afterAll(async () => {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
  await pool.query('delete from app_public.users where username = $1', [user.username])
  void pool.end()
})
