# react-pg-template

## Requirements

This uses `docker` and `docker-compose` to manage a Postgres cluster

## Getting started

```sh
npm run dev
```

This will do a number of things, like generate a `.env` file and prompt for passwords, start the Postgres cluster in docker, run migrations, and generate TS types from the database using [kysely](https://kysely.dev/docs/generating-types).

## Roadmap

- [x] settings page
- [x] client-side protected routes
- [ ] server-side rendering?
