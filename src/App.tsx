import { Routes, Route, useLocation, Navigate, Outlet, NavLink } from 'react-router'
import { useAuth } from './Auth.ctx.js'
import Login from './login.js'
import Logout from './logout.js'
import Register from './register.js'
import Settings from './settings.js'
import Verify from './verify.js'
import Forgot from './forgot.js'
import Home from './home.js'

function Layout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  return (
    <>
      <nav data-cy="nav">
        <ul className="flex-row gap-2">
          <li>
            <NavLink to="/" data-cy="nav-home">home</NavLink>
          </li>
          {user ? (
            <>
              <li>hi {user.username}!</li>
              <li>
                <NavLink to="/settings" data-cy="nav-settings">settings</NavLink>
              </li>
              <li>
                <NavLink to="/logout" data-cy="nav-logout">log out</NavLink>
              </li>
            </>
          ) : (
            <>
              <li>
                <NavLink to="/login" data-cy="nav-login">login</NavLink>
              </li>
              <li>
                <NavLink to="/register" data-cy="nav-register">register</NavLink>
              </li>
            </>
          )}
        </ul>
      </nav>
      {children}
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
        <Route path="/verify" element={<Verify />} />
        <Route path="/forgot" element={<Forgot />} />
        <Route path="/logout" element={<Logout />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  )
}
