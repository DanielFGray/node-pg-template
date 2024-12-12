import { useAuth } from './Auth.ctx.js'
import { UnverifiedAccountWarning } from './components.js'

export default function Home() {
  const { user } = useAuth()
  return (
    <>
      <h1>Home</h1>
      {user && Boolean(user.is_verified) ? null : <UnverifiedAccountWarning />}
      <pre>{JSON.stringify({ user }, null, 2)}</pre>
    </>
  )
}
