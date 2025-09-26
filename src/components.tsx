import React from 'react'
import type { FormResult } from './types.js'

const FormContext = React.createContext<{
  prefix: string
  response?: FormResult<unknown>
}>({ prefix: '' })

export function Form<T extends undefined | FormResult<unknown>>({
  prefix,
  response,
  children,
  ...props
}: {
  prefix: string
  response: T
} & React.ComponentPropsWithoutRef<'form'>) {
  return (
    <FormContext.Provider value={{ prefix, response }}>
      <form {...props}>{children}</form>
    </FormContext.Provider>
  )
}

Form.Row = function FormRow(
  props: (
    | {
        name: string
        label?: string | null
        children: React.ReactNode
      }
    | {
        name: string
        label?: string | null
        type: HTMLInputElement['type'] | 'textarea'
      }
  ) &
    Omit<React.ComponentPropsWithoutRef<'input'>, 'type' | 'name'>,
) {
  const { prefix, response } = React.useContext(FormContext)

  return (
    <div className="form-row">
      {props.label === null ? null : (
        <label htmlFor={`${prefix}-${props.name}-input`} data-cy={`${prefix}-${props.name}-label`}>
          {props.label || props.name}:
        </label>
      )}
      {'children' in props
        ? props.children
        : React.createElement(props.type === 'textarea' ? 'textarea' : 'input', {
            ...props,
            type: props.type === 'textarea' ? undefined : props.type,
            name: props.name,
            id: `${prefix}-${props.name}-input`,
            'aria-describedby': `${prefix}-${props.name}-help`,
            'aria-invalid': Boolean(response?.fieldErrors?.[props.name]),
            'data-cy': `${prefix}-${props.name}-input`,
          })}
      {response?.fieldErrors?.[props.name]?.map(e => (
        <div className="field-error" key={e} id={`${prefix}-${props.name}-help`}>
          {e}
        </div>
      ))}
    </div>
  )
}

Form.Errors = function FormErrors() {
  const { response } = React.useContext(FormContext)
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
