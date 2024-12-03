create type app_public.privacy as enum(
  'private',
  'public'
);


create table app_public.posts (
  id int primary key generated always as identity (start 1000),
  user_id uuid not null default app_public.current_user_id() references app_public.users on delete cascade,
  privacy app_public.privacy not null default 'public',
  body text not null check(length(body) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on app_public.posts (user_id);
create index on app_public.posts (created_at desc);

------------------------------------------------------------------------------------------------------------------------

alter table app_public.posts enable row level security;

create policy select_own_and_public on app_public.posts
  for select using (user_id = app_public.current_user_id() or privacy = 'public');

create policy insert_own on app_public.posts
  for insert with check (user_id = app_public.current_user_id());

create policy update_own on app_public.posts
  for update using (user_id = app_public.current_user_id());

create policy delete_own on app_public.posts
  for delete using (user_id = app_public.current_user_id());

create policy all_as_admin on app_public.posts
  for all using (exists (
    select 1 from app_public.users
    where id = app_public.current_user_id() and role = 'admin'
  ));

grant
  select,
  insert (body, privacy),
  update (body, privacy),
  delete
  on app_public.posts to :DATABASE_VISITOR;

create trigger _100_timestamps
  before insert or update
  on app_public.posts
  for each row
execute procedure app_private.tg__timestamps();
