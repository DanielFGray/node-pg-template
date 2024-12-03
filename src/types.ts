export interface FormResult<T = unknown> {
  fieldErrors?: Record<string, Array<string>>
  formErrors?: Array<string>
  formMessages?: Array<string>
  payload?: T
}

export interface User {
  id: string
  username: string
  avatar_url: string | null
  role: 'user' | 'admin'
  bio: string
  is_verified: string
  created_at: string
  updated_at: string
}

export interface UserEmail {
  id: string
  user_id: string
  email: string
  is_verified: boolean
  is_primary: boolean
  created_at: string
  updated_at: string
}

export interface UserAuthentication {
  id: string
  user_id: string
  service: string
  identifier: string
  details: unknown
  created_at: string;
  updated_at: string;
)
