import { useEffect, useState } from 'react'
import type { FormResult } from './types.js'
import { api } from './api.js'
import { useSearchParams } from 'react-router'

export default function Verify() {
  const [params] = useSearchParams()
  const id = params.get('id')
  const token = params.get('token')

  const [message, setResponse] = useState<string>(() => {
    if (!(id && token)) return 'Missing id or token'
    return ''
  })

  useEffect(() => {
    if (id && token) {
      const body = new URLSearchParams([
        ['id', id],
        ['token', token],
      ])
      api<FormResult>('/verify-email', { method: 'post', body }).then(res => {
        if (!res.ok) return setResponse('Incorrect token, please check and try again')
        setResponse('Thank you for verifying your email address. You may now close this window.')
      })
    }
  }, [id, token])

  return <div className="items-center p-4">{message}</div>
}
