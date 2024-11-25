begin;
grant connect on database :DATABASE_NAME to :DATABASE_OWNER;
grant all on database :DATABASE_NAME to :DATABASE_OWNER;
alter schema public owner to :DATABASE_OWNER;

-- Some extensions require superuser privileges, so we create them before migration time.
create extension if not exists plpgsql with schema pg_catalog;
create extension if not exists "uuid-ossp" with schema public;
create extension if not exists citext with schema public;
commit;
