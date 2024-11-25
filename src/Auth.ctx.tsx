import { createContext, useContext, useEffect, useState } from 'react'

type User = null | { user_id: string; username: string }

const ctx = createContext<{
  user: User,
  setUser: (user: User) => void,
  /* @ts-expect-error value starts as undefined */
    }>(undefined)

export function useAuth() {
  return useContext(ctx)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  /* @ts-expect-error value starts as undefined but is replaced with actual values */
  const [user, setUser] = useState<User>(undefined)

  useEffect(() => {
    fetch('/api/currentUser')
      .then(res => res.json())
      .then(user => setUser(user))
  }, [])

  return (
    <ctx.Provider value={{ user, setUser }}>
      {user === undefined ? 'loading...' : children}
    </ctx.Provider>
  )
}
