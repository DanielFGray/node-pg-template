import { useState } from 'react'
import { api } from '#app/api.js'
import type { FormResult, User } from '#app/types.js'
import { useNavigate, useSearchParams } from 'react-router'
import { useAuth } from '#app/Auth.ctx.js'
import { resetPassword as validator } from '#app/schemas.js'
import { Form } from '#app/components.js'

export default function ResetPass() {
  const navigate = useNavigate()
  const auth = useAuth()
  const [response, setResponse] = useState<FormResult>()
  const [params] = useSearchParams()
  const userId = params.get('userId')
  const token = params.get('token')

  return (
    <div>
      <Form
        prefix="reset"
        response={response}
        onSubmit={async ev => {
          ev.preventDefault()
          const form = validator.safeParse(Object.fromEntries(new FormData(ev.currentTarget)))
          if (!form.success) return setResponse(form.error.flatten())
          const body = new URLSearchParams(form.data)
          const { data } = await api<FormResult<{ user: User }>>('/reset-password', {
            method: 'post',
            body,
          })
          setResponse(data)
          if (data?.payload?.user) {
            auth.setUser(data.payload.user)
            navigate(params.get('redirectTo') || '/')
          }
        }}
      >
        <fieldset>
          <legend>reset password</legend>
          {userId ? (
            <input name="userId" type="hidden" value={userId} />
          ) : (
            <Form.Row name="userId" type="text" label="Enter your user id" />
          )}
          {token ? (
            <input name="token" type="hidden" value={token} />
          ) : (
            <Form.Row name="token" type="text" label="Enter your reset token" />
          )}
          <Form.Row
            name="password"
            type="password"
            label="new password"
            autoComplete="new-password"
          />

          <Form.Row
            name="confirmPassword"
            type="password"
            label="confirm password"
            autoComplete="new-password"
          />

          <div>
            <Form.Errors />
            <button type="submit" data-cy="reset-submit-button">
              reset password
            </button>
          </div>
        </fieldset>
      </Form>
    </div>
  )
}
