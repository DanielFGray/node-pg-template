import { useEffect, useState } from 'react'
import type { FormResult } from './types.js'
import { api } from './api.js'
import { useSearchParams } from 'react-router'
import { FormErrors } from './components.js'

export default function Verify() {
  const [params] = useSearchParams()
  const id = params.get('id')
  const token = params.get('token')

  const [response, setResponse] = useState<FormResult<{ verify_email: boolean }>>(() => {
    if (!(id && token)) return { formErrors: ['Missing id or token'] }
    return {}
  })

  useEffect(() => {
    if (id && token) {
      const body = new URLSearchParams({ emailId: id, token })
      api<FormResult<{ verify_email: boolean }>>('/verify-email', {
        method: 'post',
        body,
      }).then(res => {
        setResponse(res)
      })
    }
  }, [id, token])

  return (
    <div className="items-center p-4">
      {response.payload?.verify_email && (
        <div data-cy="email-verified">Thank you for verifying your email address.</div>
      )}
      <FormErrors response={response} />
    </div>
  )
}
