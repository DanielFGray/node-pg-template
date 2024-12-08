import { createContext, useContext, useEffect, useState } from 'react'
import { api } from './api.js'
import type { FormResult, User } from './types.js'
import { Spinner } from './stubs.js'

type AuthContext = {
  user: User | null
  setUser: (u: User | null) => void
}

const AuthCtx = createContext<AuthContext>(undefined)

export function useAuth() {
  const authCtx = useContext(AuthCtx)
  if (!authCtx) throw new Error('useAuth must be used within an AuthProvider')
  return authCtx
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<'loading' | User | null>('loading')

  useEffect(() => {
    api<FormResult<User>>('/me').then(res => {
      setUser(res.data?.payload ?? null)
    })
  }, [])

  return (
    <>
      {user === 'loading' ? (
        <Spinner/>
      ) : (
        <AuthCtx value={{ user, setUser }}>{children}</AuthCtx>
      )}
    </>
  )
}
