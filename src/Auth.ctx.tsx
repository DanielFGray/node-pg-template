import { createContext, useContext, useEffect, useState } from 'react'
import { api } from './api.js'

type User = null | { user_id: string; username: string }
type AuthContext = {
  user: User
  setUser: (user: User) => void
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
    api('/currentUser').then(({ data }) => setUser(data))
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
