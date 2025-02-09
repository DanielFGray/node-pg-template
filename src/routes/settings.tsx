import { useEffect, useState } from 'react'
import { useAuth } from '#app/Auth.ctx.js'
import type { FormResult, User, UserAuthentication, UserEmail } from '#app/types.js'
import { api } from '#app/api.js'
import { useNavigate, useSearchParams } from 'react-router'
import { SocialLogin, Spinner, FormErrors, UnverifiedAccountWarning } from '#app/components.js'
import * as schemas from '#app/schemas.js'

type SettingsData = {
  emails: UserEmail[]
  has_password: boolean
  authentications: UserAuthentication[]
}

export default function Settings() {
  const auth = useAuth()
  if (!auth.user) throw new Error("you shouldn't be here")
  const [settings, setEmail] = useState<SettingsData>()
  async function refetch() {
    const res = await api<FormResult<SettingsData>>('/settings')
    setEmail(res.payload)
  }
  useEffect(() => {
    refetch()
  }, [])
  if (!settings) return <Spinner />
  const data = { currentUser: auth.user, ...settings }
  return (
    <>
      <ProfileSettings {...data} />
      <PasswordSettings {...data} refetch={refetch} />
      <EmailSettings {...data} refetch={refetch} />
      <LinkedAccounts {...data} refetch={refetch} />
      <DeleteAccount />
    </>
  )
}

