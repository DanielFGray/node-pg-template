import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './Auth.ctx'

export default function Register() {
  const [response, setResponse] = useState<any>()
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
          <input type="text" name="username" id="register-username-input" />
          {response?.fieldError?.username && (
            <div className="field-error">{response?.fieldError?.username}</div>
          )}
        </div>

        <div className="form-row">
          <label htmlFor="register-password-input">password:</label>
          <input type="password" name="password" id="register-password-input" />
          {response?.fieldError?.password && (
            <div className="field-error">{response?.fieldError?.password}</div>
          )}
        </div>

        <div className="form-row">
          <label htmlFor="register-confirmpassword-input">confirm password:</label>
          <input type="password" name="confirmPassword" id="register-confirmpassword-input" />
          {response?.fieldError?.confirmPassword && (
            <div className="field-error">{response?.fieldError?.confirmPassword}</div>
          )}
        </div>

        <div>
          {response?.formError && <div className="field-error">{response?.formError}</div>}
          <button type="submit">register</button>
        </div>
      </fieldset>
    </form>
  )
}
