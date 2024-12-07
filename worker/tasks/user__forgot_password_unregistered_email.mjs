import packageJson from '../../package.json' with { type: 'json' }

/** @typedef { import("./send_email").SendEmailPayload } SendEmailPayload */
/** @typedef { import("graphile-worker").Task } Task */

/** @typedef {{
  email: string
}} UserForgotPasswordUnregisteredEmailPayload */

/** @type {Task} */
export default async (inPayload, { addJob }) => {
  /** @type {UserForgotPasswordUnregisteredEmailPayload} */
  const payload = inPayload
  const { email } = payload

  /** @type {SendEmailPayload} */
  const sendEmailPayload = {
    options: {
      to: email,
      subject: `Password reset request failed: you don't have a ${packageJson.projectName} account`,
    },
    template: 'password_reset_unregistered.mjml',
    variables: {
      url: process.env.VITE_ROOT_URL,
    },
  }
  await addJob('send_email', sendEmailPayload)
}
