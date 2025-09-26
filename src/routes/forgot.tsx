import { useState } from 'react'
import { api } from '#app/api.js'
import type { FormResult } from '#app/types.js'
import { forgotPassword as validator } from '#app/schemas.js'
import { Form } from '#app/components.js'

export default function ForgotPassword() {
  const [response, setResponse] = useState<FormResult>()
  if (response?.formMessages)
    return (
      <div>
        We&apos;ve sent a link to your email. Please check your email and click the link and follow
        the instructions. If you don&apos;t receive the link, please ensure you entered the email
        address correctly, and check in your spam folder just in case.
      </div>
    )
  return (
    <Form
      response={response}
      prefix="forgot"
      onSubmit={async ev => {
        ev.preventDefault()
        const form = validator.safeParse(Object.fromEntries(new FormData(ev.currentTarget)))
        if (!form.success) return setResponse(form.error.flatten())
        const body = new URLSearchParams(form.data)
        const { data } = await api<FormResult>('/forgot-password', { method: 'post', body })
        setResponse(data)
      }}
    >
      <fieldset>
        <legend>forgot password</legend>
        <Form.Row name="email" type="text" autoComplete="email" />

        <div>
          {response?.formMessages?.map(e => (
            <div key={e} className="field-message">
              {e}
            </div>
          ))}
          {response?.formErrors?.map(e => (
            <div className="field-error" key={e}>
              {e}
            </div>
          ))}
          <button type="submit" data-cy="forgot-submit-button">
            Reset Password
          </button>
        </div>
      </fieldset>
    </Form>
  )
}
