create table posts (
  post_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users,
  body text not null,
  created_at timestamptz not null default now()
);
create index on posts (user_id);
