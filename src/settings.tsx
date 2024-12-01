import { useState } from 'react'
import { useAuth } from './Auth.ctx.js'
import type { FormErrorResult } from './types.js'
import { api } from './api.js'

export default function Settings() {
  return (
    <>
      <ProfileSettings />
      <PasswordSettings />
    </>
  )
}

export function ProfileSettings() {
  const auth = useAuth()
  const [response, setResponse] = useState<FormErrorResult>()
  return (
    <form
      method="post"
      onSubmit={ev => {
        ev.preventDefault()
        const body = new URLSearchParams(new FormData(ev.currentTarget) as any)
        api('/api/settings/profile', { method: 'post', body })
          .then(res => {
            if (res.username) {
              setResponse({ formMessages: ['updated'] })
              return auth.setUser(res)
            }
            setResponse(res)
          })
      }}
    >
      <fieldset>
        <legend>profile settings</legend>

        <div className="form-row">
          <label htmlFor="settings-username-input">username:</label>
          <input
            type="text"
            name="username"
            id="settings-username-input"
            defaultValue={auth.user.username}
            aria-describedby="settings-username-help"
            aria-invalid={Boolean(response?.fieldErrors?.username)}
          />
          {response?.fieldErrors?.username?.map(e => (
            <div key={e} className="field-error" id="settings-username-help">
              {e}
            </div>
          ))}
        </div>
        <div>
          {response?.formMessages?.map(e => (
            <div key={e} className="field-message">
              {e}
            </div>
          ))}
          {response?.formErrors?.map(e => (
            <div key={e} className="field-error">
              {e}
            </div>
          ))}
          <button type="submit">update</button>
        </div>
      </fieldset>
    </form>
  )
}

export function PasswordSettings() {
  const [response, setResponse] = useState<FormErrorResult>()
  return (
    <form
      method="post"
      onSubmit={ev => {
        ev.preventDefault()
        const body = new URLSearchParams(new FormData(ev.currentTarget) as any)
        api('/api/settings/password', { method: 'post', body })
          .then(res => setResponse(res.data))
      }}
    >
      <fieldset>
        <legend>password settings</legend>
        <div className="form-row">
          <label htmlFor="settings-old-password-input">old password:</label>
          <input
            type="password"
            name="oldPassword"
            id="settings-old-password-input"
            autoComplete="current-password"
            minLength={6}
            aria-describedby="settings-old-password-help"
            aria-invalid={Boolean(response?.fieldErrors?.oldPassword)}
          />
          {response?.fieldErrors?.oldPassword?.map(e => (
            <div key={e} className="field-error" id="settings-old-password-help">
              {e}
            </div>
          ))}
        </div>

        <div className="form-row">
          <label htmlFor="settings-new-password-input">new password:</label>
          <input
            type="password"
            name="newPassword"
            id="settings-new-password-input"
            minLength={6}
            autoComplete="new-password"
            aria-describedby="settings-new-password-help"
            aria-invalid={Boolean(response?.fieldErrors?.newPassword)}
          />
          {response?.fieldErrors?.newPassword?.map(e => (
            <div key={e} className="field-error" id="settings-new-password-help">
              {e}
            </div>
          ))}
        </div>

        <div className="form-row">
          <label htmlFor="settings-old-password-input">confirm password:</label>
          <input
            type="password"
            name="confirmPassword"
            id="settings-old-password-input"
            minLength={6}
            aria-describedby="settings-old-password-help"
            aria-invalid={Boolean(response?.fieldErrors?.confirmPassword)}
          />
          {response?.fieldErrors?.confirmPassword?.map(e => (
            <div key={e} className="field-error" id="settings-old-password-help">
              {e}
            </div>
          ))}
        </div>
        <div>
          {response?.formErrors?.map(e => (
            <div key={e} className="field-error">
              {e}
            </div>
          ))}
          {response?.formMessages?.map(e => (
            <div key={e} className="field-message">
              {e}
            </div>
          ))}
          <button type="submit">update</button>
        </div>
      </fieldset>
    </form>
  )
}
