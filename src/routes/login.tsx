import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useAuth } from '#app/Auth.ctx.js'
import type { FormResult, User } from '#app/types.js'
import { api } from '#app/api.js'
import { Form, SocialLogin } from '#app/components.js'
import { login as validator } from '#app/schemas.js'

export default function Login() {
  const [response, setResponse] = useState<FormResult<User>>()
  const auth = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  if (auth.user) {
    navigate(params.get('redirectTo') || '/')
    return null
  }
  return (
    <>
      <Form
        prefix="login"
        response={response}
        onSubmit={async ev => {
          ev.preventDefault()
          const form = validator.safeParse(Object.fromEntries(new FormData(ev.currentTarget)))
          if (!form.success) return setResponse(form.error.flatten())
          const body = new URLSearchParams(form.data)
          const { data } = await api<FormResult<User>>('/login', { method: 'post', body })
          setResponse(data)
          if (data.payload?.id) {
            auth.setUser(data.payload)
            navigate(params.get('redirectTo') || '/')
          }
        }}
      >
        <fieldset>
          <legend>log in</legend>
          {params.get('redirectTo') && (
            <div className="field-error">you must be logged in to do that!</div>
          )}
          <Form.Row type="text" label="username or email" name="id" />
          <Form.Row type="password" name="password" />
          <div>
            {response?.formErrors?.map(e => (
              <div className="field-error" key={e}>
                {e}
              </div>
            ))}
            <button type="submit" data-cy="login-submit-button">
              login
            </button>
            {response?.formErrors && (
              <>
                {' '}
                <Link to="/forgot" data-cy="login-forgot-link">
                  I forgot my password
                </Link>
              </>
            )}
          </div>
        </fieldset>
      </Form>
      <div className="text-center">
        <div>
          <em>or</em>
        </div>
        <SocialLogin verb="join" />
        <div>
          <Link to={{ pathname: '/register', search: params.toString() }}>I need an account</Link>
        </div>
      </div>
    </>
  )
}
