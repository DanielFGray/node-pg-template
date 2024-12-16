# node-pg-template

using javascript and sql for everything

## Features

* username/password login
* oauth login with github
* account verification via email
* reset password via email
* settings page to manage
  * account profile
  * changing password
  * add/delete email
  * switching primary email
  * delete account

## Getting started

```sh
npm run dev
```

The `predev` script starts Postgres with Docker, checks to see if it can connect, or runs the `init` script which will generate a `.env` file and prompt for passwords, start the Postgres cluster in docker, run migrations, and generate TypeScript definitions, before finally starting the dev server. Future runs skip `init` after it connects.

## Requirements

The `init` scripts assume you have `docker` and `docker-compose` installed

## Roadmap

- [x] testing
- [ ] real-time notifications using `NOTIFY`/`LISTEN`
- [ ] typed rpc
- [ ] observability
- [ ] server-side rendering?
