import { useAuth } from './Auth.ctx.js'

export default function Home() {
  const { user } = useAuth()
  return (
    <>
      <h1>Home</h1>
      <pre>{JSON.stringify({ user }, null, 2)}</pre>
    </>
  )
}
