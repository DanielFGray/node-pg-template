// const { awsRegion } = require('@app/config')
// const aws = require('aws-sdk')
import fs from 'fs/promises'
import { createTransport, createTestAccount } from 'nodemailer'

const { readFile, writeFile } = fs

const isTest = process.env.NODE_ENV === 'test'
const isDev = process.env.NODE_ENV !== 'production'

let transporterPromise
const etherealFilename = `${process.cwd()}/.ethereal`

let logged = false

export default function getTransport() {
  if (!transporterPromise) {
    transporterPromise = (async () => {
      if (isTest) return createTransport({ jsonTransport: true })

      if (isDev) {
        let account
        try {
          const testAccountJson = await readFile(etherealFilename, 'utf8')
          account = JSON.parse(testAccountJson)
        } catch (e) {
          account = await createTestAccount()
          await writeFile(etherealFilename, JSON.stringify(account))
        }
        if (!logged) {
          logged = true
          console.log()
          console.log()
          console.log(
            ' ✉️ Emails in development are sent via ethereal.email; your credentials follow:',
          )
          console.log('  Site:     https://ethereal.email/login')
          console.log(`  Username: ${account.user}`)
          console.log(`  Password: ${account.pass}`)
          console.log()
          console.log()
        }
        return createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: account.user,
            pass: account.pass,
          },
        })
      }
      // if (!process.env.AWS_ACCESS_KEY_ID) {
      //   throw new Error('Misconfiguration: no AWS_ACCESS_KEY_ID')
      // }
      // if (!process.env.AWS_SECRET_ACCESS_KEY) {
      //   throw new Error('Misconfiguration: no AWS_SECRET_ACCESS_KEY')
      // }
      // return nodemailer.createTransport({
      //   SES: new aws.SES({
      //     apiVersion: '2010-12-01',
      //     region: awsRegion,
      //   }),
      // })
    })()
  }
  return transporterPromise
}
