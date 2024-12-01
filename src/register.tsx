import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from './Auth.ctx.js'
import type { FormErrorResult } from './types.js'

export default function Register() {
  const [response, setResponse] = useState<FormErrorResult>()
  const auth = useAuth()
  const navigate = useNavigate()
  return (
    <form
      method="POST"
      onSubmit={ev => {
        ev.preventDefault()
        const body = new URLSearchParams(new FormData(ev.currentTarget) as any)
        fetch('/api/register', { method: 'post', body })
          .then(res => res.json())
          .then(res => {
            if (!res.user_id) return setResponse(res)
            auth.setUser(res)
            navigate('/')
          })
      }}
    >
      <fieldset>
        <legend>register</legend>

        <div className="form-row">
          <label htmlFor="register-username-input">username:</label>
          <input
            type="text"
            name="username"
            id="register-username-input"
            autoComplete="username"
            aria-describedby="register-username-help"
            aria-invalid={Boolean(response?.fieldErrors?.username)}
          />
          {response?.fieldErrors?.username?.map(e => (
            <div className="field-error" key={e} id="register-username-help">
              {e}
            </div>
          ))}
        </div>

        <div className="form-row">
          <label htmlFor="register-password-input">password:</label>
          <input
            type="password"
            name="password"
            id="register-password-input"
            autoComplete="new-password"
            aria-describedby="register-password-help"
            aria-invalid={Boolean(response?.fieldErrors?.password)}
          />
          {response?.fieldErrors?.password?.map(e => (
            <div className="field-error" key={e} id="register-password-help">
              {e}
            </div>
          ))}
        </div>

        <div className="form-row">
          <label htmlFor="register-confirmpassword-input">confirm password:</label>
          <input
            type="password"
            name="confirmPassword"
            id="register-confirmpassword-input"
            autoComplete="new-password"
            aria-describedby="register-confirmpassword-help"
            aria-invalid={Boolean(response?.fieldErrors?.confirmPassword)}
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
          <button type="submit">register</button>
        </div>
      </fieldset>
    </form>
  )
}
