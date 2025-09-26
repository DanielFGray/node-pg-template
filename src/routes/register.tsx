import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useAuth } from '#app/Auth.ctx.js'
import type { FormResult, User } from '#app/types.js'
import { api } from '#app/api.js'
import { Form, SocialLogin } from '#app/components.js'
import { register as validator } from '#app/schemas.js'

export default function Register() {
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
        prefix="register"
        response={response}
        onSubmit={async ev => {
          ev.preventDefault()
          const form = validator.safeParse(Object.fromEntries(new FormData(ev.currentTarget)))
          if (!form.success) return setResponse(form.error.flatten())
          const body = new URLSearchParams(form.data)
          const { data } = await api<FormResult<User>>('/register', { method: 'post', body })
          setResponse(data)
          if (data.payload) {
            navigate(params.get('redirectTo') || '/')
            auth.setUser(data.payload)
          }
        }}
      >
        <fieldset>
          <legend>register</legend>

          <Form.Row name="username" type="text" />
          <Form.Row name="email" type="text" />
          <Form.Row name="password" type="password" autoComplete="new-password" />
          <Form.Row
            name="confirmPassword"
            label="confirm password"
            type="password"
            autoComplete="new-password"
          />

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
          <Form.Errors />
        </fieldset>
      </Form>

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
