# react-pg-session-example

This is a small example of using React, vite, express, and express-session together and storing session data in Postgres.

## Requirements

This uses `docker` and `docker-compose` to manage a Postgres cluster

## Getting started

```sh
npm dev
```

This will do a number of things, like generate a `.env` file and prompt for passwords, start the Postgres cluster in docker, run migrations, and generate TS types from the database using [zapatos](https://github.com/jawj/zapatos/).

## Roadmap

- [x] settings page
- [x] client-side protected routes
- [ ] server-side rendering?

## Non-goals
I've specifically not done a lot of organization on the server, route handlers are crammed full of logic that should likely be separated, but I've deliberately kept it this way to keep the implementation simple and easy to understand. Consider separating the database calls into their own module, and using [zod](https://github.com/colinhacks/zod) to validate form responses.
