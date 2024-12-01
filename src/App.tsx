import { Routes, Route, Link, useLocation, Navigate, Outlet } from 'react-router'
import { useAuth } from './Auth.ctx.js'
import Login from './login.js'
import Logout from './logout.js'
import Register from './register.js'
import Settings from './settings.js'

function Layout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  return (
    <>
      <nav>
        <ul className="flex-row gap-2">
          <li>
            <Link to="/">home</Link>
          </li>
          {user ? (
            <>
              <li>hi {user.username}!</li>
              <li>
                <Link to="/settings">settings</Link>
              </li>
              <li>
                <Link to="/logout">log out</Link>
              </li>
            </>
          ) : (
            <>
              <li>
                <Link to="/login">login</Link>
              </li>
              <li>
                <Link to="/register">register</Link>
              </li>
            </>
          )}
        </ul>
      </nav>
      {children}
    </>
  )
}

function Home() {
  const { user } = useAuth()
  return (
    <>
      <h1>Home</h1>
      <pre>{JSON.stringify({ user }, null, 2)}</pre>
    </>
  )
}

function NotFound() {
  const route = useLocation().pathname
  return (
    <>
      <h1>Not Found</h1>
      <p>{route} does not exist</p>
    </>
  )
}

function ProtectedRoute({
  isAllowed,
  redirectPath = '/landing',
  children,
}: {
  isAllowed?: boolean
  redirectPath: string
  children?: React.ReactElement
}): JSX.Element {
  if (!isAllowed) return <Navigate to={redirectPath} replace />
  return children ? children : <Outlet />
}

export default function App() {
  const { user } = useAuth()
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/settings"
          element={
            <ProtectedRoute isAllowed={Boolean(user)} redirectPath="/login?redirectTo=/settings">
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route path="/logout" element={<Logout />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  )
}
