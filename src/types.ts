export type FormErrorResult = Partial<{
  fieldErrors: Record<string, Array<string>>
  formErrors: Array<string>
  formMessages: Array<string>
}>
