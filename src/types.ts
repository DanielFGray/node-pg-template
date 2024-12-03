export type FormResult<T = unknown> = {
  fieldErrors?: Record<string, Array<string>>
  formErrors?: Array<string>
  formMessages?: Array<string>
  payload?: T
}

export type {
  AppPrivateSessions as Session,
  AppPublicUsers as User,
  AppPublicUserEmails as UserEmails,
  AppPublicUserAuthentications as UserAuthentications,
} from 'kysely-codegen'
