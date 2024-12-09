import { describe, it, expect, afterAll } from 'vitest'
import pg from 'pg'
import { randomBytes } from 'node:crypto'
import './assertEnv'
import { api } from '#app/api.js'
import type { FormResult } from '#app/types.js'

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
    const req = await api.register.$post({ form: user })
    const res = await req.json()
    expect(req.ok).toBe(true)
    if (!req.ok) return
    expect(res.payload.id).toBeTypeOf('string')
    expect(res.payload.username).toBe(user.username)
    userId = res.payload.id as string
    Cookie = req.headers.get('set-cookie')
  })

  it('can not register with an existing username', async () => {
    const req = await api.register.$post({
      form: user
    })
    expect(req.ok).toBe(false)
    expect(await req.json()).toEqual({ fieldErrors: { username: ['username already exists'] } })
  })

  it('can not login with wrong password', async () => {
    const req = await api.login.$post({
      form: { id: user.username, password: 'wrong123' }
    })
    const res = await req.json()
    expect(res).toEqual({ formErrors: ['invalid username or password'] })
  })

  it('can request /me from cookie', async () => {
    const req = await api.me.$get({
      headers: { Cookie, Accept: 'application/json' },
    })
    const res = await req.json()
    expect(res.payload).toBeDefined()
    expect(res.payload?.id).toEqual(userId)
    expect(res.payload?.username).toEqual(user.username)
  })
})

afterAll(async () => {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
  await pool.query('delete from app_public.users where username = $1', [user.username])
  void pool.end()
})
