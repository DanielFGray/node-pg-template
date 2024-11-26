import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.string(),
  ROOT_DATABASE_USER: z.string(),
  ROOT_DATABASE_PASSWORD: z.string(),
  ROOT_DATABASE_URL: z.string(),
  DATABASE_HOST: z.string(),
  DATABASE_PORT: z.string(),
  DATABASE_NAME: z.string(),
  DATABASE_OWNER: z.string(),
  DATABASE_OWNER_PASSWORD: z.string(),
  DATABASE_URL: z.string(),
  SHADOW_DATABASE_PASSWORD: z.string(),
  SHADOW_DATABASE_URL: z.string(),
  SECRET: z.string(),
  PORT: z.string(),
  VITE_ROOT_URL: z.string(),
})
const schemaParsed = envSchema.safeParse(process.env)

if (!schemaParsed.success) {
  console.error(
    'did you forget to run the init script?',
    schemaParsed.error.flatten(i => i.message).fieldErrors,
  )
  process.exit(1)
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    type ProcessEnv = z.infer<typeof envSchema>
  }
}

// export const env = schemaParsed.data;
