# react-pg-session-example

This is a small example of using express, express-session and create-react-app together and storing session data in Postgres.

## Requirements

This uses `docker` and `docker-compose` to manage a Postgres cluster and run migrations using [db-mate](https://github.com/amacneil/dbmate).

## Getting started

After you clone the repo, you should run the `setup` script:

```sh
yarn setup
```

This will do a number of things, like generate a `.env` file and prompt for passwords, start the Postgres cluster in docker, run migrations, and generate TS types from the database using [zapatos](https://github.com/jawj/zapatos/).

After that's done, you can start the project with:

```sh
yarn start
```

## Roadmap

- [x] settings page
- [x] client-side protected routes
- [ ] server-side rendering?

## Non-goals
I've specifically not done a lot of organization on the server, route handlers are crammed full of logic that should likely be separated, but I've deliberately kept it this way to keep the implementation simple and easy to understand. Consider separating the database calls into their own module, and using [zod](https://github.com/colinhacks/zod) to validate form responses.
