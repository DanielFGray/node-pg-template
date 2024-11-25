import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useAuth } from './Auth.ctx'

export default function Login() {
  const [response, setResponse] = useState<any>()
  const auth = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  return (
    <form
      method="POST"
      onSubmit={ev => {
        ev.preventDefault()
        const body = new URLSearchParams(new FormData(ev.currentTarget) as any)
        fetch('/api/login', { method: 'post', body })
          .then(res => res.json())
          .then(res => {
            if (!res.user_id) return setResponse(res)
            auth.setUser(res)
            navigate(params.get('redirectTo') || '/')
          })
      }}
    >
      <fieldset>
        <legend>log in</legend>
        {params.get('redirectTo') && <div className="field-error">you must be logged in to do that!</div>}
        <div className="form-row">
          <label htmlFor="login-username-input">username:</label>
          <input type="text" name="username" id="login-username-input" />
          {response?.fieldError?.username && (
            <div className="field-error">{response?.fieldError?.username}</div>
          )}
        </div>

        <div className="form-row">
          <label htmlFor="login-password-input">password:</label>
          <input type="password" name="password" id="login-password-input" />
          {response?.fieldError?.password && (
            <div className="field-error">{response?.fieldError?.password}</div>
          )}
        </div>

        <div>
          {response?.formError && <div className="field-error">{response?.formError}</div>}
          <button type="submit">login</button>
        </div>
      </fieldset>
    </form>
  )
}
