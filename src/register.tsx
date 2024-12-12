import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useAuth } from './Auth.ctx.js'
import type { FormResult, User } from './types.js'
import { api } from './api.js'
import { SocialLogin } from './SocialLogin.js'
import { register as validator } from './schemas.js'

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
        onSubmit={async ev => {
          ev.preventDefault()
          const form = validator.safeParse(
            Object.fromEntries(new FormData(ev.currentTarget) as any),
          )
          if (!form.success) return setResponse(form.error.flatten())
          const body = new URLSearchParams(form.data)
          const res = await api<FormResult<User>>('/register', { method: 'post', body })
          setResponse(res)
          if (res.data?.payload) {
            navigate(params.get('redirectTo') || '/')
            auth.setUser(res.data.payload)
          }
        }}
      >
        <fieldset>
          <legend>register</legend>

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
              htmlFor="register-confirm-password-input"
              data-cy="register-confirm-password-label"
            >
              confirm password:
            </label>
            <input
              type="password"
              name="confirmPassword"
              id="register-confirm-password-input"
              autoComplete="new-password"
              aria-describedby="register-confirm-password-help"
              aria-invalid={Boolean(response?.fieldErrors?.confirmPassword)}
              data-cy="register-confirm-password-input"
            />
            {response?.fieldErrors?.confirmPassword?.map(e => (
              <div className="field-error" key={e} id="register-confirm-password-help">
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
        <Link to={{ pathname: '/login', search: params.toString() }}>
          log in with existing account
        </Link>
      </div>
    </>
  )
}
