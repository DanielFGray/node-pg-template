import type { app } from '#server/index.js'
import { hc } from 'hono/client'

if (!import.meta.env.VITE_ROOT_URL) {
  throw new Error('VITE_ROOT_URL is required')
}

export const api = hc<app>(import.meta.env.VITE_ROOT_URL)
