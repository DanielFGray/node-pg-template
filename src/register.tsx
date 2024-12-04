import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useAuth } from './Auth.ctx.js'
import type { FormResult, User } from './types.js'
import { api } from './api.js'
import { SocialLogin } from './SocialLogin.js'

export default function Register() {
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
          api<FormResult<User>>('/register', { method: 'post', body }).then(res => {
            if (!res.ok) return setResponse(res.error)
            if (res.data?.payload?.id) {
              navigate(params.get('redirectTo') || '/')
              auth.setUser(res.data.payload)
            }
          })
        }}
      >
        <fieldset>
          <legend>register</legend>

          <div className="form-row">
            <label htmlFor="register-email-input" data-cy="register-email-label">
              email:
            </label>
            <input
              type="text"
              name="email"
              id="register-email-input"
              autoComplete="email"
              aria-describedby="register-email-help"
              aria-invalid={Boolean(response?.fieldErrors?.email)}
              data-cy="register-email-input"
            />
            {response?.fieldErrors?.email?.map(e => (
              <div className="field-error" key={e} id="register-email-help">
                {e}
              </div>
            ))}
          </div>

          <div className="form-row">
            <label htmlFor="register-username-input" data-cy="register-username-label">
              username:
            </label>
            <input
              type="text"
              name="username"
              id="register-username-input"
              autoComplete="username"
              aria-describedby="register-username-help"
              aria-invalid={Boolean(response?.fieldErrors?.username)}
              data-cy="register-username-input"
            />
            {response?.fieldErrors?.username?.map(e => (
              <div className="field-error" key={e} id="register-username-help">
                {e}
              </div>
            ))}
          </div>

          <div className="form-row">
            <label htmlFor="register-password-input" data-cy="register-password-label">
              password:
            </label>
            <input
              type="password"
              name="password"
              id="register-password-input"
              autoComplete="new-password"
              aria-describedby="register-password-help"
              aria-invalid={Boolean(response?.fieldErrors?.password)}
              data-cy="register-password-input"
            />
            {response?.fieldErrors?.password?.map(e => (
              <div className="field-error" key={e} id="register-password-help">
                {e}
              </div>
            ))}
          </div>

          <div className="form-row">
            <label
              htmlFor="register-confirmpassword-input"
              data-cy="register-confirmpassword-label"
            >
              confirm password:
            </label>
            <input
              type="password"
              name="confirmPassword"
              id="register-confirmpassword-input"
              autoComplete="new-password"
              aria-describedby="register-confirmpassword-help"
              aria-invalid={Boolean(response?.fieldErrors?.confirmPassword)}
              data-cy="register-confirmpassword-input"
            />
            {response?.fieldErrors?.confirmPassword?.map(e => (
              <div className="field-error" key={e} id="register-confirmpassword-help">
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
            <button type="submit" data-cy="register-submit-button">
              register
            </button>
          </div>
        </fieldset>
      </form>

      <div className="text-center">
        <div>
          <em>or</em>
        </div>
        <SocialLogin verb="register" />
        <Link
          to={{
            pathname: '/login',
            search: params.toString(),
          }}
        >
          log in with existing account
        </Link>
      </div>
    </>
  )
}
