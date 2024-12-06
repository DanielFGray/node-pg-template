// @ts-check
import fs from 'fs/promises'
import * as nodemailer from 'nodemailer'

const isTest = process.env.NODE_ENV === 'test'
const isDev = process.env.NODE_ENV !== 'production'

/** @type {Promise<nodemailer.Transporter>} */
let transporterPromise
const etherealFilename = `${process.cwd()}/.ethereal`

let logged = false

export default function getTransport() {
  if (!transporterPromise) {
    transporterPromise = (async () => {
      if (isTest) {
        return nodemailer.createTransport({
          jsonTransport: true,
        })
      } else if (isDev) {
        let account
        try {
          const testAccountJson = await fs.readFile(etherealFilename, 'utf8')
          account = JSON.parse(testAccountJson)
        } catch (e) {
          account = await nodemailer.createTestAccount()
          await fs.writeFile(etherealFilename, JSON.stringify(account))
        }
        if (!logged) {
          logged = true
          console.log()
          console.log()
          console.log(
            // Escapes equivalent to chalk.bold
            '\x1B[1m' +
            ' ✉️ Emails in development are sent via ethereal.email; your credentials follow:' +
            '\x1B[22m'
          )
          console.log('  Site:     https://ethereal.email/login')
          console.log(`  Username: ${account.user}`)
          console.log(`  Password: ${account.pass}`)
          console.log()
          console.log()
        }
        return nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: account.user,
            pass: account.pass,
          },
        })
      } else {
        if (!process.env.AWS_ACCESS_KEY_ID) {
          throw new Error('Misconfiguration: no AWS_ACCESS_KEY_ID')
        }
        if (!process.env.AWS_SECRET_ACCESS_KEY) {
          throw new Error('Misconfiguration: no AWS_SECRET_ACCESS_KEY')
        }
        const aws = await import('aws-sdk')
        return nodemailer.createTransport({
          SES: new aws.SES({
            apiVersion: '2010-12-01',
            region: awsRegion,
          }),
        })
      }
    })()
  }
  return transporterPromise
}
