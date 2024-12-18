# node-pg-template

using typescript and postgres for everything

## Features

- username/password login
- oauth login with github
- account verification via email
- reset password via email
- settings page to manage

  - account profile
  - changing password
  - add/delete email
  - switching primary email
  - delete account

- authorization constraints are enforced by postgres RLS
- session data is stored in postgres
- [graphile-worker](https://worker.graphile.org) is used as a job queue, jobs are stored in postgres
- database migrations are written in SQL, managed by [graphile-migrate](https://github.com/graphile/migrate)
- [kysely](https://kysely.dev) is used to generates types from Postgres

## Getting started

```sh
npm run dev
```

The `predev` script starts Postgres with Docker, checks to see if it can connect, or runs the `init` script. The init script will generate a `.env` file, start the Postgres cluster in docker, run migrations, and generate TypeScript definitions, before finally starting the dev server. Future runs skip `init` after it connects.

## Requirements

The `init` scripts assume you have `docker` and `docker-compose` installed

## Roadmap

- [x] testing
- [ ] real-time notifications using `NOTIFY`/`LISTEN`
- [ ] typed rpc
- [ ] observability
- [ ] server-side rendering?
