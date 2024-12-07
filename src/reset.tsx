import { useState } from 'react'
import { api } from './api.js'
import type { FormResult, User } from './types.js'
import { useNavigate, useSearchParams } from 'react-router'
import { useAuth } from './Auth.ctx.js'

export function ResetPass() {
  const navigate = useNavigate()
  const auth = useAuth()
  const [response, setResponse] = useState<FormResult>()
  const [params] = useSearchParams()
  const userId = params.get('userId')
  const token = params.get('token')

  return (
    <div>
      <form
        method="POST"
        onSubmit={ev => {
          ev.preventDefault()
          const body = new URLSearchParams(new FormData(ev.currentTarget) as any)
          api<FormResult<{ user: User }>>('/reset-password', { method: 'post', body }).then(res => {
            if (!res.ok) return setResponse(res.error)
            if (res.data.payload?.user) {
              auth.setUser(res.data.payload.user)
              navigate(params.get('redirectTo') || '/')
            }
          })
        }}
      >
        <fieldset>
          <legend>reset password</legend>
          {userId ? (
            <input name="userId" type="hidden" value={userId} />
          ) : (
            <div className="form-row">
              <label htmlFor="reset-userId-input">Enter your user id:</label>
              <input
                type="input"
                name="userId"
                id="reset-userId-input"
                aria-describedby="reset-userId-help"
                aria-invalid={Boolean(response?.fieldErrors?.password)}
              />
              {response?.fieldErrors?.password?.map(e => (
                <div className="field-error" key={e} id="reset-userId-help">
                  {e}
                </div>
              ))}
            </div>
          )}
          {token ? (
            <input name="token" type="hidden" value={token} />
          ) : (
            <div className="form-row">
              <label htmlFor="reset-token-input">Enter your reset token:</label>
              <input
                type="input"
                name="token"
                id="reset-token-input"
                aria-describedby="reset-token-help"
                aria-invalid={Boolean(response?.fieldErrors?.password)}
                data-cy="reset-token-input"
              />
              {response?.fieldErrors?.password?.map(e => (
                <div className="field-error" key={e} id="reset-token-help">
                  {e}
                </div>
              ))}
            </div>
          )}
          <div className="form-row">
            <label htmlFor="reset-password-input">new password:</label>
            <input
              type="password"
              name="password"
              id="reset-password-input"
              autoComplete="new-password"
              aria-describedby="reset-password-help"
              aria-invalid={Boolean(response?.fieldErrors?.password)}
              data-cy="reset-password-input"
            />
            {response?.fieldErrors?.password?.map(e => (
              <div className="field-error" key={e} id="reset-password-help">
                {e}
              </div>
            ))}
          </div>

          <div className="form-row">
            <label htmlFor="reset-confirmpassword-input">confirm password:</label>
            <input
              type="password"
              name="confirmPassword"
              id="reset-confirmpassword-input"
              autoComplete="new-password"
              aria-describedby="reset-confirmpassword-help"
              aria-invalid={Boolean(response?.fieldErrors?.confirmPassword)}
              data-cy="reset-confirmpassword-input"
            />
            {response?.fieldErrors?.confirmPassword?.map(e => (
              <div className="field-error" key={e} id="reset-confirmpassword-help">
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
            <button type="submit" data-cy="reset-submit-button">reset password</button>
          </div>
        </fieldset>
      </form>
    </div>
  )
}
