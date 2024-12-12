import { useState } from 'react'
import { api } from './api.js'
import type { FormResult, User } from './types.js'
import { useNavigate, useSearchParams } from 'react-router'
import { useAuth } from './Auth.ctx.js'
import { resetPassword as validator } from './schemas.js'
import { FormErrors } from './components.js'

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
        onSubmit={async ev => {
          ev.preventDefault()
          const form = validator.safeParse(
            Object.fromEntries(new FormData(ev.currentTarget) as any),
          )
          if (!form.success) return setResponse(form.error.flatten())
          const body = new URLSearchParams(form.data)
          const res = await api<FormResult<{ user: User }>>('/reset-password', {
            method: 'post',
            body,
          })
          if (!res.ok) return setResponse(res.error)
          setResponse(res.data)
          if (res.data.payload) {
            auth.setUser(res.data.payload.user)
            navigate(params.get('redirectTo') || '/')
          }
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
            <label htmlFor="reset-confirm-password-input">confirm password:</label>
            <input
              type="password"
              name="confirmPassword"
              id="reset-confirm-password-input"
              autoComplete="new-password"
              aria-describedby="reset-confirm-password-help"
              aria-invalid={Boolean(response?.fieldErrors?.confirmPassword)}
              data-cy="reset-confirm-password-input"
            />
            {response?.fieldErrors?.confirmPassword?.map(e => (
              <div className="field-error" key={e} id="reset-confirm-password-help">
                {e}
              </div>
            ))}
          </div>

          <div>
            <FormErrors response={response} />
            <button type="submit" data-cy="reset-submit-button">
              reset password
            </button>
          </div>
        </fieldset>
      </form>
    </div>
  )
}
