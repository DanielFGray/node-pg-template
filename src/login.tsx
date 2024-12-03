import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useAuth } from './Auth.ctx.js'
import type { FormResult, User } from './types.js'
import { api } from './api.js'
import { SocialLogin } from './SocialLogin.js'

export default function Login() {
  const [response, setResponse] = useState<FormResult>()
  const auth = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  if (auth.user) {
    navigate(params.get('redirectTo') || '/')
    return null
  }
  return (
    <>
      <form
        method="POST"
        onSubmit={ev => {
          ev.preventDefault()
          const body = new URLSearchParams(new FormData(ev.currentTarget) as any)
          api<FormResult<User>>('/login', { method: 'post', body }).then(res => {
            if (!res.ok) return setResponse(res.error)
            if (res.data?.payload?.id) {
              auth.setUser(res.data.payload)
              navigate(params.get('redirectTo') || '/')
            }
          })
        }}
      >
        <fieldset>
          <legend>log in</legend>
          {params.get('redirectTo') && (
            <div className="field-error">you must be logged in to do that!</div>
          )}
          <div className="form-row">
            <label htmlFor="login-username-input">username:</label>
            <input
              type="text"
              name="id"
              id="login-username-input"
              aria-describedby="login-username-help"
              aria-invalid={Boolean(response?.fieldErrors?.username)}
            />
            {response?.fieldErrors?.username?.map(e => (
              <div className="field-error" key={e} id="login-username-help">
                {e}
              </div>
            ))}
          </div>

          <div className="form-row">
            <label htmlFor="login-password-input">password:</label>
            <input
              type="password"
              name="password"
              id="login-password-input"
              aria-describedby="login-password-help"
              aria-invalid={Boolean(response?.fieldErrors?.password)}
            />
            {response?.fieldErrors?.password?.map(e => (
              <div className="field-error" key={e} id="login-password-help">
                {e}
              </div>
            ))}
          </div>

          <div>
            {response?.formErrors?.map(e => (
              <div className="field-error" key={e}>
                {e}
              </div>
            ))}
            <button type="submit">login</button>
            {response?.formErrors && (
              <>
                {' '}
                <Link to="/forgot">I forgot my password</Link>
              </>
            )}
          </div>
        </fieldset>
      </form>

      <div className="text-center">
        <div>
          <em>or</em>
        </div>
        <SocialLogin verb="join" />
        <div>
          <Link
            to={{
              pathname: '/register',
              search: params.toString(),
            }}
          >
            I need an account
          </Link>
        </div>
      </div>
    </>
  )
}
