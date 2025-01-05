# node-pg-template

using typescript and postgres for everything

## Features

- username/password login
- oauth login with github
- account verification via email
- reset password via email
- settings page to manage
  * user profile
  * changing password
  * add/delete email
  * switching primary email
  * delete account

* authorization constraints are enforced by Postgres RLS
* session data is stored in Postgres
* [Graphile Worker](https://worker.graphile.org) is used as a job queue, jobs are stored in Postgres
* database migrations are written in SQL, managed by [Graphile Migrate](https://github.com/graphile/migrate)
* [Kysely](https://kysely.dev) is used to generates types from Postgres

## Getting started

```sh
npm run dev
```

The `predev` script starts Postgres with Docker, checks to see if it can connect, or runs the `init` script, which will generate a `.env` file, start the Postgres cluster using docker-compose, run migrations, and generate TypeScript definitions, before finally the `dev` command to start the backend and Vite dev server. The `init` process is skipped if the `predev` script successfully connects to the db.

## Requirements

The `init` scripts assume you have `docker` and `docker-compose` installed

## Roadmap

- [x] testing
- [ ] real-time notifications using `NOTIFY`/`LISTEN`
- [ ] typed rpc
- [ ] observability
- [ ] server-side rendering?
