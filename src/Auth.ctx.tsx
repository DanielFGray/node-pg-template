import { createContext, useContext, useEffect, useState } from 'react'

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
    fetch('/api/currentUser')
      .then(res => res.json())
      .then(user => setUser(user))
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
