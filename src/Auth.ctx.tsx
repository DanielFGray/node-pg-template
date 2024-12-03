import { createContext, useContext, useEffect, useState } from 'react'
import { api } from './api.js'
import type { FormResult, User } from './types.js'

type AuthContext = {
  user: User | null
  setUser: (u: User | null) => void
}

const ctx = createContext<AuthContext>(undefined)

export function useAuth() {
  const authCtx = useContext(ctx)
  if (!authCtx) throw new Error('useAuth must be used within an AuthProvider')
  return authCtx
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<'loading' | User>('loading')

  useEffect(() => {
    api<FormResult<User>>('/me').then(res => {
      setUser(res.data.payload)
    })
  }, [])

  return (
    <>
      {user === 'loading' ? (
        'loading...'
      ) : (
        <ctx.Provider value={{ user, setUser }}>{children}</ctx.Provider>
      )}
    </>
  )
}
