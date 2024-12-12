import type { FormResult } from './types.js'

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
