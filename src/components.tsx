import type { FormResult } from './types.js'

export function UnverifiedAccountWarning() {
  return (
    <small data-cy="unverified-account-warning">
      You do not have any verified email addresses, this will make account recovery impossible and
      may limit your available functionality within this application. Please complete email
      verification.
    </small>
  )
}

export function Spinner() {
  return <>loading...</>
}

export function FormErrors({ response }: { response: FormResult | undefined }) {
  return (
    <>
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
    </>
  )
}

const SocialLoginServices = ['GitHub']
export function SocialLogin({
  verb,
  redirectTo,
  filter,
}: {
  redirectTo?: string
  verb: string | ((service: string) => string)
  filter?: string[] | ((service: string) => string)
}) {
  if (SocialLoginServices.length < 1) return null
  return (
    <>
      {SocialLoginServices.flatMap(service => {
        if (
          (typeof filter === 'function' && !filter(service)) ||
          (Array.isArray(filter) && filter.some(f => f === service.toLowerCase()))
        )
          return []
        return (
          <form
            key={service}
            method="get"
            action={`/auth/${service.toLowerCase()}${
              redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ''
            }`}
          >
            <button>
              {typeof verb === 'function' ? verb(service) : `${verb} with ${service}`}
            </button>
          </form>
        )
      })}
    </>
  )
}
