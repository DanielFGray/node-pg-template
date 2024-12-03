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
            method="get"
            action={`/auth/${service.toLowerCase()}${redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ''}`}
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