export function ProfileSettings({ currentUser }: { currentUser: User }) {
  const [response, setResponse] = useState<FormResult>()
  const auth = useAuth()
  return (
    <form
      onSubmit={async ev => {
        ev.preventDefault()
        const form = schemas.updateProfile.safeParse(
          Object.fromEntries(new FormData(ev.currentTarget)),
        )
        if (!form.success) return setResponse(form.error.flatten())
        const body = new URLSearchParams(form.data)
        const res = await api<FormResult<User>>('/me', { method: 'post', body })
        setResponse(res)
        if (res.payload) auth.setUser(res.payload)
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
            defaultValue={currentUser.username}
            aria-describedby="settings-username-help"
            aria-invalid={Boolean(response?.fieldErrors?.username)}
          />
          {response?.fieldErrors?.username?.map(e => (
            <div key={e} className="field-error" id="settings-username-help">
              {e}
            </div>
          ))}
        </div>

        <div className="form-row">
          <label htmlFor="settings-avatar_url-input">avatar:</label>
          <input
            type="text"
            name="avatar_url"
            id="settings-avatar_url-input"
            defaultValue={currentUser.avatar_url ?? ''}
            aria-describedby="settings-avatar_url-help"
            aria-invalid={Boolean(response?.fieldErrors?.avatar_url)}
          />
          {response?.fieldErrors?.avatar_url?.map(e => (
            <div key={e} className="field-error" id="settings-avatar_url-help">
              {e}
            </div>
          ))}
        </div>

        <div className="form-row">
          <label htmlFor="settings-bio-input">bio:</label>
          <textarea
            name="bio"
            id="settings-bio-input"
            defaultValue={currentUser.bio ?? ''}
            aria-describedby="settings-bio-help"
            aria-invalid={Boolean(response?.fieldErrors?.bio)}
          />
          {response?.fieldErrors?.bio?.map(e => (
            <div key={e} className="field-error" id="settings-bio-help">
              {e}
            </div>
          ))}
        </div>

        <div>
          <FormErrors response={response} />
          <button type="submit">update</button>
        </div>
      </fieldset>
    </form>
  )
}

export function PasswordSettings({
  has_password,
  emails,
  refetch,
}: SettingsData & { refetch: () => void }) {
  const [response, setResponse] = useState<FormResult>()
  if (!has_password)
    return (
      <form
        onSubmit={async ev => {
          ev.preventDefault()
          const primaryEmail = emails.find(e => e.is_primary)?.email
          if (!primaryEmail) throw new Error('no primary email')
          const body = new URLSearchParams([['email', primaryEmail]])
          const res = await api<FormResult>('/forgot-password', { method: 'post', body })
          setResponse(res)
        }}
      >
        <fieldset>
          <legend>password settings</legend>
          <button type="submit">reset password</button>
        </fieldset>
      </form>
    )
  return (
    <form
      onSubmit={async ev => {
        ev.preventDefault()
        const form = schemas.changePassword.safeParse(
          Object.fromEntries(new FormData(ev.currentTarget)),
        )
        if (!form.success) return setResponse(form.error.flatten())
        const body = new URLSearchParams(form.data)
        const res = await api<FormResult>('/change-password', { method: 'post', body })
        setResponse(res)
        refetch()
      }}
      data-cy="settings-password-form"
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
            data-cy="settings-old-password-input"
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
            name="password"
            id="settings-new-password-input"
            minLength={6}
            autoComplete="new-password"
            aria-describedby="settings-new-password-help"
            aria-invalid={Boolean(response?.fieldErrors?.newPassword)}
            data-cy="settings-new-password-input"
          />
          {response?.fieldErrors?.newPassword?.map(e => (
            <div key={e} className="field-error" id="settings-new-password-help">
              {e}
            </div>
          ))}
        </div>

        <div className="form-row">
          <label htmlFor="settings-confirm-password-input">confirm password:</label>
          <input
            type="password"
            name="confirmPassword"
            id="settings-confirm-password-input"
            minLength={6}
            aria-describedby="settings-confirm-password-help"
            aria-invalid={Boolean(response?.fieldErrors?.confirmPassword)}
            data-cy="settings-confirm-password-input"
          />
          {response?.fieldErrors?.confirmPassword?.map(e => (
            <div key={e} className="field-error" id="settings-confirm-password-help">
              {e}
            </div>
          ))}
        </div>

        <div>
          <FormErrors response={response} />
          <button type="submit" data-cy="settings-change-password-submit">
            update
          </button>
        </div>
      </fieldset>
    </form>
  )
}

function EmailSettings({
  currentUser,
  emails,
  refetch,
}: {
  currentUser: User
  emails?: UserEmail[] | undefined
  refetch: () => void
}) {
  return (
    <fieldset>
      <legend>email settings</legend>
      <ul data-cy="email-settings-list">
        {emails?.map(email => (
          <Email
            key={email.id}
            refetch={refetch}
            email={email}
            hasOtherEmails={Number(emails.length) > 1}
          />
        ))}
      </ul>
      <div>
        {currentUser.is_verified ? null : <UnverifiedAccountWarning />}
        <AddEmailForm refetch={refetch} />
      </div>
    </fieldset>
  )
}

function Email({
  email,
  hasOtherEmails,
  refetch,
}: {
  email: UserEmail
  hasOtherEmails: boolean
  refetch: () => void
}) {
  const [response, setResponse] = useState<FormResult>()
  const canDelete = !email.is_primary && hasOtherEmails
  return (
    <li
      className="flex-row justify-between"
      data-cy={`email-settings-item-${email.email.replace(/\W/g, '-')}`}
    >
      <div>
        {`✉️ ${email.email} `}
        <span
          title={
            email.is_verified
              ? 'Verified'
              : 'Pending verification (please check your inbox / spam folder'
          }
        >
          {email.is_verified ? (
            '✅ '
          ) : (
            <span data-cy="email-settings-indicator-unverified">(unverified)</span>
          )}
        </span>
        <div>Added {new Date(Date.parse(email.created_at)).toLocaleString()}</div>
        <FormErrors response={response} />
      </div>
      <form
        onSubmit={async ev => {
          ev.preventDefault()
          const form = schemas.withEmailId.safeParse(
            Object.fromEntries(new FormData(ev.currentTarget)),
          )
          if (!form.success) return setResponse(form.error.flatten())
          const body = new URLSearchParams(form.data)
          const type = (ev.nativeEvent.submitter as HTMLButtonElement).getAttribute('value')
          switch (type) {
            case 'resendValidation': {
              const res = await api<FormResult>('/resend-email-verification-code', {
                method: 'post',
                body,
              })
              setResponse(res)
              return refetch()
            }
            case 'deleteEmail': {
              const res = await api<FormResult>('/settings/email', { method: 'delete', body })
              setResponse(res)
              return refetch()
            }
            case 'makePrimary': {
              const res = await api<FormResult>('/make-email-primary', { method: 'post', body })
              setResponse(res)
              return refetch()
            }
          }
        }}
      >
        <input type="hidden" name="emailId" value={email.id} />
        {email.is_primary && (
          <span className="primary_indicator" data-cy="email-settings-indicator-primary">
            Primary
          </span>
        )}
        {canDelete && (
          <button
            type="submit"
            name="type"
            value="deleteEmail"
            data-cy="email-settings-button-delete"
          >
            Delete
          </button>
        )}
        {!email.is_verified && (
          <button type="submit" name="type" value="resendValidation">
            Resend verification
          </button>
        )}
        {email.is_verified && !email.is_primary && (
          <button
            type="submit"
            name="type"
            value="makePrimary"
            data-cy="email-settings-button-makeprimary"
          >
            Make primary
          </button>
        )}
      </form>
      <FormErrors response={response} />
    </li>
  )
}

function AddEmailForm({ refetch }: { refetch: () => void }) {
  const [params] = useSearchParams()
  const [showForm, setShowForm] = useState<boolean>(Boolean(params.get('showAddEmail') ?? false))
  const [response, setResponse] = useState<FormResult>()
  if (!showForm) {
    return (
      <form
        onSubmit={ev => {
          ev.preventDefault()
          setShowForm(true)
        }}
      >
        <button
          type="submit"
          name="showAddEmail"
          value="1"
          data-cy="settings-show-add-email-button"
        >
          Add email
        </button>
      </form>
    )
  }
  return (
    <form
      data-cy="settings-new-email-form"
      onSubmit={async ev => {
        ev.preventDefault()
        const form = schemas.withEmail.safeParse(Object.fromEntries(new FormData(ev.currentTarget)))
        if (!form.success) return setResponse(form.error.flatten())
        const body = new URLSearchParams(form.data)
        const res = await api<FormResult>('/settings/email', { method: 'post', body })
        setResponse(res)
        refetch()
        ev.target.reset()
        setShowForm(false)
      }}
    >
      <div className="form-row">
        <label htmlFor="settings-new-email-input">new email:</label>
        <input
          type="email"
          name="email"
          id="settings-new-email-input"
          minLength={6}
          autoComplete="email"
          aria-describedby="settings-new-email-help"
          aria-invalid={Boolean(response?.fieldErrors?.newEmail)}
          data-cy="settings-new-email-input"
        />
        {response?.fieldErrors?.newEmail?.map(e => (
          <div key={e} className="field-error" id="settings-new-email-help">
            {e}
          </div>
        ))}
      </div>
      <div>
        <FormErrors response={response} />
        <button type="submit" data-cy="settings-new-email-submit">
          add email
        </button>
      </div>
    </form>
  )
}

function LinkedAccounts({ authentications, refetch }: SettingsData & { refetch: () => void }) {
  return (
    <fieldset>
      <legend>manage linked accounts</legend>
      {authentications.flatMap(auth => {
        if (!auth.id) return []
        return (
          <div key={auth.id}>
            <strong>{auth.service}</strong>
            <div>Added {new Date(Date.parse(auth.created_at)).toLocaleString()}</div>
            <UnlinkAccountButton refetch={refetch} key="unlink" id={auth.id} />
          </div>
        )
      })}
      <SocialLogin
        filter={authentications.map(a => a.service.toLowerCase())}
        redirectTo="/settings"
        verb={service => `Link ${service} account`}
      />
    </fieldset>
  )
}

function UnlinkAccountButton({ id, refetch }: { refetch: () => void; id: string }) {
  const [modalOpen, setModalOpen] = useState(false)
  return (
    <div>
      {modalOpen ? (
        <form
          onSubmit={async ev => {
            ev.preventDefault()
            const body = new URLSearchParams(ev.currentTarget)
            await api<FormResult>('/unlink-auth', { method: 'post', body })
            refetch()
          }}
        >
          <b>Are you sure?</b>
          <p>
            If you unlink this account you won&apos;t be able to log in with it any more; please
            make sure your email is valid.
          </p>
          <div>
            <button onClick={() => setModalOpen(false)}>Cancel</button>
            <button>Unlink</button>
          </div>
          <input type="hidden" name="id" value={id} />
        </form>
      ) : (
        <button onClick={() => setModalOpen(true)}>Unlink</button>
      )}
    </div>
  )
}

function DeleteAccount() {
  const [response, setResponse] = useState<FormResult>()
  const [params] = useSearchParams()
  const token = params.get('delete_token')
  const auth = useAuth()
  const navigate = useNavigate()
  if (token)
    return (
      <form
        onSubmit={async ev => {
          ev.preventDefault()
          const form = schemas.deleteUser.safeParse({ token })
          if (!form.success) return setResponse(form.error.flatten())
          const body = new URLSearchParams(form.data)
          const res = await api<FormResult<{ confirm_account_deletion: boolean | null }>>('/me', {
            method: 'delete',
            body,
          })
          setResponse(res)
          if (res.payload?.confirm_account_deletion) {
            navigate('/')
            setTimeout(() => {
              auth.setUser(null)
            }, 10)
          }
        }}
      >
        <fieldset>
          <legend>danger zone</legend>
          <p>
            This is it. <b>Press this button and your account will be deleted.</b> We&apos;re sorry
            to see you go, please don&apos;t hesitate to reach out and let us know why you no longer
            want your account.
          </p>
          <p>
            <button data-cy="account-delete-confirm-button">PERMANENTLY DELETE MY ACCOUNT</button>
            <input type="hidden" name="token" value={token} />
          </p>
        </fieldset>
      </form>
    )
  if (response)
    return (
      <fieldset>
        <legend>danger zone</legend>
        <div>
          You&apos;ve been sent an email with a confirmation link in it, you must click it to
          confirm that you are the account holder so that you may continue deleting your account.
        </div>
      </fieldset>
    )
  return (
    <form
      onSubmit={async ev => {
        ev.preventDefault()
        const res = await api<FormResult>('/me', { method: 'delete' })
        setResponse(res)
      }}
    >
      <fieldset>
        <legend>danger zone</legend>
        <div>
          <FormErrors response={response} />
          <button name="submit" data-cy="account-delete-request-button">
            I want to delete my account
          </button>
        </div>
      </fieldset>
    </form>
  )
}
