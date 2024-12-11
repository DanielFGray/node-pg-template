import { useEffect, useState } from 'react'
import type { FormResult } from './types.js'
import { api } from './api.js'
import { useSearchParams } from 'react-router'

export default function Verify() {
  const [params] = useSearchParams()
  const id = params.get('id')
  const token = params.get('token')

  const [response, setResponse] = useState<FormResult<{ verify_email: boolean }>>(() => {
    if (!(id && token)) return 'Missing id or token'
    return ''
  })

  async function verifyEmail() {
    const body = new URLSearchParams([
      ['id', id],
      ['token', token],
    ])
    const res = await api<FormResult<{ verify_email: boolean }>>('/verify-email', {
      method: 'post',
      body,
    })
    if (!res.ok) return setResponse(res.error)
    setResponse(res.data)
  }

  useEffect(() => {
    if (id && token) {
      verifyEmail()
    }
  }, [id, token])

  return (
    <div className="items-center p-4">
      {response.payload?.verify_email && (
        <div data-cy="email-verified">Thank you for verifying your email address.</div>
      )}
      {response?.formMessages?.map(e => (
        <div className="field-error" key={e}>
          {e}
        </div>
      ))}
      {response?.formErrors?.map(e => (
        <div className="field-error" key={e}>
          {e}
        </div>
      ))}
    </div>
  )
}
