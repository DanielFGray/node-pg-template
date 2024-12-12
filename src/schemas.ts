import z from 'zod'

export const username = z
  .string()
  .refine(n => /^\w+$/.test(n), 'username may only contain numbers, letters, and underscores')
  // this is also enforced in the database but this gives nicer error messages
  // TODO: some way to sync/generate this constraint from database?
  .refine(n => n.length >= 3 && n.length <= 64, {
    message: 'username must be between 3 and 64 characters',
  })

export const password = z
  .string()
  .refine(pw => pw.length >= 6, 'password must be at least 6 characters')
// .refine(pw => /\W/.test(pw), 'password must contain a number or symbol')

export const confirmPassword = z.object({
  password: password,
  confirmPassword: z.string(),
})

export const register = z
  .object({ username: username, email: z.string().optional() })
  .merge(confirmPassword)
  .strict()
  .refine(data => data.password === data.confirmPassword, 'passwords must match')

export const login = z.object({ id: z.string(), password: z.string() })

export const changePassword = z
  .object({ oldPassword: z.string().optional() })
  .merge(confirmPassword)
  .strict()
  .refine(data => data.password === data.confirmPassword, 'passwords must match')

export const resetPassword = z
  .object({ userId: z.string().uuid(), token: z.string() })
  .merge(confirmPassword)
  .strict()
  .refine(data => data.password === data.confirmPassword, 'passwords must match')

export const unlinkAuth = z.object({ id: z.string().uuid() })

export const withEmail = z.object({ email: z.string().email() })
export const forgotPassword = withEmail
export const addEmail = withEmail

export const deleteUser = z.object({ token: z.string().optional() })

export const withEmailId = z.object({ emailId: z.string().uuid() })
export const verifyEmail = z.object({ token: z.string() }).merge(withEmailId)
export const deleteEmail = withEmailId
export const resendEmailVerification = withEmailId
export const makeEmailPrimary = withEmailId

export const updateProfile = z.object({
  username: username,
  name: z.string(),
  bio: z.string(),
  avatar_url: z.string().url(),
})
